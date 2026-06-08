---
name: pdfAnnotatorHtml is one big template literal
description: Why edits (even comments) to pdfAnnotatorHtml.ts can silently break the Expo bundle
---

The entire annotator UI in `artifacts/bridge-inspection/components/pdfAnnotatorHtml.ts`
is returned as a single backtick-delimited JS template literal (`return \`<!DOCTYPE html>...\`;`).

**Rule:** Any text added inside that string — including HTML/JS/CSS comments — must
NOT contain a backtick (`` ` ``) or an unescaped `${`. A stray backtick closes the
template early and the rest parses as JS, producing a confusing Metro/Babel error
like `SyntaxError: ... Missing semicolon` pointing at a line that is "just a comment".

**Why:** I wrote a code comment `// CSS \`zoom: z\` scales...` inside the annotator JS;
the backtick terminated the template literal and broke the iOS/Android bundle. The
error line pointed at the comment, which looked impossible until you realize it was
being parsed as code.

**How to apply:** When editing this file, prefer plain words ("CSS zoom") over
backtick-quoted code in comments. If you must show code, escape backticks (`` \` ``)
or use single quotes.

**Verifying a fix:** Metro bundles on-demand, so a `restart_workflow` alone may not
re-run the transform — the on-disk log can stay stale. Force a fresh build by curling
the bundle URL: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:<metroPort>/<entry>.bundle?platform=ios&dev=true&minify=false"`.
HTTP 200 = compiles, HTTP 500 = syntax/transform error.
