import { PDFJS_INLINE_SCRIPT, PDFJS_WORKER_INLINE_SCRIPT } from "./pdfAnnotatorPdfjsBundled";

export function getPdfAnnotatorHtml(): string {
  // JSON-encode the worker script so it can be embedded safely inside a
  // <script> tag as a JS string variable.  Replace '</' with '<\/' so the
  // HTML parser never sees '</script>' and closes the tag prematurely.
  const workerJson = JSON.stringify(PDFJS_WORKER_INLINE_SCRIPT).replace(/<\//g, "<\\/");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{--topbar-height:48px;--toolbar-height:140px;--android-bottom-offset:0px}
body{background:#1e293b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;height:100vh}
#topbar{position:fixed;top:0;left:0;right:0;z-index:200;height:calc(48px + env(safe-area-inset-top));background:#0f172a;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top) 12px 0;gap:8px}
#page-info{color:#94a3b8;font-size:12px;font-weight:700;flex:1}
.top-btn{background:#1e293b;border:1.5px solid #334155;border-radius:8px;color:#94a3b8;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap}
.top-btn.save{background:#0284c7;border-color:#0369a1;color:#fff}
.ui-icon{width:15px;height:15px;display:block;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#scroll-area{position:absolute;top:var(--topbar-height);bottom:var(--toolbar-height);left:0;right:0;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:auto;touch-action:pan-x pan-y;background:#1e293b}
#scroll-area.drawing{overflow:hidden}
.page-wrap{position:relative;margin:12px auto;display:block;box-shadow:0 4px 24px rgba(0,0,0,.6)}
.pdf-canvas{display:block;width:100%}
.ann-canvas{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}
.ann-canvas.draw-active{cursor:crosshair;touch-action:none;pointer-events:auto}
#toolbar{position:fixed;bottom:var(--android-bottom-offset);left:0;right:0;z-index:200;background:#0f172a;border-top:1px solid #334155;padding:8px 10px calc(12px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:7px}
#tool-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.zoom-group{display:flex;gap:6px;align-items:center;margin-left:auto;flex-shrink:0}
#zoom-label{color:#94a3b8;font-size:12px;font-weight:700;padding:0 2px;min-width:38px;text-align:center;flex-shrink:0}
#opt-dynamic{display:contents}
.tbtn{background:#1e293b;border:1.5px solid #334155;border-radius:10px;color:#94a3b8;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;-webkit-user-select:none;user-select:none}
.tbtn.active{border-color:#38bdf8;color:#38bdf8;background:rgba(56,189,248,.1)}
.auto-note-toggle{min-height:32px;display:flex;align-items:center;gap:4px;padding:0 6px;border:1.5px solid #334155;border-radius:7px;background:#1e293b;color:#94a3b8;font-size:9px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;-webkit-user-select:none;user-select:none}
.auto-note-toggle:has(input:checked){border-color:#38bdf8;color:#38bdf8;background:rgba(56,189,248,.1)}
.auto-note-toggle input{width:17px;height:17px;accent-color:#38bdf8;margin:0}
.clr-dot{width:44px;height:44px;min-width:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;padding:0;appearance:none;flex-shrink:0;transition:transform .1s}
.clr-dot.active{border-color:#fff;transform:scale(1.25)}
.sz-btn{background:#1e293b;border:1.5px solid #334155;border-radius:8px;color:#94a3b8;min-width:48px;min-height:44px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-user-select:none;user-select:none}
.sz-btn.active{border-color:#38bdf8;color:#38bdf8}
.sep{width:1px;background:#334155;height:20px;flex-shrink:0;margin:0 2px}
#loading{position:fixed;inset:0;background:#0f172a;z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.spinner{width:40px;height:40px;border:3px solid #334155;border-top-color:#38bdf8;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#load-txt{color:#94a3b8;font-size:13px;font-weight:600}
#err-txt{display:none;color:#f87171;font-size:13px;text-align:center;padding:0 24px;max-width:300px}
#text-input-wrap{display:none;position:fixed;z-index:300;background:#1e293b;border:2px solid #38bdf8;border-radius:8px;padding:6px}
#text-input{background:transparent;border:none;outline:none;font-size:16px;color:#fff;min-width:120px;max-width:220px}
#shortcuts-row{display:flex;flex-wrap:wrap;gap:5px;align-items:center;min-height:34px;padding:2px 0}
.sc-chip{background:#1e293b;border:1.5px solid #4c1d95;border-radius:16px;color:#c4b5fd;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;-webkit-user-select:none;user-select:none}
.sc-chip:active{opacity:.65}
#btn-sc-browse{background:#7c3aed;border:none;border-radius:16px;color:#fff;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;-webkit-user-select:none;user-select:none}
#sc-suggest{display:none;position:fixed;z-index:302;bottom:var(--toolbar-height);left:0;right:0;background:#0f172a;border-top:1px solid #7c3aed;flex-direction:row;gap:6px;padding:5px 8px;overflow-x:auto}
#sc-suggest::-webkit-scrollbar{display:none}
.sc-sug{background:#1e293b;border:1px solid #7c3aed;border-radius:8px;color:#c4b5fd;padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0}
.sc-sug:active{opacity:.65}
#sc-modal{position:fixed;inset:0;z-index:500;background:#0f172a;flex-direction:column;display:none}
#sc-modal-hdr{padding:12px 12px 8px;border-bottom:1px solid #334155;display:flex;gap:8px;align-items:center;padding-top:calc(12px + env(safe-area-inset-top))}
#sc-search{flex:1;background:#1e293b;border:1.5px solid #334155;border-radius:8px;color:#fff;padding:7px 10px;font-size:13px;outline:none}
#sc-search::placeholder{color:#475569}
#sc-close-btn{background:#1e293b;border:1.5px solid #334155;border-radius:8px;color:#94a3b8;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0}
#sc-modal-body{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:4px;padding-bottom:calc(16px + env(safe-area-inset-bottom))}
.sc-cat-hdr{color:#475569;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:12px 0 4px}
.sc-cat-hdr:first-child{padding-top:4px}
.sc-item{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;cursor:pointer}
.sc-item:active{opacity:.7}
.sc-item-txt{color:#e2e8f0;font-size:13px;line-height:1.45;flex:1}
.sc-star{background:none;border:none;font-size:18px;cursor:pointer;flex-shrink:0;padding:0 2px;line-height:1;color:#475569}
.sc-star.starred{color:#f59e0b}
.sc-empty{color:#475569;font-size:13px;text-align:center;padding:40px 0}
</style>
</head>
<body>
<script>
if (/Android/i.test(navigator.userAgent)) {
  document.documentElement.style.setProperty('--android-bottom-offset', '48px');
}
</script>

<div id="loading">
  <div class="spinner"></div>
  <div id="load-txt">Loading PDF viewer\u2026</div>
  <div id="err-txt"></div>
</div>

<div id="topbar" style="display:none">
  <span id="page-info">Page 1 of ?</span>
  <div style="display:flex;gap:6px">
    <button class="top-btn" id="btn-export" aria-label="Export annotation text"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>Export</button>
    <button class="top-btn save" id="btn-save" aria-label="Save annotations"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>Save</button>
    <button class="top-btn" id="btn-close" aria-label="Close annotator"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>Close</button>
  </div>
</div>

<div id="scroll-area"><div id="zoom-wrap"></div></div>

<div id="toolbar" style="display:none">
  <div id="tool-row">
    <button class="tbtn active" id="btn-pan"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10V5a2 2 0 0 0-4 0v9"/><path d="M6 10a2 2 0 0 0-4 0v4c0 4.4 3.6 8 8 8h2a8 8 0 0 0 8-8v-3a2 2 0 0 0-4 0v1"/></svg>Pan</button>
    <button class="tbtn" id="btn-pen"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 19 7-7 3 3-7 7-4 1 1-4z"/><path d="m18 13-3-3"/><path d="M2 22h6"/></svg>Pen</button>
    <button class="tbtn" id="btn-highlight"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 6-4-4L8 12l4 4L22 6z"/><path d="M2 22h20"/></svg>HL</button>
    <button class="tbtn" id="btn-text">T&nbsp;Text</button>
    <button class="tbtn" id="btn-undo"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/></svg>Undo</button>
    <label class="auto-note-toggle" title="Automatically open a note after a highlight">
      <input type="checkbox" id="auto-note-highlight">
      <span>HL note</span>
    </label>
    <label class="auto-note-toggle" title="Automatically open a note after a pen stroke">
      <input type="checkbox" id="auto-note-pen">
      <span>Pen note</span>
    </label>
    <div id="opt-dynamic"></div>
    <div class="zoom-group">
      <button class="tbtn" id="btn-zoom-out" aria-label="Zoom out"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
      <span id="zoom-label">100%</span>
      <button class="tbtn" id="btn-zoom-in" aria-label="Zoom in"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button>
    </div>
  </div>
  <div id="shortcuts-row"></div>
</div>

<div id="sc-modal">
  <div id="sc-modal-hdr">
    <input id="sc-search" type="search" placeholder="Search shortcuts&#x2026;" autocomplete="off" autocorrect="off" spellcheck="false">
    <button id="sc-close-btn">Done</button>
  </div>
  <div id="sc-modal-body"></div>
</div>

<div id="sc-suggest"></div>
<div id="text-input-wrap">
  <input id="text-input" placeholder="Type here\u2026" autocomplete="off" autocorrect="off" spellcheck="false">
</div>

<!-- PDF.js bundled locally — no network dependency.
     The first <script> sets up globalThis.pdfjsLib (main pdf.js API).
     The second stores the worker script as a JS string (__pdfWorkerSrc__);
     the main init block then creates a Blob URL from it so pdf.js spawns a
     real Web Worker without needing any network fetch. -->
<script>
${PDFJS_INLINE_SCRIPT}
</script>
<script>var __pdfWorkerSrc__=${workerJson};</script>

<script>
/* ── UI helpers (defined first so they are available throughout) ── */
function showError(msg) {
  var s = document.querySelector('.spinner');
  if (s) s.style.display = 'none';
  var l = document.getElementById('load-txt');
  if (l) l.style.display = 'none';
  var e = document.getElementById('err-txt');
  if (e) { e.style.display = 'block'; e.textContent = msg; }
}

function setLoadTxt(t) {
  var el = document.getElementById('load-txt');
  if (el) el.textContent = t;
}

function syncViewportLayout() {
  var root = document.documentElement;
  var topbar = document.getElementById('topbar');
  var toolbar = document.getElementById('toolbar');
  var topbarVisible = topbar && topbar.style.display !== 'none';
  var toolbarVisible = toolbar && toolbar.style.display !== 'none';
  root.style.setProperty('--topbar-height', (topbarVisible ? topbar.offsetHeight : 0) + 'px');
  root.style.setProperty('--toolbar-height', (toolbarVisible ? toolbar.offsetHeight : 0) + 'px');
}

window.addEventListener('resize', syncViewportLayout);
if (window.visualViewport) window.visualViewport.addEventListener('resize', syncViewportLayout);

function showUI() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('topbar').style.display = 'flex';
  document.getElementById('toolbar').style.display = 'flex';
  document.getElementById('page-info').textContent = 'Page 1 of ' + pageCount;
  syncViewportLayout();
  if (window.requestAnimationFrame) window.requestAnimationFrame(syncViewportLayout);
}

/* ── Initialise PDF.js from bundled global ── */
/* globalThis and window can diverge in WKWebView; check both */
var pdfjsLib = window.pdfjsLib || globalThis.pdfjsLib;
if (!pdfjsLib) {
  showError('PDF viewer failed to initialise. Please close and try again.');
} else {
  // Pre-register the fake-worker handler. Some Android production WebViews
  // accept a Blob worker URL but reject the worker asynchronously; PDF.js then
  // needs globalThis.pdfjsWorker.WorkerMessageHandler for its fallback.
  // Function scope prevents internal declarations in the worker and main
  // bundles from colliding while still publishing globalThis.pdfjsWorker.
  try { Function(__pdfWorkerSrc__)(); } catch (_) {}
  // pdf.js throws "No workerSrc specified" for any falsy value, including ''.
  // Create a blob URL from the embedded worker script so pdf.js gets a real,
  // non-empty URL and spins a proper Web Worker (WKWebView iOS 16+ supports
  // blob worker URLs; Android WebView has supported them since v60).
  try {
    var _wBlob = new Blob([__pdfWorkerSrc__], { type: 'application/javascript' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(_wBlob);
  } catch (_wErr) {
    // Blob URL unavailable — the handler above supplies the in-thread worker.
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'worker.js';
  }
}

/* ── State ── */
var tool = 'pan';
var penColor = '#ef4444';
var penSize = 4;
var highlightSize = 16;
var highlightColor = '#facc15';
var annotations = [];
var initialAnnotationCount = 0;
var isDirty = false;
var currentStroke = null;
var autoNoteAfterHighlight = false;
var autoNoteAfterPen = false;
var pdfDoc = null;
var pageCount = 0;
var pageCanvases = {};
var pageDimensions = {}; // keyed by page number → {w, h} canvas pixel dimensions
var pageLayout = {}; // keyed by page number → un-zoomed {top, left, w, h} layout offsets within #scroll-area
var isDrawing = false;
var activeCv = null;
var pdfInitStarted = false;
var textPendingPage = 0;
var textPendingX = 0;
var textPendingY = 0;

var COLORS_PEN = ['#ef4444','#2563eb'];
var COLORS_HIGHLIGHT = ['#facc15','#86efac','#f9a8d4'];
var SIZES = [2,4,8];
var HIGHLIGHT_SIZES = [8,16,26];
var zoomLevel = 1.0;
var ZOOM_STEPS = [0.5,0.75,1.0,1.25,1.5,2.0,2.5,3.0];
var annScale = 1; // hi-res supersample factor for the annotation canvas (matches RENDER_SCALE)

/* ── Shortcuts state ── */
var scList = [];
var scFavorites = [];
var scInsertIdx = 0;

/* ── RN bridge ── */
function postRN(msg) {
  try {
    var data = JSON.stringify(msg);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(data);
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage(data, '*');
    }
  } catch(e) {}
}

document.getElementById('btn-save').onclick = function() {
  postRN({ type:'save', annotations: annotations, pageDimensions: pageDimensions });
  isDirty = false;
};

document.getElementById('btn-close').onclick = function() {
  if (isDirty) {
    postRN({ type: 'confirm-close' });
  } else {
    postRN({ type:'close' });
  }
};

function doExportText() {
  var byPage = {};
  for (var i = 0; i < annotations.length; i++) {
    var a = annotations[i];
    if (a.type === 'text' && a.text) {
      if (!byPage[a.page]) byPage[a.page] = [];
      byPage[a.page].push(a);
    }
  }
  var pages = Object.keys(byPage).map(function(p){ return parseInt(p,10); }).sort(function(x,y){ return x - y; });
  if (pages.length === 0) { postRN({ type:'export-empty' }); return; }
  var lines = [];
  pages.forEach(function(p) {
    lines.push('Page ' + p + ':');
    byPage[p].sort(function(a,b){ return (a.y - b.y) || (a.x - b.x); });
    byPage[p].forEach(function(a){ lines.push('  ' + a.text); });
    lines.push('');
  });
  postRN({ type:'export-text', text: lines.join('\\n') });
}

document.getElementById('btn-export').onclick = function() {
  // If a text annotation is mid-edit, its value is only committed on blur
  // (deferred 100ms). Blur first and wait so the latest text is included.
  var wrap = document.getElementById('text-input-wrap');
  if (wrap && wrap.style.display === 'block') {
    document.getElementById('text-input').blur();
    setTimeout(doExportText, 180);
    return;
  }
  doExportText();
};

document.getElementById('btn-pan').onclick = function() { setTool('pan'); };
document.getElementById('btn-pen').onclick = function() { setTool('pen'); };
document.getElementById('btn-highlight').onclick = function() { setTool('highlight'); };
document.getElementById('btn-text').onclick = function() { setTool('text'); };
document.getElementById('btn-undo').onclick = undoLast;
document.getElementById('auto-note-highlight').onchange = function() { autoNoteAfterHighlight = this.checked; };
document.getElementById('auto-note-pen').onchange = function() { autoNoteAfterPen = this.checked; };
document.getElementById('btn-zoom-in').onclick = zoomIn;
document.getElementById('btn-zoom-out').onclick = zoomOut;

/* ── Receive init message ── */
function onMsg(e) {
  var raw = (typeof e.data === 'string') ? e.data : null;
  if (!raw) return;
  var data;
  try { data = JSON.parse(raw); } catch(err) { return; }
  if (data && data.type === 'init') {
    if (pdfInitStarted) return;
    pdfInitStarted = true;
    if (Array.isArray(data.annotations) && data.annotations.length > 0) {
      annotations = data.annotations;
      initialAnnotationCount = annotations.length;
    }
    if (Array.isArray(data.shortcuts)) {
      scList = data.shortcuts;
      scFavorites = Array.isArray(data.scFavorites) ? data.scFavorites : [];
      renderShortcutsRow();
    }
    loadPdf(data.pdfUri || data.pdfBase64);
  }
}
window.addEventListener('message', onMsg);
document.addEventListener('message', onMsg);

/* ── Load and render PDF (data: URI on web, local file:// URI on native) ── */
async function loadPdf(pdfUri) {
  if (!pdfjsLib) { showError('PDF.js not available.'); return; }
  try {
    setLoadTxt('Decoding PDF\u2026');
    var resp = await fetch(pdfUri);
    if (!resp.ok && typeof resp.status !== 'undefined' && resp.status !== 0) {
      throw new Error('Could not open PDF file (' + resp.status + ').');
    }
    var buf = await resp.arrayBuffer();
    setLoadTxt('Rendering pages\u2026');
    pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    pageCount = pdfDoc.numPages;
    await renderAllPages();
    replayAnnotations();
    showUI();
    observePages();
  } catch(e) {
    showError('Could not render PDF: ' + (e && e.message ? e.message : String(e)));
  }
}

async function renderAllPages() {
  var area = document.getElementById('scroll-area');
  var zoomWrap = document.getElementById('zoom-wrap');
  zoomWrap.innerHTML = '';
  var vw = area.clientWidth || window.innerWidth;
  // Render the PDF bitmap at a higher pixel density than its on-screen size so
  // text stays sharp when magnified with CSS zoom (max 3x). Fewer pages can
  // afford a higher factor; cap memory on long documents.
  var RENDER_SCALE = pageCount > 6 ? 2 : 3;
  annScale = RENDER_SCALE;
  for (var pn = 1; pn <= pageCount; pn++) {
    setLoadTxt('Rendering page ' + pn + ' of ' + pageCount + '\u2026');
    var page = await pdfDoc.getPage(pn);
    var baseVp = page.getViewport({ scale: 1 });
    var scale = (vw - 4) / baseVp.width;
    var vp = page.getViewport({ scale: scale });        // on-screen (CSS) size
    var rvp = page.getViewport({ scale: scale * RENDER_SCALE }); // hi-res bitmap

    var wrap = document.createElement('div');
    wrap.className = 'page-wrap';
    wrap.style.width = vp.width + 'px';
    wrap.style.height = vp.height + 'px';
    wrap.dataset.page = pn;

    var pdfCv = document.createElement('canvas');
    pdfCv.className = 'pdf-canvas';
    pdfCv.width = rvp.width;
    pdfCv.height = rvp.height;

    var annCv = document.createElement('canvas');
    annCv.className = 'ann-canvas';
    // Hi-res backing (same density as the PDF bitmap) keeps drawn ink and text
    // crisp under CSS zoom; CSS width/height:100% displays it at the page's
    // on-screen size. Drawing coordinates stay in CSS (vp) space — the context
    // is scaled by annScale at draw time (see redrawPage).
    annCv.width = rvp.width;
    annCv.height = rvp.height;
    annCv.dataset.page = pn;

    wrap.appendChild(pdfCv);
    wrap.appendChild(annCv);
    zoomWrap.appendChild(wrap);
    pageCanvases[pn] = { pdf: pdfCv, ann: annCv };
    pageDimensions[pn] = { w: vp.width, h: vp.height };
    // Capture the page's layout offsets while un-zoomed (zoomLevel is 1.0 during
    // initial render). These stable, reliable values let canvasPoint() compute
    // touch coordinates without ever reading the scrolled/zoomed child's own
    // getBoundingClientRect, which is unreliable on iOS WKWebView under CSS zoom.
    pageLayout[pn] = { top: wrap.offsetTop, left: wrap.offsetLeft, w: wrap.offsetWidth, h: wrap.offsetHeight };

    var ctx = pdfCv.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: rvp }).promise;
    wireCanvas(annCv, pn);
  }
}

/* ── Canvas event wiring ── */
function wireCanvas(cv, pn) {
  cv.addEventListener('pointerdown', function(e) { onDown(e, cv, pn); });
  cv.addEventListener('pointermove', function(e) { onMove(e, cv, pn); });
  cv.addEventListener('pointerup', function(e) { onUp(e, cv, pn); });
  cv.addEventListener('pointercancel', function() { isDrawing = false; currentStroke = null; activeCv = null; });
}

function canvasPoint(e, cv) {
  // Compute the canvas-buffer point purely from values that are reliable on iOS
  // WKWebView at ANY zoom level:
  //   - #scroll-area's own bounding rect (the container is never zoomed/scrolled
  //     in a composited layer, so its rect is accurate)
  //   - area.scrollTop / scrollLeft (always in visual px)
  //   - the page's layout offset captured at render time while un-zoomed
  //   - zoomLevel, which we control directly
  // CSS zoom scales the whole content uniformly, so a page captured at
  // un-zoomed top T sits at visual top (T * z) within the scroll content. We
  // never read the scrolled/zoomed child's getBoundingClientRect, which is what
  // produced wrong coordinates (stroke offset below the finger; wrong place when
  // zoomed) on iOS WKWebView.
  var area = document.getElementById('scroll-area');
  var pn = parseInt(cv.dataset.page, 10);
  var L = pageLayout[pn];
  if (area && L && L.w > 0 && L.h > 0) {
    var ar = area.getBoundingClientRect();
    var z = zoomLevel || 1;
    var vx = (e.clientX - ar.left) + area.scrollLeft - L.left * z; // visual px from canvas left
    var vy = (e.clientY - ar.top) + area.scrollTop - L.top * z;    // visual px from canvas top
    // Return CSS (vp) logical coordinates; the annotation context is scaled by
    // annScale at draw time, so coords stay independent of the hi-res backing.
    return [vx / z, vy / z];
  }
  // Fallback (layout not captured yet): rect-based mapping to CSS (vp) space.
  var r = cv.getBoundingClientRect();
  var pd = pageDimensions[parseInt(cv.dataset.page, 10)] || { w: r.width, h: r.height };
  var sx = pd.w / r.width;
  var sy = pd.h / r.height;
  return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
}

function onDown(e, cv, pn) {
  if (tool === 'pan') return;
  e.preventDefault();
  cv.setPointerCapture(e.pointerId);
  isDrawing = true;
  activeCv = cv;
  var pt = canvasPoint(e, cv);

  if (tool === 'text') {
    isDrawing = false;
    textPendingPage = pn;
    textPendingX = pt[0];
    textPendingY = pt[1];
    var hitIdx = findTextAnnotation(pn, pt[0], pt[1]);
    showTextInput(e.clientX, e.clientY, pn, '', hitIdx);
    return;
  }

  currentStroke = {
    type: tool === 'highlight' ? 'highlight' : 'stroke',
    page: pn,
    color: tool === 'highlight' ? highlightColor : penColor,
    // Redline strokes are drawn 75% thinner than the selected S/M/L weight.
    width: tool === 'highlight' ? highlightSize : penSize * 0.25,
    points: [pt]
  };
}

function onMove(e, cv, pn) {
  if (!isDrawing || !currentStroke || tool === 'pan') return;
  e.preventDefault();
  var targetPn = currentStroke.page;
  var targetCv = activeCv || cv;
  var pt = canvasPoint(e, targetCv);
  currentStroke.points.push(pt);
  redrawPage(targetPn);
  drawStroke(pageCanvases[targetPn].ann.getContext('2d'), currentStroke);
}

function onUp(e, cv, pn) {
  if (!isDrawing || !currentStroke) { isDrawing = false; activeCv = null; return; }
  isDrawing = false;
  var targetPn = currentStroke.page;
  var targetCv = activeCv || cv;
  var completedStroke = Object.assign({}, currentStroke, { points: currentStroke.points.slice() });
  if (currentStroke.points.length > 0) {
    annotations.push(completedStroke);
    isDirty = true;
  }
  currentStroke = null;
  activeCv = null;
  redrawPage(targetPn);
  if (
    completedStroke.points.length > 0 &&
    ((completedStroke.type === 'highlight' && autoNoteAfterHighlight) ||
      (completedStroke.type === 'stroke' && autoNoteAfterPen))
  ) {
    showAutoNoteForStroke(completedStroke, targetCv);
  }
}

function findTextAnnotation(page, ptX, ptY) {
  var hitRadius = 50;
  for (var i = annotations.length - 1; i >= 0; i--) {
    var a = annotations[i];
    if (a.type !== 'text' || a.page !== page) continue;
    if (Math.abs(ptX - a.x) < hitRadius && Math.abs(ptY - a.y) < hitRadius) return i;
  }
  return -1;
}

function showAutoNoteForStroke(stroke, cv) {
  var pts = stroke.points || [];
  if (!cv || pts.length === 0) return;
  var pd = pageDimensions[stroke.page] || { w: cv.clientWidth, h: cv.clientHeight };
  var minX = pts[0][0], maxX = pts[0][0], minY = pts[0][1], maxY = pts[0][1];
  for (var i = 1; i < pts.length; i++) {
    minX = Math.min(minX, pts[i][0]);
    maxX = Math.max(maxX, pts[i][0]);
    minY = Math.min(minY, pts[i][1]);
    maxY = Math.max(maxY, pts[i][1]);
  }
  var gap = 14;
  var noteX = maxX + gap;
  var noteY = minY + 18;
  var rect = cv.getBoundingClientRect();
  var sx = rect.width / pd.w;
  var sy = rect.height / pd.h;
  var screenX = rect.left + noteX * sx;
  var screenY = rect.top + minY * sy;
  var inputWidth = 250;
  var inputHeight = 52;
  if (screenX + inputWidth > window.innerWidth - 8) {
    noteX = minX;
    noteY = maxY + 24;
    screenX = rect.left + noteX * sx;
    screenY = rect.top + maxY * sy + gap;
  }
  noteX = Math.max(8, Math.min(noteX, pd.w - 120));
  noteY = Math.max(18, Math.min(noteY, pd.h - 8));
  screenX = Math.max(8, Math.min(screenX, window.innerWidth - inputWidth - 8));
  screenY = Math.max(8, Math.min(screenY, window.innerHeight - inputHeight - 8));
  textPendingPage = stroke.page;
  textPendingX = noteX;
  textPendingY = noteY;
  showTextInput(screenX, screenY, stroke.page, '', -1);
}

/* ── Text input overlay ── */
function showTextInput(clientX, clientY, pn, preText, editIdx) {
  var wrap = document.getElementById('text-input-wrap');
  var inp = document.getElementById('text-input');
  var x = Math.min(clientX, window.innerWidth - 250);
  var y = Math.min(clientY, window.innerHeight - 60);
  wrap.style.left = x + 'px';
  wrap.style.top = y + 'px';
  wrap.style.display = 'block';
  inp.value = (editIdx >= 0 && annotations[editIdx]) ? annotations[editIdx].text : (preText || '');
  if (inp.value) { inp.select(); }
  inp.focus();
  var cancelled = false;

  function commit() {
    if (cancelled) return;
    var txt = inp.value.trim();
    wrap.style.display = 'none';
    inp.removeEventListener('keydown', onKey);
    inp.removeEventListener('blur', onBlur);
    if (editIdx >= 0 && annotations[editIdx] !== undefined) {
      if (txt) { annotations[editIdx].text = txt; } else { annotations.splice(editIdx, 1); }
      isDirty = true;
      redrawPage(textPendingPage);
    } else if (txt) {
      annotations.push({ type:'text', page: textPendingPage, x: textPendingX, y: textPendingY, text: txt, fontSize: (penSize * 4 + 10) * 0.25, color: penColor });
      isDirty = true;
      redrawPage(textPendingPage);
    }
  }

  function onKey(e) { if (e.key === 'Enter') { commit(); } if (e.key === 'Escape') { cancelled = true; wrap.style.display = 'none'; inp.removeEventListener('keydown', onKey); inp.removeEventListener('blur', onBlur); } }
  function onBlur() { setTimeout(commit, 100); }
  inp.addEventListener('keydown', onKey);
  inp.addEventListener('blur', onBlur);
}

/* ── Drawing ── */
function drawStroke(ctx, ann) {
  var pts = ann.points;
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = ann.color;
  ctx.lineWidth = ann.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (ann.type === 'highlight') ctx.globalAlpha = 0.38;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length - 1; i++) {
    var mx = (pts[i][0] + pts[i+1][0]) / 2;
    var my = (pts[i][1] + pts[i+1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.lineTo(pts[pts.length-1][0], pts[pts.length-1][1]);
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx, ann) {
  ctx.save();
  ctx.fillStyle = ann.color || '#ef4444';
  ctx.font = 'bold ' + (ann.fontSize || 18) + 'px -apple-system,sans-serif';
  ctx.fillText(ann.text, ann.x, ann.y);
  ctx.restore();
}

function redrawPage(pn) {
  var cs = pageCanvases[pn];
  if (!cs) return;
  var ctx = cs.ann.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cs.ann.width, cs.ann.height);
  // Scale the context so annotations authored in CSS (vp) coordinates render at
  // the hi-res backing resolution. Transform persists for the live-draw path in
  // onMove, which draws onto this same context right after redrawPage.
  ctx.setTransform(annScale, 0, 0, annScale, 0, 0);
  for (var i = 0; i < annotations.length; i++) {
    var ann = annotations[i];
    if (ann.page !== pn) continue;
    if (ann.type === 'text') drawText(ctx, ann);
    else drawStroke(ctx, ann);
  }
}

function replayAnnotations() {
  var pages = {};
  for (var i = 0; i < annotations.length; i++) pages[annotations[i].page] = true;
  Object.keys(pages).forEach(function(p) { redrawPage(parseInt(p,10)); });
}

/* ── Zoom ── */
// Keep the content under the viewport center fixed across a zoom change so the
// view does not jump to a different page. CSS zoom scales the scroll content
// uniformly, so a point at un-zoomed offset O sits at visual offset O*z.
function applyZoom(prevZoom) {
  var area = document.getElementById('scroll-area');
  var pz = prevZoom || zoomLevel || 1;
  var vh = area.clientHeight, vw = area.clientWidth;
  var cy = (area.scrollTop + vh / 2) / pz;  // un-zoomed content offset at viewport center
  var cx = (area.scrollLeft + vw / 2) / pz;
  document.getElementById('zoom-wrap').style.zoom = zoomLevel;
  document.getElementById('zoom-label').textContent = Math.round(zoomLevel * 100) + '%';
  area.scrollTop = cy * zoomLevel - vh / 2;
  area.scrollLeft = cx * zoomLevel - vw / 2;
}
function applyZoomAt(nextZoom, clientX, clientY) {
  var area = document.getElementById('scroll-area');
  var rect = area.getBoundingClientRect();
  var pz = zoomLevel || 1;
  var cx = (area.scrollLeft + clientX - rect.left) / pz;
  var cy = (area.scrollTop + clientY - rect.top) / pz;
  zoomLevel = nextZoom;
  document.getElementById('zoom-wrap').style.zoom = zoomLevel;
  document.getElementById('zoom-label').textContent = Math.round(zoomLevel * 100) + '%';
  area.scrollLeft = cx * zoomLevel - (clientX - rect.left);
  area.scrollTop = cy * zoomLevel - (clientY - rect.top);
}
function zoomIn() {
  for (var i = 0; i < ZOOM_STEPS.length; i++) {
    if (ZOOM_STEPS[i] > zoomLevel + 0.01) { var p = zoomLevel; zoomLevel = ZOOM_STEPS[i]; applyZoom(p); return; }
  }
}
function zoomOut() {
  for (var i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < zoomLevel - 0.01) { var p = zoomLevel; zoomLevel = ZOOM_STEPS[i]; applyZoom(p); return; }
  }
}

/* ── Tablet pinch zoom ── */
var pinchStartDistance = 0;
var pinchStartZoom = 1;
var pinchActive = false;
function touchDistance(t1, t2) {
  var dx = t1.clientX - t2.clientX;
  var dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
function touchMidpoint(t1, t2) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}
function applyPinchZoom(e) {
  if (!pinchActive || !e.touches || e.touches.length < 2) return;
  e.preventDefault();
  var distance = touchDistance(e.touches[0], e.touches[1]);
  if (!pinchStartDistance) return;
  var nextZoom = Math.max(0.5, Math.min(3.0, pinchStartZoom * distance / pinchStartDistance));
  var mid = touchMidpoint(e.touches[0], e.touches[1]);
  applyZoomAt(nextZoom, mid.x, mid.y);
}
function beginPinch(e) {
  if (!e.touches || e.touches.length !== 2) return;
  e.preventDefault();
  pinchActive = true;
  pinchStartDistance = touchDistance(e.touches[0], e.touches[1]);
  pinchStartZoom = zoomLevel;
  isDrawing = false;
  currentStroke = null;
  activeCv = null;
}
function endPinch(e) {
  if (!e.touches || e.touches.length < 2) {
    pinchActive = false;
    pinchStartDistance = 0;
  }
}
var zoomTouchArea = document.getElementById('scroll-area');
zoomTouchArea.addEventListener('touchstart', beginPinch, { passive: false });
zoomTouchArea.addEventListener('touchmove', applyPinchZoom, { passive: false });
zoomTouchArea.addEventListener('touchend', endPinch, { passive: false });
zoomTouchArea.addEventListener('touchcancel', endPinch, { passive: false });

/* ── Undo ── */
function undoLast() {
  if (annotations.length === 0) return;
  var last = annotations.pop();
  isDirty = annotations.length !== initialAnnotationCount;
  redrawPage(last.page);
}

/* ── Tool switching ── */
function setTool(t) {
  tool = t;
  // Text supports only Medium/Large; bump up if a thinner pen size was active.
  if (t === 'text' && penSize < 4) penSize = 4;
  var ids = ['pan','pen','highlight','text'];
  for (var i = 0; i < ids.length; i++) {
    var b = document.getElementById('btn-' + ids[i]);
    if (b) { if (ids[i] === t) b.classList.add('active'); else b.classList.remove('active'); }
  }
  var area = document.getElementById('scroll-area');
  if (t !== 'pan') area.classList.add('drawing'); else area.classList.remove('drawing');
  var cvs = document.querySelectorAll('.ann-canvas');
  for (var j = 0; j < cvs.length; j++) {
    if (t !== 'pan') cvs[j].classList.add('draw-active'); else cvs[j].classList.remove('draw-active');
  }
  renderOptRow();
}

/* ── Options row ── */
function renderOptRow() {
  var row = document.getElementById('opt-dynamic');
  row.innerHTML = '';
  if (tool === 'pan') { syncViewportLayout(); return; }

  if (tool === 'highlight') {
    COLORS_HIGHLIGHT.forEach(function(c) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'clr-dot' + (c === highlightColor ? ' active' : '');
      d.style.background = c;
      d.style.border = '2px solid ' + (c === highlightColor ? '#fff' : 'transparent');
      d.setAttribute('aria-label', 'Highlighter color ' + c);
      d.title = 'Highlighter color';
      d.onclick = function() { highlightColor = c; renderOptRow(); };
      row.appendChild(d);
    });
  } else {
    COLORS_PEN.forEach(function(c) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'clr-dot' + (c === penColor ? ' active' : '');
      d.style.background = c;
      d.style.border = '2px solid ' + (c === penColor ? '#fff' : 'transparent');
      d.setAttribute('aria-label', 'Pen color ' + c);
      d.onclick = function() { penColor = c; renderOptRow(); };
      row.appendChild(d);
    });
  }

  var sep = document.createElement('div');
  sep.className = 'sep';
  row.appendChild(sep);

  // Text offers only Medium and Large. Highlighter gets wider S/M/L weights
  // than pen strokes so the translucent mark reads as a highlight.
  var sizeDefs = (tool === 'text')
    ? [{ s:4, label:'M', title:'Medium font' }, { s:8, label:'L', title:'Large font' }]
    : (tool === 'highlight')
      ? [{ s:8, label:'S', title:'Small highlighter' }, { s:16, label:'M', title:'Medium highlighter' }, { s:26, label:'L', title:'Large highlighter' }]
      : [{ s:2, label:'S', title:'Thin line' }, { s:4, label:'M', title:'Medium line' }, { s:8, label:'L', title:'Thick line' }];
  sizeDefs.forEach(function(def) {
    var selectedSize = tool === 'highlight' ? highlightSize : penSize;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sz-btn' + (def.s === selectedSize ? ' active' : '');
    b.textContent = def.label;
    b.title = def.title;
    b.setAttribute('aria-label', def.title);
    b.onclick = function() {
      if (tool === 'highlight') highlightSize = def.s;
      else penSize = def.s;
      renderOptRow();
    };
    row.appendChild(b);
  });
  syncViewportLayout();
}

function observePages() {
  if (!window.IntersectionObserver) return;
  var obs = new IntersectionObserver(function(entries) {
    var best = null, bestR = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].intersectionRatio > bestR) { bestR = entries[i].intersectionRatio; best = entries[i]; }
    }
    if (best && best.target.dataset.page) {
      document.getElementById('page-info').textContent = 'Page ' + best.target.dataset.page + ' of ' + pageCount;
    }
  }, { threshold: [0,.25,.5,.75,1] });
  document.querySelectorAll('.page-wrap').forEach(function(el) { obs.observe(el); });
}

renderOptRow();

/* ── Shortcuts ── */
function insertShortcutText(text) {
  var infoEl = document.getElementById('page-info');
  var pn = 1;
  if (infoEl) {
    var m = infoEl.textContent.match(/Page (\d+)/);
    if (m) pn = parseInt(m[1], 10);
  }
  var pd = pageDimensions[pn] || { w: 600, h: 800 };
  var area = document.getElementById('scroll-area');
  var L = pageLayout[pn];
  var z = zoomLevel || 1;
  var cx, cy;
  if (L && area) {
    var visTop = (area.scrollTop / z) - L.top;
    cy = Math.max(40, visTop + 50 + scInsertIdx * 30);
    cx = 24;
  } else {
    cy = 60 + scInsertIdx * 30;
    cx = 24;
  }
  cy = Math.min(cy, pd.h - 30);
  cx = Math.min(cx, pd.w - 100);
  var fontSize = (penSize * 4 + 10) * 0.25;
  annotations.push({ type: 'text', page: pn, x: cx, y: cy, text: text, fontSize: fontSize, color: penColor });
  isDirty = true;
  scInsertIdx = (scInsertIdx + 1) % 12;
  redrawPage(pn);
}

function toggleFavorite(id) {
  var idx = scFavorites.indexOf(id);
  if (idx >= 0) {
    scFavorites = scFavorites.filter(function(f) { return f !== id; });
  } else {
    scFavorites = scFavorites.concat([id]);
  }
  postRN({ type: 'sc-favorites', ids: scFavorites });
  renderShortcutsRow();
  renderScModalBody(document.getElementById('sc-search') ? document.getElementById('sc-search').value : '');
}

function renderShortcutsRow() {
  var row = document.getElementById('shortcuts-row');
  if (!row) return;
  row.innerHTML = '';
  var favItems = scList.filter(function(s) { return scFavorites.indexOf(s.id) >= 0; });
  favItems.forEach(function(s) {
    var btn = document.createElement('button');
    btn.className = 'sc-chip';
    var chipLabel = s.label || (s.text.length > 28 ? s.text.substring(0, 26) + '\u2026' : s.text);
    btn.textContent = chipLabel;
    btn.title = s.text;
    (function(sc) {
      btn.onclick = function() { insertShortcutText(sc.text); };
    })(s);
    row.appendChild(btn);
  });
  var browse = document.createElement('button');
  browse.id = 'btn-sc-browse';
  browse.textContent = scList.length > 0 ? (scFavorites.length === 0 ? '\u2605 Shortcuts' : '\u2026 More') : '\u2605 Shortcuts';
  browse.onclick = function() { openScModal(); };
  row.appendChild(browse);
  syncViewportLayout();
}

function openScModal() {
  var modal = document.getElementById('sc-modal');
  var searchEl = document.getElementById('sc-search');
  if (!modal) return;
  modal.style.display = 'flex';
  if (searchEl) { searchEl.value = ''; searchEl.focus(); }
  renderScModalBody('');
}

function closeScModal() {
  var modal = document.getElementById('sc-modal');
  if (modal) modal.style.display = 'none';
}

function renderScModalBody(q) {
  var body = document.getElementById('sc-modal-body');
  if (!body) return;
  body.innerHTML = '';
  var query = (q || '').toLowerCase().trim();
  var cats = {};
  var catOrder = [];
  scList.forEach(function(s) {
    var cat = s.category || 'General';
    if (!cats[cat]) { cats[cat] = []; catOrder.push(cat); }
    cats[cat].push(s);
  });
  var totalFound = 0;
  catOrder.forEach(function(cat) {
    var items = cats[cat].filter(function(s) {
      if (!query) return true;
      var inText = s.text.toLowerCase().indexOf(query) >= 0;
      var inLabel = (s.label || '').toLowerCase().indexOf(query) >= 0;
      var inCat = cat.toLowerCase().indexOf(query) >= 0;
      return inText || inLabel || inCat;
    });
    if (items.length === 0) return;
    totalFound += items.length;
    var catEl = document.createElement('div');
    catEl.className = 'sc-cat-hdr';
    catEl.textContent = cat;
    body.appendChild(catEl);
    items.forEach(function(s) {
      var row = document.createElement('div');
      row.className = 'sc-item';
      var txt = document.createElement('div');
      txt.className = 'sc-item-txt';
      txt.textContent = s.text;
      var star = document.createElement('button');
      var isFav = scFavorites.indexOf(s.id) >= 0;
      star.className = isFav ? 'sc-star starred' : 'sc-star';
      star.textContent = isFav ? '\u2605' : '\u2606';
      star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
      (function(sc, starBtn, txtEl, rowEl) {
        txtEl.onclick = function() { insertShortcutText(sc.text); closeScModal(); };
        rowEl.onclick = function(e) { if (e.target !== starBtn) { insertShortcutText(sc.text); closeScModal(); } };
        starBtn.onclick = function(e) { e.stopPropagation(); toggleFavorite(sc.id); };
      })(s, star, txt, row);
      row.appendChild(txt);
      row.appendChild(star);
      body.appendChild(row);
    });
  });
  if (totalFound === 0) {
    var empty = document.createElement('div');
    empty.className = 'sc-empty';
    empty.textContent = query ? 'No shortcuts match your search' : 'No shortcuts loaded';
    body.appendChild(empty);
  }
}

document.getElementById('sc-close-btn').onclick = closeScModal;
document.getElementById('sc-search').addEventListener('input', function() {
  renderScModalBody(this.value);
});

function renderSuggest(val) {
  var sugEl = document.getElementById('sc-suggest');
  if (!sugEl) return;
  if (!val || val.length < 2) { sugEl.style.display = 'none'; return; }
  var q = val.toLowerCase();
  var matches = [];
  for (var i = 0; i < scList.length; i++) {
    var sc = scList[i];
    var lbl = (sc.label || '').toLowerCase();
    if (lbl.indexOf(q) >= 0 || sc.text.toLowerCase().indexOf(q) >= 0) {
      matches.push(sc);
      if (matches.length >= 4) break;
    }
  }
  if (matches.length === 0) { sugEl.style.display = 'none'; return; }
  sugEl.innerHTML = '';
  sugEl.style.display = 'flex';
  for (var j = 0; j < matches.length; j++) {
    (function(sc) {
      var btn = document.createElement('button');
      btn.className = 'sc-sug';
      btn.textContent = sc.label || sc.text.substring(0, 30);
      btn.title = sc.text;
      btn.onmousedown = function(e) { e.preventDefault(); };
      btn.onclick = function() {
        var inp = document.getElementById('text-input');
        if (inp) { inp.value = sc.text; inp.focus(); }
        var sg = document.getElementById('sc-suggest');
        if (sg) sg.style.display = 'none';
      };
      sugEl.appendChild(btn);
    })(matches[j]);
  }
}

var _textInp = document.getElementById('text-input');
if (_textInp) {
  _textInp.addEventListener('input', function() { renderSuggest(this.value); });
  _textInp.addEventListener('focus', function() { renderSuggest(this.value); });
  _textInp.addEventListener('blur', function() {
    setTimeout(function() { var sg = document.getElementById('sc-suggest'); if (sg) sg.style.display = 'none'; }, 300);
  });
}

renderShortcutsRow();
</script>
</body>
</html>`;
}
