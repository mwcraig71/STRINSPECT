import { PDFJS_INLINE_SCRIPT, PDFJS_WORKER_INLINE_SCRIPT } from "./pdfAnnotatorPdfjsBundled";

export function getPdfReadOnlyHtml(): string {
  const workerJson = JSON.stringify(PDFJS_WORKER_INLINE_SCRIPT).replace(/<\//g, "<\\/");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes, viewport-fit=cover">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e293b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;height:100vh}
#topbar{position:fixed;top:0;left:0;right:0;z-index:100;height:40px;background:#0f172a;border-bottom:1px solid #334155;display:flex;align-items:center;padding:0 10px;gap:8px}
#page-info{color:#94a3b8;font-size:11px;font-weight:700;flex:1;white-space:nowrap;overflow:hidden}
.zbtn{background:#1e293b;border:1.5px solid #334155;border-radius:6px;color:#94a3b8;padding:5px 10px;font-size:13px;font-weight:700;cursor:pointer;line-height:1;-webkit-user-select:none;user-select:none}
#zoom-lbl{color:#94a3b8;font-size:11px;font-weight:700;min-width:34px;text-align:center}
#scroll-area{position:absolute;top:40px;bottom:0;left:0;right:0;overflow-y:auto;overflow-x:auto;background:#1e293b}
.page-wrap{margin:8px auto;display:block;box-shadow:0 2px 12px rgba(0,0,0,.6)}
.pdf-canvas{display:block;width:100%}
#loading{position:fixed;top:0;left:0;right:0;bottom:0;background:#0f172a;z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.spinner{width:36px;height:36px;border:3px solid #334155;border-top-color:#38bdf8;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#load-txt{color:#94a3b8;font-size:12px;font-weight:600}
#err-txt{display:none;color:#f87171;font-size:12px;text-align:center;padding:0 20px;max-width:280px}
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
  <button class="zbtn" id="btn-zo">-</button>
  <span id="zoom-lbl">100%</span>
  <button class="zbtn" id="btn-zi">+</button>
</div>

<div id="scroll-area"><div id="zoom-wrap"></div></div>

<script>
${PDFJS_INLINE_SCRIPT}
</script>
<script>var __pdfWorkerSrc__=${workerJson};</script>

<script>
function showError(msg) {
  var sp = document.querySelector('.spinner');
  if (sp) sp.style.display = 'none';
  var lt = document.getElementById('load-txt');
  if (lt) lt.style.display = 'none';
  var et = document.getElementById('err-txt');
  if (et) { et.style.display = 'block'; et.textContent = msg; }
}

function setLoadTxt(t) {
  var el = document.getElementById('load-txt');
  if (el) el.textContent = t;
}

function showUI(n) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('topbar').style.display = 'flex';
  document.getElementById('page-info').textContent = 'Page 1 of ' + n;
}

var pdfjsLib = window.pdfjsLib || globalThis.pdfjsLib;
if (!pdfjsLib) {
  showError('PDF viewer failed to initialise.');
} else {
  try {
    var _wb = new Blob([__pdfWorkerSrc__], { type: 'application/javascript' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(_wb);
  } catch (_we) {
    try { (0, eval)(__pdfWorkerSrc__); } catch (_) {}
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'worker.js';
  }
}

var pdfDoc = null;
var pageCount = 0;
var zoomLevel = 1.0;
var ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
var pdfInitStarted = false;

function applyZoom() {
  var w = document.getElementById('zoom-wrap');
  if (w) w.style.zoom = String(zoomLevel);
  var l = document.getElementById('zoom-lbl');
  if (l) l.textContent = Math.round(zoomLevel * 100) + '%';
}

function zoomIn() {
  var i = ZOOM_STEPS.indexOf(zoomLevel);
  if (i >= 0 && i < ZOOM_STEPS.length - 1) { zoomLevel = ZOOM_STEPS[i + 1]; applyZoom(); }
  else if (i < 0) { zoomLevel = 1.0; applyZoom(); }
}

function zoomOut() {
  var i = ZOOM_STEPS.indexOf(zoomLevel);
  if (i > 0) { zoomLevel = ZOOM_STEPS[i - 1]; applyZoom(); }
  else if (i < 0) { zoomLevel = 1.0; applyZoom(); }
}

document.getElementById('btn-zi').onclick = zoomIn;
document.getElementById('btn-zo').onclick = zoomOut;

function onMsg(e) {
  var raw = (typeof e.data === 'string') ? e.data : null;
  if (!raw) return;
  var data;
  try { data = JSON.parse(raw); } catch(err) { return; }
  if (data && data.type === 'init') {
    if (pdfInitStarted) return;
    pdfInitStarted = true;
    loadPdf(data.pdfBase64);
  }
}
window.addEventListener('message', onMsg);
document.addEventListener('message', onMsg);

async function loadPdf(base64Uri) {
  if (!pdfjsLib) { showError('PDF.js not available.'); return; }
  try {
    setLoadTxt('Decoding PDF...');
    var resp = await fetch(base64Uri);
    var buf = await resp.arrayBuffer();
    setLoadTxt('Rendering pages...');
    pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    pageCount = pdfDoc.numPages;
    await renderAllPages();
    showUI(pageCount);
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

    var cv = document.createElement('canvas');
    cv.className = 'pdf-canvas';
    cv.width = rvp.width;
    cv.height = rvp.height;

    wrap.appendChild(cv);
    zoomWrap.appendChild(wrap);

    var ctx = cv.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: rvp }).promise;
  }
}
</script>
</body>
</html>`;
}
