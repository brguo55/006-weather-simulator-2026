"use strict";
/* ============================================================
   main.js：主循环 + 交互 + 启动
   ============================================================ */

/* ---------- 主循环 ---------- */
let lastT = 0, interacted = false;
function frame(now){
  const dt = Math.min(0.033, (now - lastT)/1000 || 0.016);
  lastT = now;
  if (!interacted) cam.theta += dt * 0.045; // 初始极慢自转，一触即停
  updCam();

  // --- 更新 ---
  if (waterT < 1) waterT = Math.min(1, waterT + dt/WATER_DUR); // 水彩染开进度
  updateWeather(dt);
  updateRipples(dt);
  tickAudio(dt);

  // --- 绘制 ---
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(paper, 0, 0, W, H);
  drawShadow();
  const centerDepth = depthOf([0, cam.ty, 0]);
  drawWeatherBehind(centerDepth);  // 远处的雨 / 水体背后的雪与花瓣（透过半透明水体隐约可见）
  drawBox();                       // 背面棱线 → 整块水体 → 近处棱线
  drawRipples();
  drawFloaters();                  // 水面上漂着的雪与花瓣
  drawSplashes();
  drawWeatherFront(centerDepth);   // 近处的雨 / 空中的雪与花瓣
  drawSwatches();
  drawWeatherBtns();
  requestAnimationFrame(frame);
}

/* ---------- 交互：拖拽旋转 / 滚轮缩放 / 双指捏合 / 点击涟漪 / 色板 / 天气 ---------- */
const pointers = new Map();
let dragStart = null, pinchD = 0, pinched = false;
cv.addEventListener('pointerdown', e => {
  interacted = true;
  initAudio();
  const sw = hitSwatch(e.clientX, e.clientY);
  if (sw >= 0){ switchTheme(sw); return; }   // 点色板：只换色，不动相机、不生涟漪
  const wb = hitWeatherBtn(e.clientX, e.clientY);
  if (wb >= 0){ switchWeather(wb); return; } // 点天气图标：只换天气
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1){
    dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    pinched = false;
  } else if (pointers.size === 2){
    const ps = [...pointers.values()];
    pinchD = Math.hypot(ps[0].x-ps[1].x, ps[0].y-ps[1].y);
    pinched = true;
  }
});
cv.addEventListener('pointermove', e => {
  if (!pointers.size){ // 非拖拽时：色板 / 天气图标悬停检测
    const h = hitSwatch(e.clientX, e.clientY), hw = hitWeatherBtn(e.clientX, e.clientY);
    if (h !== hoverIdx || hw !== wHoverIdx){
      hoverIdx = h; wHoverIdx = hw;
      cv.style.cursor = (h >= 0 || hw >= 0) ? 'pointer' : '';
    }
  }
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1){
    cam.theta -= dx * 0.0052;
    cam.phi = Math.min(1.42, Math.max(0.32, cam.phi - dy * 0.0048));
  } else if (pointers.size === 2){
    const ps = [...pointers.values()];
    const nd = Math.hypot(ps[0].x-ps[1].x, ps[0].y-ps[1].y);
    if (pinchD > 0) cam.dist = Math.min(9.5, Math.max(3.2, cam.dist * pinchD/nd));
    pinchD = nd;
  }
});
function endPointer(e){
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (dragStart && !pinched && pointers.size === 0){
    const moved = Math.hypot(e.clientX-dragStart.x, e.clientY-dragStart.y);
    const held = performance.now() - dragStart.t;
    if (moved < 7 && held < 400) clickRipple(e.clientX, e.clientY);
    dragStart = null;
  }
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
window.addEventListener('wheel', e => {
  e.preventDefault();
  interacted = true;
  cam.dist = Math.min(9.5, Math.max(3.2, cam.dist * Math.exp(e.deltaY * 0.0012)));
}, { passive: false });

function clickRipple(px, py){
  const nx = (px - W/2)/focal, ny = -(py - H/2)/focal;
  const dir = norm3([ Fv[0] + Rv[0]*nx + Uv[0]*ny,
                      Fv[1] + Rv[1]*nx + Uv[1]*ny,
                      Fv[2] + Rv[2]*nx + Uv[2]*ny ]);
  if (Math.abs(dir[1]) < 1e-4) return;
  const t = (WY - eye[1]) / dir[1];
  if (t <= 0) return;
  const hx = eye[0] + dir[0]*t, hz = eye[2] + dir[2]*t;
  if (Math.abs(hx) < WH && Math.abs(hz) < WH){
    addRipple(hx, hz, true);
    addRipple(hx + rnd(-0.15,0.15), hz + rnd(-0.15,0.15), false);
    addSplash(hx, hz, 7 + (Math.random()*5|0));
    nudgeFloaters(hx, hz, 0.6, 0.45);   // 漂着的花瓣 / 雪被涟漪推开
    plip();
  }
}

/* ---------- 键盘 ---------- */
window.addEventListener('keydown', initAudio);
// 屏蔽浏览器缩放快捷键（⌘/Ctrl + +/−/0）：画面已按视口自适应，不需要页面缩放
window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) &&
      (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_' || e.key === '0' ||
       e.key === ')' || e.key === '(')) e.preventDefault();
});
// 数字键 1 / 2 / 3：雨 / 雪 / 樱
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const i = ['1', '2', '3'].indexOf(e.key);
  if (i >= 0) switchWeather(i);
});

/* ---------- 启动 ---------- */
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
