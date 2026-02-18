# Duplicate Fixture Workspace

Use this folder to tune duplicate detection with real-world originals and cropped variants.

## Layout

- `manifest.json`: Your active test matrix (not committed by default).
- `manifest.example.json`: Template to copy.
- `images/originals/`: Source/original images.
- `images/variants/`: Slight crops/edits of originals.

## Quick Start

1. Copy template:

```bash
cp api/testing/duplicate-fixtures/manifest.example.json api/testing/duplicate-fixtures/manifest.json
```

2. Add image files under:

- `api/testing/duplicate-fixtures/images/originals/`
- `api/testing/duplicate-fixtures/images/variants/`

3. Update `manifest.json` paths/expectations.

4. Run evaluator:

```bash
bun run --cwd api images:evaluate-duplicates
```

Optional flags:

```bash
bun run --cwd api images:evaluate-duplicates -- --dir ./testing/duplicate-fixtures --manifest ./testing/duplicate-fixtures/manifest.json
```

## Manifest Format

```json
{
  "cases": [
    {
      "id": "my-case",
      "original": "images/originals/original.jpg",
      "variants": [
        {
          "path": "images/variants/original-crop.jpg",
          "label": "center crop",
          "expectDuplicate": true
        }
      ]
    }
  ]
}
```

- `expectDuplicate=true`: should be caught as near-duplicate.
- `expectDuplicate=false`: should not match (negative control).

The evaluator prints PASS/FAIL per variant and hash distances so you can tune thresholds quickly.
