# Chaplin versioning

Chaplin uses the repository commit order as its build-version source of truth.
This makes every committed product change traceable without relying on an
unrecoverable history of push events.

## Numbering rule

- The initial Create Next App scaffold is `v0.0.0`.
- Every later commit advances the version ordinal once.
- Patch rolls after 99: `v0.0.99` becomes `v0.1.0`.
- Minor rolls after 99: `v0.99.99` becomes `v1.0.0`.
- A push containing multiple commits advances once for each committed change.

Examples:

| Commit ordinal | Version |
| ---: | --- |
| 0 | `v0.0.0` |
| 1 | `v0.0.1` |
| 99 | `v0.0.99` |
| 100 | `v0.1.0` |
| 1,203 | `v0.12.3` |
| 10,000 | `v1.0.0` |

## Repository controls

- `version.json` is the canonical product manifest.
- Web package, native package, Expo app, and lockfiles carry the same version.
- `.githooks/pre-commit` calculates and stages the next version automatically.
- `.github/workflows/version.yml` rejects a pushed commit whose version does not
  match its position in the complete Git history.
- `/api/build-info` reports the deployed product version and deployment commit.
- `docs/VERSION_HISTORY.md` maps every historical Chaplin commit to its version.

Install the tracked hook in a new checkout:

```bash
npm run version:install-hooks
```

Useful commands:

```bash
npm run version:current
npm run version:prepare
npm run version:check
npm run version:history
```

`version:prepare` targets the next commit. After that commit exists,
`version:check` verifies the committed ordinal.
