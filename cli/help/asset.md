# Asset Library Protocol

Asset Library is the versioned, local-first source of truth for project materials. It stores asset bytes under `.loom/vN/08_ASSET_LIBRARY/files/` and metadata in `manifest.json`. A remote URL, successful download, or HTTP 200 is never proof that an asset is renderable in the target host.

## Import

```bash
loom asset import ./approved-image.png \
  --kind image \
  --tags "庆祝,表情,项目名" \
  --source "用户自有素材包" \
  --author "作者或权利人" \
  --license "授权说明或许可证" \
  --approval approved
```

Import copies an explicitly named ordinary local file, computes SHA-256, derives a stable `ASSET-...` ID, and rejects symbolic links, destination/path escape, duplicate bytes, missing provenance, and unapproved assets. It does not fetch remote material.

## Recoverable import transaction

An evidence-linked import changes three files: the copied bytes, `manifest.json`, and `07_CAPABILITY_GRAPH.json`. Filesystems do not provide one atomic operation across those files, so Loom does not claim that they do. It first prevalidates the complete candidate, then writes same-directory temporary files and a recovery journal (flushed where the filesystem supports it). If an import errors, Loom rolls back to the recorded pre-import state; if the process is interrupted, the next `loom asset validate`, import, or library read recovers the journal before using the library. `loom asset validate` reports a recovered transaction in its JSON output.

## Discover and verify

```bash
loom asset list
loom asset search 表情
loom asset get ASSET-<hash-prefix>
loom asset validate
```

Tags are Unicode strings, so Chinese search works without a separate tokenizer for the small local library. Search returns only active `approval: approved` assets; `asset list` remains the audit view. Only approved assets may be used by Forge.

## Evidence links

When importing with `--evidence`, Loom validates the complete prospective manifest and Graph first, then writes both the asset's `evidence_refs` and the evidence node's `asset_refs` as one recoverable transaction. `loom asset validate` checks this reciprocal link plus hashes and provenance. This records bytes and traceability; Keeper must still check the real target host renders the result.
