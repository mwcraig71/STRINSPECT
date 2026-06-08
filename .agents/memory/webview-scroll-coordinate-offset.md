---
name: iOS WebView canvas touch offset
description: -webkit-overflow-scrolling:touch breaks getBoundingClientRect in scrolled WKWebView containers, offsetting canvas draw coords
---

# Canvas draw coordinates offset by scroll distance in iOS WebView

Symptom in the PDF annotator: a redline drew far *below* the finger, by an
amount equal to how far the page had been scrolled. At scrollTop=0 (top of
page 1) there was no offset; the offset grew with scroll.

**Root cause:** `#scroll-area` had `-webkit-overflow-scrolling: touch`. On iOS
WKWebView this puts the scroll in a composited layer that
`getBoundingClientRect()` of scrolled children does NOT reflect — the canvas
reports its *unscrolled* top. Touch `clientY` is correct, so
`clientY - rect.top` overshoots by the scroll distance.

**Fix:** remove `-webkit-overflow-scrolling: touch` from the scrolling
container. Standard scrolling makes child bounding rects scroll-accurate again,
and the existing `(clientY - rect.top) * (cv.width / rect.width)` math (which is
also correct under CSS `zoom`, since getBoundingClientRect returns the visual
rect) works at any scroll position.

**How to apply:** any draw/annotation canvas inside a scrollable WebView
container must NOT rely on `-webkit-overflow-scrolling: touch` if it maps touch
coords via getBoundingClientRect. The property is the iOS default anyway and
deprecated; declaring it forces the buggy legacy path.
