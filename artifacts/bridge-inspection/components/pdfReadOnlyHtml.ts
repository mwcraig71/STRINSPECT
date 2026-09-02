import { PDFJS_INLINE_SCRIPT, PDFJS_WORKER_INLINE_SCRIPT } from "./pdfAnnotatorPdfjsBundled";

export function getPdfReadOnlyHtml(): string {
  const workerJson = JSON.stringify(PDFJS_WORKER_INLINE_SCRIPT).replace(/<\//g, "<\\/");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{background:#1e293b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;height:100vh}
#topbar{position:fixed;top:0;left:0;right:0;z-index:200;height:40px;background:#0f172a;border-bottom:1px solid #334155;display:flex;align-items:center;padding:0 12px;gap:8px}
#page-info{color:#94a3b8;font-size:11px;font-weight:700;flex:1;white-space:nowrap;overflow:hidden}
#scroll-area{position:absolute;top:40px;bottom:140px;left:0;right:0;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:auto;background:#1e293b}
#scroll-area.drawing{overflow:hidden}
.page-wrap{position:relative;margin:8px auto;display:block;box-shadow:0 2px 12px rgba(0,0,0,.6)}
.pdf-canvas{display:block;width:100%}
.ann-canvas{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}
.ann-canvas.draw-active{cursor:crosshair;touch-action:none;pointer-events:auto}
#toolbar{position:fixed;bottom:0;left:0;right:0;z-index:200;background:#0f172a;border-top:1px solid #334155;padding:8px 10px 12px;display:flex;flex-direction:column;gap:7px}
#tool-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.zoom-group{display:flex;gap:6px;align-items:center;margin-left:auto;flex-shrink:0}
#zoom-label{color:#94a3b8;font-size:11px;font-weight:700;padding:0 2px;min-width:34px;text-align:center;flex-shrink:0}
#opt-row{display:flex;flex-wrap:nowrap;gap:6px;align-items:center;min-height:28px}
#opt-dynamic{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.tbtn{background:#1e293b;border:1.5px solid #334155;border-radius:10px;color:#94a3b8;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;-webkit-user-select:none;user-select:none}
.tbtn.active{border-color:#38bdf8;color:#38bdf8;background:rgba(56,189,248,.1)}
.ui-icon{width:14px;height:14px;display:block;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.clr-dot{width:44px;height:44px;min-width:44px;border-radius:50%;cursor:pointer;border:2px solid transparent;padding:0;appearance:none;flex-shrink:0;transition:transform .1s}
.clr-dot.active{border-color:#fff;transform:scale(1.25)}
.sz-btn{background:#1e293b;border:1.5px solid #334155;border-radius:8px;color:#94a3b8;min-width:48px;min-height:44px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-user-select:none;user-select:none}
.sz-btn.active{border-color:#38bdf8;color:#38bdf8}
.sep{width:1px;background:#334155;height:18px;flex-shrink:0;margin:0 2px}
#shortcuts-row{display:none;flex-wrap:wrap;gap:5px;align-items:center;min-height:34px;padding:2px 0}
.sc-btn{background:#1e293b;border:1.5px solid #334155;border-radius:16px;color:#94a3b8;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;-webkit-user-select:none;user-select:none}
.sc-btn.sc-fav{border-color:#7c3aed;color:#a78bfa}
#btn-sc-browse{background:#7c3aed;border:none;border-radius:16px;color:#fff;padding:4px 12px;font-size:10px;font-weight:700;cursor:pointer;-webkit-user-select:none;user-select:none}
#sc-modal{position:fixed;inset:0;z-index:500;background:#0f172a;flex-direction:column;display:none}
#sc-modal-hdr{padding:12px;border-bottom:1px solid #334155;display:flex;gap:8px;align-items:center;padding-top:calc(12px + env(safe-area-inset-top))}
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
#sc-suggest{display:none;position:fixed;z-index:302;bottom:0;left:0;right:0;background:#0f172a;border-top:1px solid #7c3aed;flex-direction:row;gap:6px;padding:5px 8px;padding-bottom:calc(5px + env(safe-area-inset-bottom));overflow-x:auto}
#sc-suggest::-webkit-scrollbar{display:none}
.sc-sug{background:#1e293b;border:1px solid #7c3aed;border-radius:8px;color:#c4b5fd;padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0}
.sc-sug:active{opacity:.65}
#loading{position:fixed;inset:0;background:#0f172a;z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.spinner{width:36px;height:36px;border:3px solid #334155;border-top-color:#38bdf8;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#load-txt{color:#94a3b8;font-size:12px;font-weight:600}
#err-txt{display:none;color:#f87171;font-size:12px;text-align:center;padding:0 20px;max-width:280px}
#text-input-wrap{display:none;position:fixed;z-index:300;background:#1e293b;border:2px solid #38bdf8;border-radius:8px;padding:6px}
#text-input{background:transparent;border:none;outline:none;font-size:16px;color:#fff;min-width:120px;max-width:220px}
#pending-hint{display:none;position:fixed;top:40px;left:0;right:0;z-index:150;background:rgba(124,58,237,0.18);border-bottom:1px solid #7c3aed;padding:6px 12px;text-align:center;color:#a78bfa;font-size:11px;font-weight:700;letter-spacing:0.1px;cursor:pointer;-webkit-user-select:none;user-select:none}
</style>
</head>
<body>

<div id="loading">
  <div class="spinner"></div>
  <div id="load-txt">Loading PDF...</div>
  <div id="err-txt"></div>
</div>

<div id="topbar" style="display:none">
  <span id="page-info">Loading...</span>
</div>

<div id="scroll-area"><div id="zoom-wrap"></div></div>

<div id="toolbar" style="display:none">
  <div id="tool-row">
    <button class="tbtn active" id="btn-pan"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10V5a2 2 0 0 0-4 0v9"/><path d="M6 10a2 2 0 0 0-4 0v4c0 4.4 3.6 8 8 8h2a8 8 0 0 0 8-8v-3a2 2 0 0 0-4 0v1"/></svg>Pan</button>
    <button class="tbtn" id="btn-pen"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 19 7-7 3 3-7 7-4 1 1-4z"/><path d="m18 13-3-3"/><path d="M2 22h6"/></svg>Pen</button>
    <button class="tbtn" id="btn-highlight"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 6-4-4L8 12l4 4L22 6z"/><path d="M2 22h20"/></svg>HL</button>
    <button class="tbtn" id="btn-text">T&nbsp;Text</button>
    <button class="tbtn" id="btn-undo"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/></svg>Undo</button>
    <div class="zoom-group">
      <button class="tbtn" id="btn-zoom-out" aria-label="Zoom out"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
      <span id="zoom-label">100%</span>
      <button class="tbtn" id="btn-zoom-in" aria-label="Zoom in"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button>
    </div>
  </div>
  <div id="opt-row">
    <div id="opt-dynamic"></div>
  </div>
  <div id="shortcuts-row"></div>
</div>

<div id="text-input-wrap">
  <input id="text-input" placeholder="Type here..." autocomplete="off" autocorrect="off" spellcheck="false">
</div>
<div id="pending-hint"></div>
<div id="sc-modal">
  <div id="sc-modal-hdr">
    <input id="sc-search" type="search" placeholder="Search shortcuts..." autocomplete="off" autocorrect="off" spellcheck="false">
    <button id="sc-close-btn">Done</button>
  </div>
  <div id="sc-modal-body"></div>
</div>
<div id="sc-suggest"></div>

<script>
${PDFJS_INLINE_SCRIPT}
</script>
<script>var __pdfWorkerSrc__=${workerJson};</script>

<script>
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

var pdfjsLib = window.pdfjsLib || globalThis.pdfjsLib;
if (!pdfjsLib) {
  showError('PDF viewer failed to initialise.');
} else {
  // Register PDF.js's in-thread fallback before attempting the Blob worker.
  // Android production WebViews may reject that worker asynchronously even
  // after URL creation succeeds.
  // Function scope prevents internal declarations in the worker and main
  // bundles from colliding while still publishing globalThis.pdfjsWorker.
  try { Function(__pdfWorkerSrc__)(); } catch (_) {}
  try {
    var _wBlob = new Blob([__pdfWorkerSrc__], { type: 'application/javascript' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(_wBlob);
  } catch (_wErr) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'worker.js';
  }
}

var tool = 'pan';
var penColor = '#ef4444';
var penSize = 4;
var highlightSize = 16;
var highlightColor = '#facc15';
var annotations = [];
var currentStroke = null;
var pdfDoc = null;
var pageCount = 0;
var pageCanvases = {};
var pageDimensions = {};
var pageLayout = {};
var isDrawing = false;
var activeCv = null;
var pdfInitStarted = false;
var textPendingPage = 0;
var textPendingX = 0;
var textPendingY = 0;
var annScale = 1;

var COLORS_PEN = ['#ef4444','#2563eb'];
var COLORS_HIGHLIGHT = ['#facc15','#86efac','#f9a8d4'];
var SIZES = [2,4,8];
var HIGHLIGHT_SIZES = [8,16,26];
var zoomLevel = 1.0;
var ZOOM_STEPS = [0.5,0.75,1.0,1.25,1.5,2.0,2.5,3.0];
var scList = [];
var scFavorites = [];
var pendingShortcut = null;
function setPendingShortcut(text) {
  pendingShortcut = text;
  var hint = document.getElementById('pending-hint');
  if (!hint) return;
  if (text) {
    var preview = text.length > 45 ? text.slice(0, 45) + '...' : text;
    hint.textContent = 'Tap the PDF to place: "' + preview + '" \u2014 tap here to cancel';
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
    hint.textContent = '';
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

function postBridge(msg) {
  var s = JSON.stringify(msg);
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(s);
  } else {
    try { window.parent.postMessage(s, '*'); } catch(e2) {}
  }
}

function autoSave() {
  postBridge({ type: 'save', annotations: annotations, pageDimensions: pageDimensions });
}

document.getElementById('btn-pan').onclick = function() { setTool('pan'); };
document.getElementById('btn-pen').onclick = function() { setTool('pen'); };
document.getElementById('btn-highlight').onclick = function() { setTool('highlight'); };
document.getElementById('btn-text').onclick = function() { setTool('text'); };
document.getElementById('btn-undo').onclick = undoLast;
document.getElementById('btn-zoom-in').onclick = zoomIn;
document.getElementById('btn-zoom-out').onclick = zoomOut;

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
    }
    if (Array.isArray(data.shortcuts)) scList = data.shortcuts;
    if (Array.isArray(data.scFavorites)) scFavorites = data.scFavorites;
    loadPdf(data.pdfUri || data.pdfBase64);
  }
}
window.addEventListener('message', onMsg);
document.addEventListener('message', onMsg);

async function loadPdf(pdfUri) {
  if (!pdfjsLib) { showError('PDF.js not available.'); return; }
  try {
    setLoadTxt('Decoding PDF...');
    var resp = await fetch(pdfUri);
    if (!resp.ok && typeof resp.status !== 'undefined' && resp.status !== 0) {
      throw new Error('Could not open PDF file (' + resp.status + ').');
    }
    var buf = await resp.arrayBuffer();
    setLoadTxt('Rendering pages...');
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
  var RENDER_SCALE = pageCount > 6 ? 2 : 3;
  annScale = RENDER_SCALE;
  for (var pn = 1; pn <= pageCount; pn++) {
    setLoadTxt('Rendering page ' + pn + ' of ' + pageCount + '...');
    var page = await pdfDoc.getPage(pn);
    var baseVp = page.getViewport({ scale: 1 });
    var scale = (vw - 4) / baseVp.width;
    var vp = page.getViewport({ scale: scale });
    var rvp = page.getViewport({ scale: scale * RENDER_SCALE });

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
    annCv.width = rvp.width;
    annCv.height = rvp.height;
    annCv.dataset.page = pn;

    wrap.appendChild(pdfCv);
    wrap.appendChild(annCv);
    zoomWrap.appendChild(wrap);
    pageCanvases[pn] = { pdf: pdfCv, ann: annCv };
    pageDimensions[pn] = { w: vp.width, h: vp.height };
    pageLayout[pn] = { top: wrap.offsetTop, left: wrap.offsetLeft, w: wrap.offsetWidth, h: wrap.offsetHeight };

    var ctx = pdfCv.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: rvp }).promise;
    wireCanvas(annCv, pn);
  }
}

function wireCanvas(cv, pn) {
  cv.addEventListener('pointerdown', function(e) { onDown(e, cv, pn); });
  cv.addEventListener('pointermove', function(e) { onMove(e, cv, pn); });
  cv.addEventListener('pointerup', function(e) { onUp(e, cv, pn); });
  cv.addEventListener('pointercancel', function() { isDrawing = false; currentStroke = null; activeCv = null; });
}

function canvasPoint(e, cv) {
  var area = document.getElementById('scroll-area');
  var pn = parseInt(cv.dataset.page, 10);
  var L = pageLayout[pn];
  if (area && L && L.w > 0 && L.h > 0) {
    var ar = area.getBoundingClientRect();
    var z = zoomLevel || 1;
    var vx = (e.clientX - ar.left) + area.scrollLeft - L.left * z;
    var vy = (e.clientY - ar.top) + area.scrollTop - L.top * z;
    return [vx / z, vy / z];
  }
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
    var preText = pendingShortcut || '';
    setPendingShortcut(null);
    var hitIdx = findTextAnnotation(pn, pt[0], pt[1]);
    showTextInput(e.clientX, e.clientY, pn, preText, hitIdx);
    return;
  }

  currentStroke = {
    type: tool === 'highlight' ? 'highlight' : 'stroke',
    page: pn,
    color: tool === 'highlight' ? highlightColor : penColor,
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
  if (currentStroke.points.length > 0) {
    annotations.push(Object.assign({}, currentStroke, { points: currentStroke.points.slice() }));
    autoSave();
  }
  currentStroke = null;
  activeCv = null;
  redrawPage(targetPn);
}

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
      autoSave();
      redrawPage(textPendingPage);
    } else if (txt) {
      annotations.push({ type:'text', page: textPendingPage, x: textPendingX, y: textPendingY, text: txt, fontSize: (penSize * 4 + 10) * 0.25, color: penColor });
      autoSave();
      redrawPage(textPendingPage);
    }
  }

  function onKey(e) { if (e.key === 'Enter') { commit(); } if (e.key === 'Escape') { cancelled = true; wrap.style.display = 'none'; inp.removeEventListener('keydown', onKey); inp.removeEventListener('blur', onBlur); } }
  function onBlur() { setTimeout(commit, 100); }
  inp.addEventListener('keydown', onKey);
  inp.addEventListener('blur', onBlur);
}

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

function applyZoom(prevZoom) {
  var area = document.getElementById('scroll-area');
  var pz = prevZoom || zoomLevel || 1;
  var vh = area.clientHeight, vw = area.clientWidth;
  var cy = (area.scrollTop + vh / 2) / pz;
  var cx = (area.scrollLeft + vw / 2) / pz;
  document.getElementById('zoom-wrap').style.zoom = zoomLevel;
  document.getElementById('zoom-label').textContent = Math.round(zoomLevel * 100) + '%';
  area.scrollTop = cy * zoomLevel - vh / 2;
  area.scrollLeft = cx * zoomLevel - vw / 2;
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

function undoLast() {
  if (annotations.length === 0) return;
  var last = annotations.pop();
  autoSave();
  redrawPage(last.page);
}

function renderSC() {
  var row = document.getElementById('shortcuts-row');
  if (!row) return;
  row.innerHTML = '';
  if (tool !== 'text') { row.style.display = 'none'; return; }
  if (scList.length === 0) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  var favItems = scList.filter(function(s) { return scFavorites.indexOf(s.id) >= 0; });
  favItems.forEach(function(s) {
    var btn = document.createElement('button');
    btn.className = 'sc-btn sc-fav';
    btn.textContent = s.label || (s.text.length > 28 ? s.text.substring(0, 26) + '\u2026' : s.text);
    btn.title = s.text;
    btn.onmousedown = function(e) { e.preventDefault(); };
    (function(sc) {
      btn.onclick = function() {
        var inp = document.getElementById('text-input');
        var wrap = document.getElementById('text-input-wrap');
        if (wrap && wrap.style.display !== 'none' && inp) {
          inp.value = inp.value ? inp.value + ' ' + sc.text : sc.text;
          inp.focus();
          return;
        }
        setPendingShortcut(sc.text);
        setTool('text');
      };
    })(s);
    row.appendChild(btn);
  });
  var browse = document.createElement('button');
  browse.id = 'btn-sc-browse';
  browse.textContent = scList.length > 0 ? (scFavorites.length === 0 ? '\u2605 Shortcuts' : '\u2026 More') : '\u2605 Shortcuts';
  browse.onclick = function() { openScModal(); };
  row.appendChild(browse);
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

function toggleFavRO(id) {
  var idx = scFavorites.indexOf(id);
  if (idx >= 0) {
    scFavorites = scFavorites.filter(function(f) { return f !== id; });
  } else {
    scFavorites = scFavorites.concat([id]);
  }
  postBridge({ type: 'sc-favorites', ids: scFavorites });
  renderSC();
  var searchEl = document.getElementById('sc-search');
  renderScModalBody(searchEl ? searchEl.value : '');
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
      return s.text.toLowerCase().indexOf(query) >= 0 || (s.label || '').toLowerCase().indexOf(query) >= 0 || cat.toLowerCase().indexOf(query) >= 0;
    });
    if (items.length === 0) return;
    totalFound += items.length;
    var catEl = document.createElement('div');
    catEl.className = 'sc-cat-hdr';
    catEl.textContent = cat;
    body.appendChild(catEl);
    items.forEach(function(s) {
      var rowEl = document.createElement('div');
      rowEl.className = 'sc-item';
      var txt = document.createElement('div');
      txt.className = 'sc-item-txt';
      txt.textContent = s.text;
      var star = document.createElement('button');
      var isFav = scFavorites.indexOf(s.id) >= 0;
      star.className = isFav ? 'sc-star starred' : 'sc-star';
      star.textContent = isFav ? '\u2605' : '\u2606';
      star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
      (function(sc, starBtn, rEl) {
        rEl.onclick = function(e) {
          if (e.target === starBtn) return;
          var inp = document.getElementById('text-input');
          var wrap = document.getElementById('text-input-wrap');
          closeScModal();
          if (wrap && wrap.style.display !== 'none' && inp) {
            inp.value = inp.value ? inp.value + ' ' + sc.text : sc.text;
            inp.focus();
            return;
          }
          setPendingShortcut(sc.text);
          setTool('text');
        };
        starBtn.onclick = function(e) { e.stopPropagation(); toggleFavRO(sc.id); };
      })(s, star, rowEl);
      rowEl.appendChild(txt);
      rowEl.appendChild(star);
      body.appendChild(rowEl);
    });
  });
  if (totalFound === 0) {
    var empty = document.createElement('div');
    empty.className = 'sc-empty';
    empty.textContent = query ? 'No shortcuts match your search' : 'No shortcuts loaded';
    body.appendChild(empty);
  }
}

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

function setTool(t) {
  tool = t;
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
  renderSC();
}

function renderOptRow() {
  var row = document.getElementById('opt-dynamic');
  row.innerHTML = '';
  if (tool === 'pan') return;

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

var _scCloseBtn = document.getElementById('sc-close-btn');
if (_scCloseBtn) _scCloseBtn.onclick = closeScModal;
var _scSearch = document.getElementById('sc-search');
if (_scSearch) _scSearch.addEventListener('input', function() { renderScModalBody(this.value); });
var _textInpRO = document.getElementById('text-input');
if (_textInpRO) {
  _textInpRO.addEventListener('input', function() { renderSuggest(this.value); });
  _textInpRO.addEventListener('focus', function() { renderSuggest(this.value); });
  _textInpRO.addEventListener('blur', function() {
    setTimeout(function() { var sg = document.getElementById('sc-suggest'); if (sg) sg.style.display = 'none'; }, 300);
  });
}

renderOptRow();
</script>
</body>
</html>`;
}
