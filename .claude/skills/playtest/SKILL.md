---
name: playtest
description: Build the game standalone and open it in the browser for playtesting
disable-model-invocation: true
---

# Playtest

Build Office Survivors in standalone mode and launch it for testing.

## Steps

1. Run `npm run build:standalone` from the project root
2. If the build fails, report the errors and stop
3. If the build succeeds, run `npx vite preview` to start the preview server
4. Tell the user the local URL to open (usually http://localhost:4173)
5. Remind the user to press Ctrl+C or use `/playtest` again when done testing
