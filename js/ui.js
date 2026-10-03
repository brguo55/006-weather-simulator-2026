"use strict";
/* ============================================================
   ui.js：画在画布上的手绘控件 —— 底部主题色板 / 顶部天气切换（雨 · 雪 · 樱）
   ============================================================ */

/* ---------- 主题色板（画面底部一行 · 钢笔手绘小方块，与底座同风格） ---------- */
const NSWATCH = 7;
const swShapes = [];   // 每个色板的抖动方形（局部坐标，固定不闪）
for (let i = 0; i < NSWATCH; i++){
  const pts = [];
  const cs = [[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]];
  for (let e = 0; e < 4; e++){
    const a = cs[e], b = cs[(e+1)%4];
    for (let k = 0; k < 4; k++){
      const t = k/4;
      pts.push([ a[0]+(b[0]-a[0])*t + rnd(-0.045,0.045), a[1]+(b[1]-a[1])*t + rnd(-0.045,0.045) ]);
    }
  }
  pts.push(pts[0]);
  swShapes.push(pts);
}
let hoverIdx = -1;
const SW_BASE = 34, SW_GAP = 20;
function swatchPos(i){
  const act = i === themeIdx, hov = i === hoverIdx;
  return {
    cx: W/2 + (i - (NSWATCH-1)/2)*(SW_BASE + SW_GAP)*SC,
    cy: H - (58 + (act ? 4 : (hov ? 2 : 0)))*SC,
    s: (act ? 40 : (hov ? 37 : SW_BASE))*SC
  };
}
function hitSwatch(px, py){
  for (let i = 0; i < NSWATCH; i++){
    const { cx, cy, s } = swatchPos(i);
    if (Math.abs(px - cx) < s*0.62 && Math.abs(py - cy) < s*0.62) return i;
  }
  return -1;
}
function drawSwatches(){
  for (let i = 0; i < NSWATCH; i++){
    const { cx, cy, s } = swatchPos(i);
    const act = i === themeIdx;
    const P = THEMES[i];
    const pts = swShapes[i].map(p => [cx + p[0]*s, cy + p[1]*s]);
    // 水彩填充（透出纸纹）
    ctx.fillStyle = `rgba(${P.W[0]},${P.W[1]},${P.W[2]},${act ? 0.9 : 0.72})`;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    ctx.fill();
    // 水彩错位叠层
    ctx.save();
    ctx.translate(1.6*SC, 1.2*SC);
    ctx.fillStyle = `rgba(${P.W[0]},${P.W[1]},${P.W[2]},${act ? 0.35 : 0.26})`;
    ctx.fill();
    ctx.restore();
    // 钢笔勾边（与底座棱线同款笔触，笔宽由 pen 统一随视口缩放）
    pen(pts, INK, act ? 1.8 : 1.4, act ? 0.9 : 0.68, i*43.7, 0.04);
    // 当前主题：色板下添一道短横线
    if (act) pen([[cx-10*SC, cy + s*0.62 + 8*SC],[cx+10*SC, cy + s*0.62 + 8*SC]], INK, 1.6, 0.72, i*17.3, 0);
  }
}

/* ---------- 天气切换（画面顶部一行 · 钢笔手绘小图标：雨滴 / 雪花 / 樱花） ---------- */
const IC_RAIN = [168,190,200], IC_SNOW = [212,224,232], IC_SAKURA = [240,194,206], IC_HEART = [214,138,162];
const wj = a => rnd(-a, a);   // 手抖（局部坐标预生成 → 每帧不闪）
// 雨滴：上尖下圆，左下一道白高光
const icDrop = [];
for (let k = 0; k < 18; k++){
  const t = k/18*TAU;
  icDrop.push([0.38*Math.sin(t)*Math.pow(Math.sin(t/2), 1.3) + wj(0.015), -0.46*Math.cos(t) + 0.05 + wj(0.015)]);
}
icDrop.push(icDrop[0]);
const icDropHi = [[-0.19, 0.14], [-0.16, 0.27], [-0.07, 0.35]];
// 雪花：三笔交叉成六枝，每枝一对小杈，底下一团淡蓝
const icFlake = [];
for (let k = 0; k < 3; k++){
  const a = Math.PI/2 + k*TAU/6, c = Math.cos(a)*0.44, s = Math.sin(a)*0.44;
  icFlake.push([[-c + wj(0.02), -s + wj(0.02)], [wj(0.025), wj(0.025)], [c + wj(0.02), s + wj(0.02)]]);
}
for (let k = 0; k < 6; k++){
  const a = Math.PI/2 + k*TAU/6, ca = Math.cos(a), sa = Math.sin(a);
  for (const sg of [-1, 1]){
    const b = a + sg*0.8;
    icFlake.push([[ca*0.24, sa*0.24], [ca*0.24 + Math.cos(b)*0.13 + wj(0.01), sa*0.24 + Math.sin(b)*0.13 + wj(0.01)]]);
  }
}
const icFlakeWash = [];
for (let k = 0, o = 0; k < 14; k++){
  o = o*0.5 + wj(0.05);
  icFlakeWash.push([Math.cos(k/14*TAU)*(0.3 + o), Math.sin(k/14*TAU)*(0.3 + o)]);
}
// 樱花：五瓣（瓣尖带缺刻，与飘落的花瓣同形），花心一点深粉 + 五粒花蕊
const icBloom = [];
for (let k = 0; k < 5; k++){
  const a = -Math.PI/2 + k*TAU/5, ca = Math.cos(a), sa = Math.sin(a);
  const pts = PETAL.map(q => {
    const r = 0.05 + (q[1] + 0.5)*0.42, u = q[0]*0.5;   // 瓣根在花心，瓣尖朝外
    return [ca*r - sa*u + wj(0.012), sa*r + ca*u + wj(0.012)];
  });
  pts.push(pts[0]);
  icBloom.push(pts);
}
const icHeart = [], icStamen = [];
for (let k = 0; k < 9; k++) icHeart.push([Math.cos(k/9*TAU)*(0.09 + wj(0.015)), Math.sin(k/9*TAU)*(0.09 + wj(0.015))]);
for (let k = 0; k < 5; k++){ const a = -Math.PI/2 + (k + 0.5)*TAU/5; icStamen.push([Math.cos(a)*0.15, Math.sin(a)*0.15]); }

let wHoverIdx = -1;
const WB_BASE = 32, WB_GAP = 26;
function weatherBtnPos(i){
  const act = i === weatherIdx, hov = i === wHoverIdx;
  return {
    cx: W/2 + (i - (WEATHERS.length-1)/2)*(WB_BASE + WB_GAP)*SC,
    cy: (54 - (act ? 3 : (hov ? 2 : 0)))*SC,
    s: (act ? 38 : (hov ? 35 : WB_BASE))*SC
  };
}
function hitWeatherBtn(px, py){
  for (let i = 0; i < WEATHERS.length; i++){
    const { cx, cy, s } = weatherBtnPos(i);
    if (Math.abs(px - cx) < s*0.62 && Math.abs(py - cy) < s*0.62) return i;
  }
  return -1;
}
function drawWeatherBtns(){
  for (let i = 0; i < WEATHERS.length; i++){
    const { cx, cy, s } = weatherBtnPos(i);
    const act = i === weatherIdx, hov = i === wHoverIdx;
    const ia = act ? 0.9 : (hov ? 0.78 : 0.6);   // 墨色
    const fa = act ? 0.85 : (hov ? 0.7 : 0.5);   // 淡彩
    const pw = act ? 1.6 : 1.3;                  // 笔宽
    const at = q => [cx + q[0]*s, cy + q[1]*s];
    const key = WEATHERS[i].key;
    if (key === 'rain'){
      const pts = icDrop.map(at);
      fillPoly(pts, IC_RAIN, fa, false);
      pen(pts, INK, pw, ia, 11.3, 0.04);
      pen(icDropHi.map(at), [255,255,255], 1.5, 0.9, 5.1, 0, false);
    } else if (key === 'snow'){
      fillPoly(icFlakeWash.map(at), IC_SNOW, fa, false);
      icFlake.forEach((l, k) => pen(l.map(at), INK, pw*0.85, ia, 23.7 + k*5.3, 0, false));
    } else {
      icBloom.forEach((b, k) => {
        const pts = b.map(at);
        fillPoly(pts, IC_SAKURA, fa, false);
        pen(pts, INK, pw*0.85, ia, 37.1 + k*7.9, 0.05);
      });
      fillPoly(icHeart.map(at), IC_HEART, fa, false);
      ctx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${ia})`;
      for (const q of icStamen){ const p = at(q); ctx.beginPath(); ctx.arc(p[0], p[1], 1.1*SC, 0, TAU); ctx.fill(); }
    }
    // 当前天气：图标下添一道短横线（同色板）
    if (act) pen([[cx-10*SC, cy + s*0.62 + 6*SC],[cx+10*SC, cy + s*0.62 + 6*SC]], INK, 1.6, 0.72, i*17.3 + 101, 0);
  }
}
