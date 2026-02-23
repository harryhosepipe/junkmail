# API Storage Boundary

## Owns

- Object storage client configuration and bucket/public URL helpers.
- Path/key derivation and public asset URL normalization.

## Invariants

- Storage SDK usage is centralized in storage and workflow/application edges.
- URL normalization handles local/proxy deployment modes consistently.

## Depends on

- `@aws-sdk/client-s3`
- API env configuration for endpoint, credentials, and bucket settings.

## Does not own

- Domain decisions about image lifecycle state.
- Route-level HTTP behavior.
- Convex metadata persistence.

## Tradeoffs

- Uses S3-compatible client configuration for MinIO and cloud portability.
- Some workflows still call storage directly while use-case extraction continues.
