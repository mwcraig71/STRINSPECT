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
.clr-dot{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0;transition:transform .1s}
.clr-dot.active{border-color:#fff;transform:scale(1.25)}
.sz-btn{background:#1e293b;border:1.5px solid #334155;border-radius:7px;color:#94a3b8;padding:4px 9px;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0;-webkit-user-select:none;user-select:none}
.sz-btn.active{border-color:#38bdf8;color:#38bdf8}
.sep{width:1px;background:#334155;height:18px;flex-shrink:0;margin:0 2px}
#shortcuts-row{display:none;gap:6px;align-items:center;overflow-x:auto;-webkit-overflow-scrolling:auto;scrollbar-width:none;min-height:34px;padding-bottom:1px}
#shortcuts-row::-webkit-scrollbar{display:none}
.sc-btn{background:#1e293b;border:1.5px solid #334155;border-radius:8px;color:#94a3b8;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;-webkit-user-select:none;user-select:none}
.sc-btn.sc-fav{border-color:#7c3aed;color:#a78bfa}
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
    <button class="tbtn active" id="btn-pan">&#9997; Pan</button>
    <button class="tbtn" id="btn-pen">&#9998; Pen</button>
    <button class="tbtn" id="btn-highlight">&#128397; HL</button>
    <button class="tbtn" id="btn-text">T&nbsp;Text</button>
    <button class="tbtn" id="btn-undo">&#8617; Undo</button>
    <div class="zoom-group">
      <button class="tbtn" id="btn-zoom-out">&#8722;</button>
      <span id="zoom-label">100%</span>
      <button class="tbtn" id="btn-zoom-in">&#43;</button>
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
  try {
    var _wBlob = new Blob([__pdfWorkerSrc__], { type: 'application/javascript' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(_wBlob);
  } catch (_wErr) {
    try { (0, eval)(__pdfWorkerSrc__); } catch (_) {}
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'worker.js';
  }
}

var tool = 'pan';
var penColor = '#ef4444';
var penSize = 4;
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
var SIZES = [2,4,8];
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
    showTextInput(e.clientX, e.clientY, pn, preText);
    return;
  }

  currentStroke = {
    type: tool === 'highlight' ? 'highlight' : 'stroke',
    page: pn,
    color: tool === 'highlight' ? '#facc15' : penColor,
    width: penSize * 0.25,
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

function showTextInput(clientX, clientY, pn, preText) {
  var wrap = document.getElementById('text-input-wrap');
  var inp = document.getElementById('text-input');
  var x = Math.min(clientX, window.innerWidth - 250);
  var y = Math.min(clientY, window.innerHeight - 60);
  wrap.style.left = x + 'px';
  wrap.style.top = y + 'px';
  wrap.style.display = 'block';
  inp.value = preText || '';
  if (preText) { inp.select(); }
  inp.focus();

  function commit() {
    var txt = inp.value.trim();
    wrap.style.display = 'none';
    inp.removeEventListener('keydown', onKey);
    inp.removeEventListener('blur', onBlur);
    if (txt) {
      annotations.push({ type:'text', page: textPendingPage, x: textPendingX, y: textPendingY, text: txt, fontSize: (penSize * 4 + 10) * 0.25, color: penColor });
      autoSave();
      redrawPage(textPendingPage);
    }
  }

  function onKey(e) { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { inp.value=''; wrap.style.display='none'; inp.removeEventListener('keydown',onKey); inp.removeEventListener('blur',onBlur); } }
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
  var favSet = {};
  scFavorites.forEach(function(id) { favSet[id] = true; });
  var sorted = scList.slice().sort(function(a, b) {
    var af = favSet[a.id] ? 0 : 1;
    var bf = favSet[b.id] ? 0 : 1;
    return af - bf;
  });
  sorted.forEach(function(s) {
    var isFav = favSet[s.id];
    var btn = document.createElement('button');
    btn.className = 'sc-btn' + (isFav ? ' sc-fav' : '');
    btn.textContent = (isFav ? '\u2605 ' : '') + (s.label || s.text);
    btn.title = s.text;
    btn.onmousedown = function(e) { e.preventDefault(); };
    btn.onclick = function() {
      var inp = document.getElementById('text-input');
      var wrap = document.getElementById('text-input-wrap');
      if (wrap && wrap.style.display !== 'none' && inp) {
        inp.value = inp.value ? inp.value + ' ' + s.text : s.text;
        inp.focus();
        return;
      }
      setPendingShortcut(s.text);
      setTool('text');
    };
    row.appendChild(btn);
  });
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
    var d = document.createElement('div');
    d.className = 'clr-dot active';
    d.style.background = '#facc15';
    d.style.border = '2px solid #fff';
    row.appendChild(d);
  } else {
    COLORS_PEN.forEach(function(c) {
      var d = document.createElement('div');
      d.className = 'clr-dot' + (c === penColor ? ' active' : '');
      d.style.background = c;
      d.style.border = '2px solid ' + (c === penColor ? '#fff' : 'transparent');
      d.onclick = function() { penColor = c; renderOptRow(); };
      row.appendChild(d);
    });
  }

  var sep = document.createElement('div');
  sep.className = 'sep';
  row.appendChild(sep);

  var sizeDefs = (tool === 'text')
    ? [{ s:4, label:'M', title:'Medium font' }, { s:8, label:'L', title:'Large font' }]
    : [{ s:2, label:'S', title:'Thin line' }, { s:4, label:'M', title:'Medium line' }, { s:8, label:'L', title:'Thick line' }];
  sizeDefs.forEach(function(def) {
    var b = document.createElement('button');
    b.className = 'sz-btn' + (def.s === penSize ? ' active' : '');
    b.textContent = def.label;
    b.title = def.title;
    b.onclick = function() { penSize = def.s; renderOptRow(); };
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
