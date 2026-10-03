"use strict";
/* ============================================================
   微缩水景 · 雨 / 雪 / 樱 · 三渲二 / 钢笔淡彩
   自定义迷你 3D 引擎：画家算法 + 手绘笔触，纯 Canvas 2D，零依赖
   整块即水：无池壁边沿，一块半透明的蓝色水体
   ------------------------------------------------------------
   engine.js：小工具 / 画布 / 相机投影 / 几何常量 / 纸纹 / 手绘笔触
   ============================================================ */

/* ---------- 小工具 ---------- */
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm3 = a => { const l = Math.hypot(a[0],a[1],a[2]) || 1; return [a[0]/l,a[1]/l,a[2]/l]; };
function hash(n){ const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); }

/* ---------- 画布 ---------- */
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const FOV = 38 * Math.PI / 180;
let W = 0, H = 0, DPR = 1, focal = 600;

/* ---------- 屏幕空间尺寸基准 ----------
   所有尺寸按 CSS 像素写死（SC 恒为 1）。
   曾按「视口 min 边 / 页面缩放」做反补偿，但那会让预览面板等小视口下的
   色板、钢笔线、纸纹整体缩小变小、观感发糊，已回退为正常网页的固定尺寸。 */
let SC = 1;
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  focal = (Math.min(W, H) * 0.5) / Math.tan(FOV / 2);
  makePaper();
}

/* ---------- 相机（第三视角轨道） ---------- */
const cam = { theta: 0.62, phi: 1.07, dist: 5.7, ty: -0.14 };
let eye = [0,0,5], Fv = [0,0,-1], Rv = [1,0,0], Uv = [0,1,0];
function updCam(){
  const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
  eye = [cam.dist*sp*Math.sin(cam.theta), cam.ty + cam.dist*cp, cam.dist*sp*Math.cos(cam.theta)];
  const tgt = [0, cam.ty, 0];
  Fv = norm3(sub(tgt, eye));
  Rv = norm3(cross(Fv, [0,1,0]));
  Uv = cross(Rv, Fv);
}
function proj(p){
  const v = sub(p, eye);
  const d = dot(v, Fv);
  if (d < 0.15) return null;
  return [W/2 + dot(v, Rv)/d*focal, H/2 - dot(v, Uv)/d*focal, d];
}
const depthOf = p => dot(sub(p, eye), Fv);

/* ---------- 几何常量（整块即水：无池壁、无边沿） ---------- */
const OH = 1.15, WH = 1.15;           // 底座半宽 = 水面半宽
const TOP = 0, BOT = -0.55, WY = 0;   // 顶面 = 水面 / 底面
const co = [[ OH,TOP, OH],[ OH,TOP,-OH],[-OH,TOP,-OH],[-OH,TOP, OH]]; // 顶环（水面边缘）
const cb = co.map(p => [p[0], BOT, p[2]]);                             // 底环
const wi = [[ WH, WY, WH],[ WH, WY,-WH],[-WH, WY,-WH],[-WH, WY, WH]]; // 水面四角（与顶环重合）

/* ---------- 纸纹背景（一次性生成） ---------- */
const paper = document.createElement('canvas');
function makePaper(){
  // 按物理像素生成 → 纸纹颗粒与页面缩放无关（放大页面时不会变糙）
  const pw = Math.max(2, Math.round(W * DPR)), ph = Math.max(2, Math.round(H * DPR));
  paper.width = pw; paper.height = ph;
  const p = paper.getContext('2d');
  p.setTransform(DPR, 0, 0, DPR, 0, 0); // 之后按 CSS 坐标绘制
  p.fillStyle = `rgb(${PAPER[0]},${PAPER[1]},${PAPER[2]})`;
  p.fillRect(0, 0, W, H);
  // 低频斑驳（尺寸随视口比例缩放）
  for (let i = 0; i < 14; i++){
    const x = rnd(0, W), y = rnd(0, H), r = rnd(60, 240)*SC;
    const g = p.createRadialGradient(x, y, 0, x, y, r);
    const warm = Math.random() < 0.5 ? '214,199,172' : '233,226,209';
    g.addColorStop(0, `rgba(${warm},0.045)`);
    g.addColorStop(1, `rgba(${warm},0)`);
    p.fillStyle = g;
    p.fillRect(x-r, y-r, r*2, r*2);
  }
  // 细噪（逐物理像素 → 颗粒大小恒定）
  const id = p.getImageData(0, 0, pw, ph), d = id.data;
  for (let i = 0; i < d.length; i += 4){
    const n = (Math.random() - 0.5) * 11;
    d[i] += n; d[i+1] += n * 0.95; d[i+2] += n * 0.85;
  }
  p.putImageData(id, 0, 0);
  // 短纤维（密度按物理面积 → 页面缩放时数量与粗细都不变）
  p.lineCap = 'round';
  for (let i = 0; i < pw * ph / 1500; i++){
    const x = rnd(0, W), y = rnd(0, H);
    const a = rnd(0, TAU), l = rnd(5, 13)*SC;
    p.strokeStyle = `rgba(${Math.random()<0.5?'196,182,156':'232,224,204'},${rnd(0.05,0.1)})`;
    p.lineWidth = rnd(0.5, 1.1)*SC;
    p.beginPath();
    p.moveTo(x, y);
    p.lineTo(x + Math.cos(a)*l, y + Math.sin(a)*l);
    p.stroke();
  }
  // 极轻暗角
  const vg = p.createRadialGradient(W/2, H/2, Math.min(W, H)*0.44,
                                    W/2, H/2, Math.hypot(W, H)*0.6);
  vg.addColorStop(0, 'rgba(198,182,152,0)');
  vg.addColorStop(1, 'rgba(198,182,152,0.15)');
  p.fillStyle = vg;
  p.fillRect(0, 0, W, H);
}

/* ---------- 手绘笔触 ---------- */
function pen(pts, ink, w, alpha, seed, gap, overdraw){
  if (!pts || pts.length < 2) return;
  w *= SC; // 笔宽随视口比例缩放（页面被放大时不会变粗）
  for (let i = 0; i < pts.length - 1; i++){
    const h = hash(seed*13.7 + i*3.1);
    if (gap && h < gap) continue;
    ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${Math.min(1, alpha*(0.78+0.34*h))})`;
    ctx.lineWidth = w * (0.72 + 0.6 * hash(seed + i*7.3));
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i+1][0], pts[i+1][1]);
    ctx.stroke();
  }
  if (overdraw !== false){
    ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${alpha*0.26})`;
    ctx.lineWidth = w * 0.5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0]+1.4*SC, pts[0][1]+1.0*SC);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0]+1.4*SC, pts[i][1]+1.0*SC);
    ctx.stroke();
  }
}
function fillPoly(pts, rgb, a, offset){
  if (!pts || pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  ctx.fill();
  if (offset){ // 水彩的错位叠层
    ctx.save();
    ctx.translate(2*SC, 1.4*SC);
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a*0.45})`;
    ctx.fill();
    ctx.restore();
  }
}
function strokePoly(pts, rgb, a, w){
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  ctx.lineWidth = w * SC;
  ctx.stroke();
}
function clipQuad(q){ // 裁剪到面四边形：水彩填充绝不越过钢笔勾边
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
  ctx.closePath();
  ctx.clip();
}

/* ---------- 抖动边缘（局部坐标固定 → 每帧投影，不闪烁） ---------- */
function wobblePts(a, b, segs, amp){
  const d = norm3(sub(b, a));
  const p1 = Math.abs(d[1]) > 0.9 ? [1,0,0] : norm3(cross(d, [0,1,0]));
  const p2 = norm3(cross(d, p1));
  const pts = [];
  let o1 = 0, o2 = 0;
  for (let i = 0; i <= segs; i++){
    const t = i / segs;
    o1 = o1*0.55 + rnd(-amp, amp);
    o2 = o2*0.55 + rnd(-amp, amp);
    const s = Math.pow(Math.sin(Math.PI*t), 0.6); // 端点收拢保持棱角
    const bx = a[0]+(b[0]-a[0])*t, by = a[1]+(b[1]-a[1])*t, bz = a[2]+(b[2]-a[2])*t;
    pts.push([bx+(p1[0]*o1+p2[0]*o2)*s, by+(p1[1]*o1+p2[1]*o2)*s, bz+(p1[2]*o1+p2[2]*o2)*s]);
  }
  return pts;
}
