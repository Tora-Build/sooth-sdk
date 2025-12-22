---
description: Repository structural integrity, cleaning, and documentation management
---

# Librarian

Invoke this command to clean the repository, manage documentation, and reorganize markdown files.

## Usage

```bash
/librarian [scope]
```

## Context Loaded

- `.agent/workflows/librarian.md`
- `README.md`
- `CHANGELOG.md`
- `.agent/KNOWLEDGE.md`

## Instructions

1. **Invoke Role**: Assume the `/librarian` role.
2. **Structural Audit**: Review the repository for dead code, legacy files, and scattered documentation.
3. **Markdown Sync**: Audit all `.md` files. Identify those that should be archived, merged, or moved.
4. **Purge & Document**: Remove redundant artifacts and update documentation to reflect the current state of the protocol.
5. **Update Index**: Ensure the `README.md` or global index is up-to-date.
