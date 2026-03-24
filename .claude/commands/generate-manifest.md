Generate the SDK manifest for @webex/contact-center.

## What this does

Runs `npx ts-node scripts/generate-manifest.ts` in the contact-center package to produce `sdk-manifest.yaml` — a machine-readable description of the public API surface.

## Steps

1. Navigate to `packages/@webex/contact-center/`
2. Run: `npx ts-node scripts/generate-manifest.ts`
3. Show a summary of what was generated (classes, methods, enums, types)
4. If there are changes vs the previously committed manifest, show the diff with `git diff sdk-manifest.yaml`
5. Remind the developer to commit `sdk-manifest.yaml` alongside their code changes

## When to run

- After changing any public method signature in cc.ts or Task.ts
- After adding/removing/renaming exported types, enums, or constants
- Before creating a PR that touches the public API surface
