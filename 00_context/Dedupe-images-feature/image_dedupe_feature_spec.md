# Image Upload De-duplication (Crop-Robust) - Feature Spec

**Target stack:** Astro (frontend) + Convex (backend/storage+db) + Hono API + Image Worker  
**Purpose:** Reject uploads that are exact duplicates _or_ the same underlying image after resizing/recompression/borders/whitespace removal, and detect common crop variants.

## Tech stack

- **Frontend:** Astro
- **Backend / DB:** Convex (data model, indexes, mutations, subscriptions)
- **API layer:** Hono (upload init/complete endpoints, auth, job enqueue)
- **Image processing:** Image Worker (decode/normalize, crop/canonicalize, fingerprinting, ORB verification)
- **Object storage:** Whatever you use behind Convex/Hono (raw uploads + canonical images stored as blobs/objects)

---

## Packages & libraries (recommended)

This section maps **each task** in the workflow to concrete packages you can use in your stack.

### A. Astro frontend

- **Direct-to-storage uploads:** use the presigned URL (from Hono) with `fetch` or `XMLHttpRequest`.
  - Task: upload progress UI → `XMLHttpRequest` (simplest for progress events) or `fetch` + streams.

### B. Hono API (TypeScript/Node)

**Tasks**

- Auth / tenant scoping → your existing auth middleware (e.g. `@hono/zod-validator` for request validation, plus your auth provider SDK).
- Upload init/complete endpoints → `hono`
- Validation / typing → `zod` (+ `@hono/zod-validator`)
- Idempotency keys (uploadId) → store in Convex; optionally `ulid` or `uuid`

**Packages**

- `hono` (routing)
- `zod`, `@hono/zod-validator` (schema validation)
- `ulid` **or** `uuid` (uploadId generation)
- `@convex-dev/convex` (Convex client; use whatever Convex TS client you already have)

### C. Convex (DB / indexes / workflow state)

**Tasks**

- Persist `images`, `image_fingerprints`, `dedupe_events` tables
- Enforce uniqueness of `(tenantId, sha256_pixels)` via application-level check + conflict handling
- Provide status subscription to Astro (accepted/rejected)

**Packages**

- `convex` (Convex server + TS client)
- (No extra packages needed; use Convex indexes + mutations)

### D. Image worker (recommended: Python for best crop-robust verification)

You can run the worker as a separate service/container. Python has the most mature, reliable tooling for **ORB + RANSAC** verification.

**Tasks → packages**

1. Decode + EXIF orientation + colorspace normalize
   - `Pillow` (`PIL`)
2. Auto-crop whitespace/black bars
   - `opencv-python` **or** `numpy` + `Pillow` (OpenCV is faster for thresholding)
3. Canonical resize / encode
   - `Pillow` **or** `opencv-python`
4. Exact fingerprint (SHA-256 of normalized pixels)
   - Python stdlib: `hashlib`
5. Perceptual hash shortlist
   - `imagehash` (pHash/dHash) **or** `imagededup` (hashing + CNN options)
6. Crop-robust confirmation (feature matching)
   - `opencv-python` (ORB + BFMatcher + `cv2.findHomography` with RANSAC)
7. Storage I/O
   - Use your storage SDK (S3/R2/GCS/etc.) or your existing Convex storage utilities.

**Python packages**

- `pillow`
- `opencv-python`
- `numpy`
- `imagehash` (lightweight) **or** `imagededup` (more features)
- (optional) `boto3` / `google-cloud-storage` / `cloudflare-r2` SDK depending on storage

### E. Image worker (alternative: Node/TypeScript only)

Node can do hashing and basic canonicalization well. **Crop-robust verification** is harder but possible.

**Tasks → packages**

1. Decode/resize/strip metadata/canonical encode
   - `sharp`
2. Exact fingerprint
   - Node `crypto` (SHA-256) on **raw pixel buffer** (get raw via `sharp(...).raw().toBuffer()`)
3. Perceptual hash
   - `image-hash` **or** `sharp-phash` (ecosystem varies; test thoroughly)
4. Crop-robust confirmation
   - Options (ranked):
     - **Call Python worker** for ORB verification (recommended)
     - Use `opencv4nodejs` (native bindings; more ops work)
     - Use deep embeddings via ONNX (`onnxruntime-node`) + vector search, then accept higher false-positive risk unless you add a confirm step.

**Node packages**

- `sharp`
- `crypto` (built-in)
- `image-hash` (or equivalent pHash library)
- (optional) `onnxruntime-node` + a small embedding model (more complex)

---

## Package-driven workflow checklist

### 1) Pre-crop normalized SHA-256 (exact duplicates)

- **Python:** `Pillow` decode → normalize → `numpy` bytes → `hashlib.sha256`
- **Node:** `sharp(...).raw().toBuffer()` → `crypto.createHash('sha256')`

### 2) Canonical crop + pHash shortlist (near duplicates)

- **Python:** `opencv-python` crop + resize → `imagehash.phash` (or `imagededup`)
- **Node:** `sharp` crop + resize → pHash library

### 3) Crop-robust confirmation (reject with confidence)

- **Python (recommended):** `opencv-python` ORB + RANSAC homography verification
- **Node-only:** `opencv4nodejs` _or_ delegate to Python worker

## 1. Goals

- **Cancel upload** (fail fast) when an uploaded image already exists in the system.
- Detect duplicates across common transforms:
  - Different file formats / metadata changes
  - Recompression / resizing
  - Added borders (white/black) and whitespace
  - **Cropped variants** (same source image but tighter/shifted crop)
- Provide a **deterministic, auditable decision**: which existing asset matched and why.
- Scale to large libraries with predictable latency.

## 2. Non-goals (v1)

- Detecting duplicates across _semantic similarity_ (e.g., two different photos of the same object).
- Detecting heavy edits (collages, large occlusions, major retouching) beyond a configurable tolerance.
- Blocking copyright infringement globally (this is _internal library dedupe_).

---

## 3. Key idea: Multi-stage fingerprints

Compute fingerprints for BOTH:

1. **Pre-crop normalized pixels** (for exact duplicates that differ by metadata/container)
2. **Canonical post-crop image** (for border/whitespace normalization + near-duplicate matching)

Then confirm crop-robust matches with **local feature verification** on a shortlist.

### Fingerprints (recommended)

- **sha256_pixels**: SHA-256 of _decoded, normalized_ pixel buffer (pre-crop)
- **phash_64**: perceptual hash of canonical image (post-crop)
- **dhash_64** (optional): second perceptual hash for stability
- **orb_sig** (v1 confirm): ORB keypoints/descriptors (or computed on demand) for geometric verification

---

## 4. Data model (Convex)

### Table: `images`

- `_id`
- `ownerId` / `tenantId`
- `status`: `"pending" | "accepted" | "rejected"`
- `storageKeyOriginal` (raw upload blob key)
- `storageKeyCanonical` (post-crop canonical blob key)
- `width`, `height`, `mime`
- `createdAt`

### Table: `image_fingerprints`

- `imageId` (FK -> images)
- `tenantId`
- `sha256_pixels` (string, indexed, unique per tenant)
- `phash_64` (string/int64, indexed)
- `dhash_64` (optional)
- `canonicalWidth`, `canonicalHeight`
- `cropBox` (x,y,w,h) and crop method metadata
- `createdAt`

### Table: `dedupe_events` (audit log)

- `tenantId`
- `uploadImageId`
- `decision`: `"accepted" | "rejected"`
- `reason`: `"sha256_exact" | "phash_near" | "orb_verified" | "manual_override" | "error"`
- `matchedImageId` (nullable)
- `scores`: `{ phashDistance?: number, orbInliers?: number, orbInlierRatio?: number }`
- `workerVersion`
- `createdAt`

**Uniqueness constraint:** `(tenantId, sha256_pixels)` must be unique for accepted images.

---

## 5. Canonicalization & preprocessing

### 5.1 Pre-crop normalization (for sha256)

Input: raw bytes  
Steps:

1. Decode (JPEG/PNG/WebP/HEIC if supported)
2. Apply EXIF orientation
3. Convert to sRGB (or consistent RGB)
4. Strip metadata
5. Produce **normalized pixel buffer** in a stable layout (e.g., RGB8 row-major)
6. `sha256_pixels = SHA256(pixel_buffer)`

Rationale: catches exact duplicates even if container/metadata differs.

### 5.2 Auto-crop + canonical image (for phash/features)

Input: decoded pixels  
Steps:

1. Run your current auto-crop (trim whitespace/black bars) with recorded parameters:
   - threshold method + tolerance
   - min border size
2. Resize to canonical max dimension (recommend: longest side = 1024 or 1536)
3. Optional: slight blur/downsample step used by hashing library
4. Encode canonical (WebP/JPEG) for storage
5. Compute `phash_64` (and optional `dhash_64`) from canonical pixels

Rationale: makes borders/letterboxing differences converge to the same signature.

---

## 6. End-to-end workflow (Astro + Hono + Convex + Worker)

### 6.1 Client (Astro) - two-step upload

1. `POST /uploads/init` -> returns:
   - `uploadId`
   - pre-signed upload URL (or Convex upload token)
2. Client uploads bytes directly to object storage.
3. Client calls `POST /uploads/complete` with `uploadId` and basic metadata.

### 6.2 Backend (Hono API) - state + idempotency

- `init` creates `images` row with status `"pending"`.
- `complete` enqueues an **image worker job** (idempotent using `uploadId`).

### 6.3 Worker - dedupe pipeline (authoritative decision)

Worker steps:

**Step A - Load & normalize**

- Fetch uploaded bytes
- Decode + normalize (Section 5.1)
- Compute `sha256_pixels`

**Step B - Exact duplicate check**

- Query `image_fingerprints` by `(tenantId, sha256_pixels)` for any **accepted** image.
- If found:
  - Mark upload `"rejected"`
  - Write `dedupe_events` reason `"sha256_exact"`
  - Optionally delete raw upload blob
  - Return

**Step C - Canonical crop + perceptual shortlist**

- Run auto-crop + canonical resize (Section 5.2)
- Compute `phash_64` (and `dhash_64`)

Shortlist strategy:

- Retrieve candidates with similar pHash using a **bucket index**:
  - Example: store first N bits as `phash_prefix` and query same prefix +/- a few adjacent prefixes
  - Then compute true Hamming distance in worker
- Keep top K candidates (recommend K=25 to 100 depending on scale)

If no candidates within threshold:

- Accept image (Step E)

**Step D - Crop-robust confirmation (ORB)**
For each candidate in shortlist (best-first):

1. Download candidate canonical image
2. Run ORB feature match + RANSAC homography
3. Compute:
   - `orbInliers`
   - `orbInlierRatio = inliers / matches`
4. If above thresholds (see Section 7):
   - Duplicate confirmed -> reject upload
   - Log `dedupe_events` reason `"orb_verified"` with matched image + scores
   - Optionally delete blobs
   - Return

If none confirm, proceed.

**Step E - Accept**

- Store canonical blob
- Write `images.status = "accepted"`
- Insert `image_fingerprints` (sha256 + phash + crop metadata)
- Log `dedupe_events` decision `"accepted"`

---

## 7. Thresholds (starting defaults)

### Exact

- `sha256_pixels` match => reject (no threshold)

### pHash shortlist

- Compute Hamming distance `d` (0..64)
- Start with:
  - `d <= 8` => strong near-duplicate candidate
  - `9 <= d <= 14` => weak candidate (still try ORB)
  - `d > 14` => ignore

Tune per your content. Text-heavy/memes often need tighter thresholds.

### ORB confirmation (crop-robust)

Start with:

- `orbInliers >= 20` AND `orbInlierRatio >= 0.25`
- Optionally also require minimum matched keypoints >= 60

Tune based on false positives/negatives. For very small images, lower the absolute inliers requirement.

---

## 8. Concurrency, idempotency, and cancellation

- **Idempotent worker:** guard by checking `images.status` before processing; if already accepted/rejected, exit.
- **Unique constraint** on `(tenantId, sha256_pixels)` prevents race conditions where two identical uploads arrive simultaneously.
  - On conflict: treat as duplicate and reject the newer upload, log event.
- **Cancellation UX:**
  - Client sees `"rejected"` status and can display:
    - “Already uploaded as {matchedImageId}”
    - optionally show thumbnail of existing asset if permitted

---

## 9. Observability & auditing

Log and persist:

- durations: decode, crop, hash, shortlist, ORB verify
- candidate counts K
- final decision + reason
- matched image id
- thresholds + worker version

Dashboards:

- reject rate by reason
- pHash distance distribution for rejected
- ORB inlier distribution
- worker latency percentiles

---

## 10. Security & privacy

- Dedupe must run **within tenant scope** unless you explicitly want global dedupe.
- Never leak another tenant’s `matchedImageId` or thumbnail.
- Rate limit upload init/complete endpoints.
- Validate mime types; reject polyglot files; enforce size limits.

---

## 11. Implementation notes for your stack

### Convex

- Use Convex mutations for:
  - `createPendingImage(uploadId, tenantId, ...)`
  - `markRejected(imageId, reason, matchedId, scores)`
  - `markAccepted(imageId, storageKeyCanonical, fingerprints)`
- Use Convex indexes:
  - `by_tenant_sha256`
  - `by_tenant_phash_prefix` (if using prefix buckets)

### Hono API

Endpoints:

- `POST /uploads/init`
- `POST /uploads/complete`
- `GET /uploads/:id/status` (or subscribe via Convex)

### Image worker

- Stateless compute container
- Has access to storage + Convex credentials
- Keep hashing and ORB code versioned (`workerVersion`)

---

## 12. Future improvements (v2+)

- Replace pHash bucketing with vector search (CLIP/ResNet embeddings + FAISS/pgvector) for better recall.
- Multi-crop / tiling embeddings for even stronger crop detection.
- Deduplicate variants across small overlays by using robust features on multiple scales.
- Add a manual review queue for borderline scores.

---

## 13. Acceptance criteria

- Upload is rejected when:
  - same image uploaded again with different metadata/container
  - same image uploaded with borders/whitespace differences that your crop removes
  - same image uploaded as a crop of an existing image (common crop variants)
- Decision is logged in `dedupe_events` with a reason and (when applicable) match scores.
- End-to-end processing completes within your target SLA (define per scale; typical goal: < 2-5s for median).
