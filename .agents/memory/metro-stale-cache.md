---
name: Metro stale-cache phantom syntax errors
description: When Metro reports a SyntaxError on a file that tsc/babel parse fine, it's a stale transform cache — and the real cache dir is not node_modules/.cache.
---

Metro can keep reporting a build SyntaxError (e.g. "Missing semicolon (LINE:COL)") pointing at a line that is actually a *comment* or otherwise valid code, on a file that every parser accepts.

**How to confirm the file is actually fine** (do this before chasing phantom edits):
- `tsc --noEmit` reports zero errors in that file, and
- `@babel/parser`.parse(src, {plugins:['typescript','jsx']}) returns OK.
If both pass, the file is valid and the Metro error is a **stale transform cache**.

**Why:** Metro's persistent FileStore + file-map cache can survive workflow restarts and serve an old broken transform. In this repl the cache is NOT (only) `node_modules/.cache` — it lives in the OS temp dir:
- `/tmp/metro-cache/` (directory)
- `/tmp/metro-file-map-*` (file-map blob)
Clearing `node_modules/.cache` (root + artifact) and `.expo` is NOT enough; Metro recreates `/tmp/metro-cache` on the next failed start, so a single `rm` before a restart can miss it.

**How to apply:** delete `/tmp/metro-cache` and `/tmp/metro-file-map-*` (plus `.expo`, root+artifact `node_modules/.cache`), then restart the expo workflow. Verify the fix by forcing a fresh bundle and checking the HTTP code, not the log (old failure lines persist in the rotated log):
`curl -s -o /tmp/b.txt -w "%{http_code}" "http://localhost:PORT/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false&transform.engine=hermes&transform.routerRoot=app"` → 200 + multi-MB body = success.
