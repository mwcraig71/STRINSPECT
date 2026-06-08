---
name: bridge API auth model
description: How the api-server protects routes and how the web dashboard authenticates to it.
---

# Bridge API auth model

`api-server` guards routes with a `requireApiKey` middleware (in
`src/routes/sessions.ts`). It checks `Authorization: Bearer <key>` or `x-api-key`
against `process.env.API_KEY`.

**Key behavior:** `requireApiKey` **no-ops when `API_KEY` is unset** — every route
is open in environments without the secret. So "is this route protected?" depends
on the deploy env, not just the code.

## Rule — binary GET endpoints need auth parity with write routes
The PDF/photo download endpoints (`GET /sessions/pdf/:structureNumber`,
`GET /sessions/photos/:structureNumber/:photoId`) serve **sensitive inspection
data addressed by guessable identifiers** (structure number / photo id). They must
carry `requireApiKey` just like the POST/PUT write routes — otherwise anyone can
enumerate and download inspection PDFs/photos.

**Why:** a code review flagged these GETs as broken-access-control; they had been
left intentionally public. Public-by-guessable-id is the bug, not a feature.

**How to apply:** any new endpoint returning stored inspection content gets
`requireApiKey`. Don't "make it readable" for convenience.

## Web dashboard authenticates via the Vite proxy
`bridge-web` never sends the key from browser code. Its `vite.config.ts` proxies
`/api` to the api-server and **injects `Authorization: Bearer ${API_KEY}`** when
`API_KEY` is set. So adding auth to GET endpoints does NOT break the web app — its
requests already carry the token. The mobile app sends the key directly and only
uploads (PUT); it reads PDFs/photos from its local copies, not these GETs.
