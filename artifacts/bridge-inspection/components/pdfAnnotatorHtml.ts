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
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes, viewport-fit=cover">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{background:#1e293b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;height:100vh}
#topbar{position:fixed;top:0;left:0;right:0;z-index:200;height:calc(48px + env(safe-area-inset-top));background:#0f172a;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top) 12px 0;gap:8px}
#page-info{color:#94a3b8;font-size:12px;font-weight:700;flex:1}
.top-btn{background:#1e293b;border:1.5px solid #334155;border-radius:8px;color:#94a3b8;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap}
.top-btn.save{background:#0284c7;border-color:#0369a1;color:#fff}
#scroll-area{position:absolute;top:calc(48px + env(safe-area-inset-top));bottom:100px;left:0;right:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;background:#1e293b}
#scroll-area.drawing{overflow:hidden}
.page-wrap{position:relative;margin:12px auto;display:block;box-shadow:0 4px 24px rgba(0,0,0,.6)}
.pdf-canvas{display:block;width:100%}
.ann-canvas{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}
.ann-canvas.draw-active{cursor:crosshair;touch-action:none;pointer-events:auto}
#toolbar{position:fixed;bottom:0;left:0;right:0;z-index:200;background:#0f172a;border-top:1px solid #334155;padding:8px 10px calc(12px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:7px}
#tool-row{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch}
#opt-row{display:flex;gap:6px;align-items:center;overflow-x:auto;-webkit-overflow-scrolling:touch;min-height:32px}
.tbtn{background:#1e293b;border:1.5px solid #334155;border-radius:10px;color:#94a3b8;padding:7px 11px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;-webkit-user-select:none;user-select:none}
.tbtn.active{border-color:#38bdf8;color:#38bdf8;background:rgba(56,189,248,.1)}
.clr-dot{width:26px;height:26px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0;transition:transform .1s}
.clr-dot.active{border-color:#fff;transform:scale(1.25)}
.sz-btn{background:#1e293b;border:1.5px solid #334155;border-radius:8px;color:#94a3b8;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;-webkit-user-select:none;user-select:none}
.sz-btn.active{border-color:#38bdf8;color:#38bdf8}
.sep{width:1px;background:#334155;height:20px;flex-shrink:0;margin:0 2px}
#loading{position:fixed;inset:0;background:#0f172a;z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.spinner{width:40px;height:40px;border:3px solid #334155;border-top-color:#38bdf8;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#load-txt{color:#94a3b8;font-size:13px;font-weight:600}
#err-txt{display:none;color:#f87171;font-size:13px;text-align:center;padding:0 24px;max-width:300px}
#text-input-wrap{display:none;position:fixed;z-index:300;background:#1e293b;border:2px solid #38bdf8;border-radius:8px;padding:6px}
#text-input{background:transparent;border:none;outline:none;font-size:16px;color:#fff;min-width:120px;max-width:220px}
</style>
</head>
<body>

<div id="loading">
  <div class="spinner"></div>
  <div id="load-txt">Loading PDF viewer\u2026</div>
  <div id="err-txt"></div>
</div>

<div id="topbar" style="display:none">
  <span id="page-info">Page 1 of ?</span>
  <div style="display:flex;gap:6px">
    <button class="top-btn save" id="btn-save">&#128190; Save</button>
    <button class="top-btn" id="btn-close">&#10005; Close</button>
  </div>
</div>

<div id="scroll-area"><div id="zoom-wrap"></div></div>

<div id="toolbar" style="display:none">
  <div id="tool-row">
    <button class="tbtn active" id="btn-pan">&#9997; Pan</button>
    <button class="tbtn" id="btn-pen">&#9998; Pen</button>
    <button class="tbtn" id="btn-highlight">&#128397; Highlight</button>
    <button class="tbtn" id="btn-text">T&nbsp;Text</button>
    <button class="tbtn" id="btn-undo">&#8617; Undo</button>
    <div style="flex:1"></div>
    <button class="tbtn" id="btn-zoom-out">&#8722;</button>
    <span id="zoom-label" style="color:#94a3b8;font-size:12px;font-weight:700;padding:0 4px;min-width:38px;text-align:center;flex-shrink:0">100%</span>
    <button class="tbtn" id="btn-zoom-in">&#43;</button>
  </div>
  <div id="opt-row"></div>
</div>

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

function showUI() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('topbar').style.display = 'flex';
  document.getElementById('toolbar').style.display = 'flex';
  document.getElementById('page-info').textContent = 'Page 1 of ' + pageCount;
}

/* ── Initialise PDF.js from bundled global ── */
/* globalThis and window can diverge in WKWebView; check both */
var pdfjsLib = window.pdfjsLib || globalThis.pdfjsLib;
if (!pdfjsLib) {
  showError('PDF viewer failed to initialise. Please close and try again.');
} else {
  // pdf.js throws "No workerSrc specified" for any falsy value, including ''.
  // Create a blob URL from the embedded worker script so pdf.js gets a real,
  // non-empty URL and spins a proper Web Worker (WKWebView iOS 16+ supports
  // blob worker URLs; Android WebView has supported them since v60).
  try {
    var _wBlob = new Blob([__pdfWorkerSrc__], { type: 'application/javascript' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(_wBlob);
  } catch (_wErr) {
    // Blob URL unavailable — execute worker inline so WorkerMessageHandler is
    // registered on globalThis.pdfjsWorker, then satisfy the non-empty check.
    try { (0, eval)(__pdfWorkerSrc__); } catch (_) {}
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'worker.js';
  }
}

/* ── State ── */
var tool = 'pan';
var penColor = '#ef4444';
var penSize = 4;
var annotations = [];
var initialAnnotationCount = 0;
var isDirty = false;
var currentStroke = null;
var pdfDoc = null;
var pageCount = 0;
var pageCanvases = {};
var pageDimensions = {}; // keyed by page number → {w, h} canvas pixel dimensions
var isDrawing = false;
var textPendingPage = 0;
var textPendingX = 0;
var textPendingY = 0;

var COLORS_PEN = ['#ef4444','#0f172a','#2563eb'];
var SIZES = [2,4,8];
var zoomLevel = 1.0;
var ZOOM_STEPS = [0.5,0.75,1.0,1.25,1.5,2.0,2.5,3.0];

/* ── RN bridge ── */
function postRN(msg) {
  try {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
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

document.getElementById('btn-pan').onclick = function() { setTool('pan'); };
document.getElementById('btn-pen').onclick = function() { setTool('pen'); };
document.getElementById('btn-highlight').onclick = function() { setTool('highlight'); };
document.getElementById('btn-text').onclick = function() { setTool('text'); };
document.getElementById('btn-undo').onclick = undoLast;
document.getElementById('btn-zoom-in').onclick = zoomIn;
document.getElementById('btn-zoom-out').onclick = zoomOut;

/* ── Receive init message ── */
function onMsg(e) {
  var raw = (typeof e.data === 'string') ? e.data : null;
  if (!raw) return;
  var data;
  try { data = JSON.parse(raw); } catch(err) { return; }
  if (data && data.type === 'init') {
    if (Array.isArray(data.annotations) && data.annotations.length > 0) {
      annotations = data.annotations;
      initialAnnotationCount = annotations.length;
    }
    loadPdf(data.pdfBase64);
  }
}
window.addEventListener('message', onMsg);
document.addEventListener('message', onMsg);

/* ── Load and render PDF ── */
async function loadPdf(base64Uri) {
  if (!pdfjsLib) { showError('PDF.js not available.'); return; }
  try {
    setLoadTxt('Decoding PDF\u2026');
    var resp = await fetch(base64Uri);
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
  for (var pn = 1; pn <= pageCount; pn++) {
    setLoadTxt('Rendering page ' + pn + ' of ' + pageCount + '\u2026');
    var page = await pdfDoc.getPage(pn);
    var baseVp = page.getViewport({ scale: 1 });
    var scale = (vw - 4) / baseVp.width;
    var vp = page.getViewport({ scale: scale });

    var wrap = document.createElement('div');
    wrap.className = 'page-wrap';
    wrap.style.width = vp.width + 'px';
    wrap.style.height = vp.height + 'px';
    wrap.dataset.page = pn;

    var pdfCv = document.createElement('canvas');
    pdfCv.className = 'pdf-canvas';
    pdfCv.width = vp.width;
    pdfCv.height = vp.height;

    var annCv = document.createElement('canvas');
    annCv.className = 'ann-canvas';
    annCv.width = vp.width;
    annCv.height = vp.height;
    annCv.dataset.page = pn;

    wrap.appendChild(pdfCv);
    wrap.appendChild(annCv);
    zoomWrap.appendChild(wrap);
    pageCanvases[pn] = { pdf: pdfCv, ann: annCv };
    pageDimensions[pn] = { w: vp.width, h: vp.height };

    var ctx = pdfCv.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    wireCanvas(annCv, pn);
  }
}

/* ── Canvas event wiring ── */
function wireCanvas(cv, pn) {
  cv.addEventListener('pointerdown', function(e) { onDown(e, cv, pn); });
  cv.addEventListener('pointermove', function(e) { onMove(e, cv, pn); });
  cv.addEventListener('pointerup', function(e) { onUp(e, cv, pn); });
  cv.addEventListener('pointercancel', function() { isDrawing = false; currentStroke = null; });
}

function canvasPoint(e, cv) {
  var r = cv.getBoundingClientRect();
  var sx = cv.width / r.width;
  var sy = cv.height / r.height;
  return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
}

function onDown(e, cv, pn) {
  if (tool === 'pan') return;
  e.preventDefault();
  cv.setPointerCapture(e.pointerId);
  isDrawing = true;
  var pt = canvasPoint(e, cv);

  if (tool === 'text') {
    isDrawing = false;
    textPendingPage = pn;
    textPendingX = pt[0];
    textPendingY = pt[1];
    showTextInput(e.clientX, e.clientY, pn);
    return;
  }

  currentStroke = {
    type: tool === 'highlight' ? 'highlight' : 'stroke',
    page: pn,
    color: tool === 'highlight' ? '#facc15' : penColor,
    width: penSize,
    points: [pt]
  };
}

function onMove(e, cv, pn) {
  if (!isDrawing || !currentStroke || tool === 'pan') return;
  e.preventDefault();
  var pt = canvasPoint(e, cv);
  currentStroke.points.push(pt);
  redrawPage(pn);
  drawStroke(pageCanvases[pn].ann.getContext('2d'), currentStroke);
}

function onUp(e, cv, pn) {
  if (!isDrawing || !currentStroke) { isDrawing = false; return; }
  isDrawing = false;
  if (currentStroke.points.length > 0) {
    annotations.push(Object.assign({}, currentStroke, { points: currentStroke.points.slice() }));
    isDirty = true;
  }
  currentStroke = null;
  redrawPage(pn);
}

/* ── Text input overlay ── */
function showTextInput(clientX, clientY, pn) {
  var wrap = document.getElementById('text-input-wrap');
  var inp = document.getElementById('text-input');
  var x = Math.min(clientX, window.innerWidth - 250);
  var y = Math.min(clientY, window.innerHeight - 60);
  wrap.style.left = x + 'px';
  wrap.style.top = y + 'px';
  wrap.style.display = 'block';
  inp.value = '';
  inp.focus();

  function commit() {
    var txt = inp.value.trim();
    wrap.style.display = 'none';
    inp.removeEventListener('keydown', onKey);
    inp.removeEventListener('blur', onBlur);
    if (txt) {
      annotations.push({ type:'text', page: textPendingPage, x: textPendingX, y: textPendingY, text: txt, fontSize: penSize * 4 + 10, color: penColor });
      isDirty = true;
      redrawPage(textPendingPage);
    }
  }

  function onKey(e) { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { inp.value=''; wrap.style.display='none'; inp.removeEventListener('keydown',onKey); inp.removeEventListener('blur',onBlur); } }
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
  ctx.clearRect(0, 0, cs.ann.width, cs.ann.height);
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
function applyZoom() {
  document.getElementById('zoom-wrap').style.zoom = zoomLevel;
  document.getElementById('zoom-label').textContent = Math.round(zoomLevel * 100) + '%';
}
function zoomIn() {
  for (var i = 0; i < ZOOM_STEPS.length; i++) {
    if (ZOOM_STEPS[i] > zoomLevel + 0.01) { zoomLevel = ZOOM_STEPS[i]; applyZoom(); return; }
  }
}
function zoomOut() {
  for (var i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < zoomLevel - 0.01) { zoomLevel = ZOOM_STEPS[i]; applyZoom(); return; }
  }
}

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
  var row = document.getElementById('opt-row');
  row.innerHTML = '';
  if (tool === 'pan') return;

  if (tool === 'highlight') {
    var d = document.createElement('div');
    d.className = 'clr-dot active';
    d.style.background = '#facc15';
    d.style.border = '2px solid #fff';
    row.appendChild(d);
  } else {
    COLORS_PEN.forEach(function(c) {
      var d = document.createElement('div');
      d.className = 'clr-dot' + (c === penColor ? ' active' : '');
      d.style.background = c === '#0f172a' ? '#334155' : c;
      d.style.border = '2px solid ' + (c === penColor ? '#fff' : 'transparent');
      d.onclick = function() { penColor = c; renderOptRow(); };
      row.appendChild(d);
    });
  }

  var sep = document.createElement('div');
  sep.className = 'sep';
  row.appendChild(sep);

  var sizeLabels = ['S','M','L'];
  SIZES.forEach(function(s,i) {
    var b = document.createElement('button');
    b.className = 'sz-btn' + (s === penSize ? ' active' : '');
    b.textContent = sizeLabels[i];
    b.title = tool === 'text' ? ['Small','Medium','Large'][i] + ' font' : ['Thin','Medium','Thick'][i] + ' line';
    b.onclick = function() { penSize = s; renderOptRow(); };
    row.appendChild(b);
  });
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
</script>
</body>
</html>`;
}
