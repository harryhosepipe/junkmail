from __future__ import annotations

import base64
import os
from typing import List, Optional

import cv2
import numpy as np
import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


class Candidate(BaseModel):
    imageId: str
    url: str


class VerifyRequest(BaseModel):
    uploadImageBase64: str = Field(min_length=1)
    candidates: List[Candidate] = Field(default_factory=list)
    minInliers: int = 20
    minInlierRatio: float = 0.25
    minMatches: int = 60


class VerifyResponse(BaseModel):
    verified: bool
    matchedImageId: Optional[str] = None
    scores: Optional[dict] = None
    diagnostics: Optional[dict] = None


app = FastAPI(title="junkmail-orb-verifier")
SHARED_SECRET = os.getenv("ORB_SHARED_SECRET", "").strip()


def decode_image_bytes(raw: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return image


def to_gray(image: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/verify/orb", response_model=VerifyResponse)
def verify_orb(payload: VerifyRequest, authorization: Optional[str] = Header(default=None)):
    if SHARED_SECRET:
        expected = f"Bearer {SHARED_SECRET}"
        if authorization != expected:
            raise HTTPException(status_code=401, detail="Unauthorized")

    if not payload.candidates:
        return VerifyResponse(verified=False)

    try:
        upload_raw = base64.b64decode(payload.uploadImageBase64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid uploadImageBase64: {exc}")

    upload_image = decode_image_bytes(upload_raw)
    if upload_image is None:
        raise HTTPException(status_code=400, detail="Could not decode upload image")

    orb = cv2.ORB_create(2000)
    upload_gray = to_gray(upload_image)
    kp1, des1 = orb.detectAndCompute(upload_gray, None)
    if des1 is None or kp1 is None or len(kp1) == 0:
        return VerifyResponse(verified=False, diagnostics={"reason": "no_keypoints_upload"})

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

    best = None

    for candidate in payload.candidates:
        try:
            response = requests.get(candidate.url, timeout=5)
            if response.status_code != 200:
                continue
            candidate_image = decode_image_bytes(response.content)
            if candidate_image is None:
                continue

            candidate_gray = to_gray(candidate_image)
            kp2, des2 = orb.detectAndCompute(candidate_gray, None)
            if des2 is None or kp2 is None or len(kp2) == 0:
                continue

            matches = matcher.match(des1, des2)
            if not matches or len(matches) < payload.minMatches:
                continue

            matches = sorted(matches, key=lambda m: m.distance)
            if len(matches) > 400:
                matches = matches[:400]

            src_pts = np.float32([kp1[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
            dst_pts = np.float32([kp2[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)

            _, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
            if mask is None:
                continue

            inliers = int(mask.ravel().sum())
            total = len(matches)
            ratio = float(inliers) / float(total) if total > 0 else 0.0

            if best is None or inliers > best["inliers"]:
                best = {
                    "imageId": candidate.imageId,
                    "inliers": inliers,
                    "inlierRatio": ratio,
                    "matches": total,
                }

            if inliers >= payload.minInliers and ratio >= payload.minInlierRatio:
                return VerifyResponse(
                    verified=True,
                    matchedImageId=candidate.imageId,
                    scores={
                        "inliers": inliers,
                        "inlierRatio": ratio,
                        "matches": total,
                    },
                )
        except Exception:
            continue

    if best is None:
        return VerifyResponse(verified=False, diagnostics={"reason": "no_candidate_match"})

    return VerifyResponse(
        verified=False,
        diagnostics={
            "bestCandidate": best["imageId"],
            "bestInliers": best["inliers"],
            "bestInlierRatio": best["inlierRatio"],
            "bestMatches": best["matches"],
        },
    )
