# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security bugs.**

Use [GitHub private vulnerability reporting](https://github.com/Tora-Build/sooth-sdk/security/advisories/new)
or email `security@tora.build`. Include:

- A description of the vulnerability
- Steps to reproduce or a proof-of-concept
- The potential impact

**Response SLA:**
- Acknowledgment within 72 hours
- Triage decision within 7 days

We will coordinate a fix and disclosure timeline with you privately before
any public announcement.

## Supported versions

Report issues in the code on `main` and in the published `sooth` package.
The published npm `sooth@1.0.0` is SQF-only; current source additionally includes
Factory, CLI and React APIs. The reporting scope includes both surfaces:

- SQF utilities (`sooth`, `sooth/sqf`)
- the Factory protocol SDK (`sooth/factory`)
- the `soothcli` command
- optional React embeds (`sooth/react`)

Other branches and tags are historical. The retired 0.x sooth-core client is
not maintained in this repository.

## Secrets

Do not commit private keys, seed phrases, or RPC URLs that contain API keys.
Environment files, direnv files, and keystores are gitignored. If a secret is
pushed, rotate it. Deleting it from the latest commit does not remove it from
clones of older history.

## Out of scope

- Issues in dependencies (report upstream, cc us if critical)
- Theoretical attacks without demonstrated impact
- Issues requiring physical access to a user's device
