"use strict";
/* ============================================================
   scene.js：底座 + 整块水体（钢笔棱线 / 侧壁与水面水彩）+ 涟漪 / 水花
   ============================================================ */

/* ---------- 底座边（预生成抖动钢笔线） ---------- */
const edgeDefs = [];
(function(){
  const amp = 0.013, segs = 12;
  for (let i = 0; i < 4; i++){
    const j = (i+1)%4;
    edgeDefs.push({ a: co[i], b: co[j], id: 't'+i, w: 1.9, al: 0.88, grp: 'top' });      // 顶棱（水缘）
    edgeDefs.push({ a: cb[i], b: cb[j], id: 'b'+i, w: 1.4, al: 0.62, grp: 'bot', side: i });// 底棱
    edgeDefs.push({ a: co[i], b: cb[i], id: 'v'+i, w: 1.5, al: 0.72, grp: 'ver', side: [i, (i+3)%4] }); // 竖棱
  }
  for (const e of edgeDefs) e.pts = wobblePts(e.a, e.b, segs, amp);
})();

/* ---------- 侧壁水彩装饰（局部坐标预生成） ---------- */
function sideBasis(i){ // 侧面 i：A=co[i] 顶角，E1 水平，E2 向下
  const j = (i+1)%4;
  const A = co[i], E1 = sub(co[j], co[i]), E2 = sub(cb[i], co[i]);
  return { A, E1, E2, L1: Math.hypot(E1[0],E1[1],E1[2]), L2: Math.hypot(E2[0],E2[1],E2[2]) };
}
const sideDecos = [];
for (let i = 0; i < 4; i++){
  const { A, E1, E2, L1, L2 } = sideBasis(i);
  const blobs = [];
  for (let b = 0; b < 5; b++){
    const uc = rnd(0.12, 0.88), vc = rnd(0.1, 0.85), r = rnd(0.1, 0.3), n = 7;
    const pts = [];
    let o = 0;
    for (let k = 0; k < n; k++){
      const a = k/n*TAU;
      o = o*0.5 + rnd(-0.25, 0.25);
      const rr = r*(1+o);
      pts.push([ A[0]+E1[0]*(uc+Math.cos(a)*rr/L1)+E2[0]*(vc+Math.sin(a)*rr/L2),
                 A[1]+E1[1]*(uc+Math.cos(a)*rr/L1)+E2[1]*(vc+Math.sin(a)*rr/L2),
                 A[2]+E1[2]*(uc+Math.cos(a)*rr/L1)+E2[2]*(vc+Math.sin(a)*rr/L2) ]);
    }
    blobs.push({ pts, kind: b % 2, a: rnd(0.08, 0.17) });
  }
  const hatches = [];
  for (let h = 0; h < 7; h++){
    const u = rnd(0.08, 0.92), v = rnd(0.66, 0.97), l1 = rnd(0.1, 0.22), l2 = rnd(0.05, 0.12);
    hatches.push([
      [ A[0]+E1[0]*u+E2[0]*v, A[1]+E1[1]*u+E2[1]*v, A[2]+E1[2]*u+E2[2]*v ],
      [ A[0]+E1[0]*(u+l1)+E2[0]*(v+l2), A[1]+E1[1]*(u+l1)+E2[1]*(v+l2), A[2]+E1[2]*(u+l1)+E2[2]*(v+l2) ]
    ]);
  }
  sideDecos.push({ blobs, hatches });
}
/* 水面水彩 */
const waterBlobs = [];
for (let b = 0; b < 9; b++){
  const cx = rnd(-0.75, 0.75), cz = rnd(-0.75, 0.75), r = rnd(0.16, 0.42), n = 8;
  const pts = [];
  let o = 0;
  for (let k = 0; k < n; k++){
    const a = k/n*TAU;
    o = o*0.5 + rnd(-0.28, 0.28);
    const rr = r*(1+o);
    pts.push([cx+Math.cos(a)*rr, WY+0.001, cz+Math.sin(a)*rr]);
  }
  const kind = b % 3;
  waterBlobs.push({ pts, kind,
    a: kind===1 ? rnd(0.10,0.17) : rnd(0.16,0.28) });
}
const waterSpecks = [];
for (let i = 0; i < 30; i++) waterSpecks.push([rnd(-0.95,0.95), rnd(-0.95,0.95)]);

/* ---------- 涟漪 / 水花 ---------- */
const ripples = [];
const splashes = [];
/* big：点击的大涟漪；soft：雪片 / 花瓣轻轻落水，只一圈更淡更细的纹，半径约为 soft */
function addRipple(cx, cz, big, soft){
  const nRings = big ? 3 : (soft ? 1 : (Math.random() < 0.55 ? 2 : 1));
  const rings = [];
  for (let k = 0; k < nRings; k++){
    const jit = [];
    for (let j = 0; j < 18; j++) jit.push([rnd(0, 0.35), rnd(-0.12, 0.12)]);
    rings.push({ delay: k*rnd(0.12, 0.2),
      maxR: soft ? soft*rnd(0.8, 1.2) : (big ? [0.34, 0.24, 0.15] : [rnd(0.10, 0.22), rnd(0.06, 0.13), 0.05])[k] || 0.05,
      jit, w: big ? rnd(1.8, 2.4) : (soft ? rnd(1.0, 1.4) : rnd(1.4, 2.0)),
      c: Math.random() < 0.6 ? pal.SP_D : pal.SP_W, // 深色为主，偶尔白环
      a: soft ? 0.6 : 1 });
  }
  ripples.push({ cx, cz, t: 0, life: big ? rnd(1.7, 2.2) : rnd(1.0, 1.6), rings, seed: Math.random()*1000 });
  if (ripples.length > 46) ripples.shift();
}
function addSplash(x, z, n){
  for (let i = 0; i < n; i++){
    const a = rnd(0, TAU);
    splashes.push({ x, y: WY+0.012, z,
      vx: Math.cos(a)*rnd(0.15, 0.6), vy: rnd(0.7, 1.7), vz: Math.sin(a)*rnd(0.15, 0.6),
      t: 0, life: rnd(0.28, 0.5), r: rnd(1.0, 2.4),
      white: Math.random() < 0.55 });
  }
}
function updateRipples(dt){
  for (let i = ripples.length-1; i >= 0; i--){
    ripples[i].t += dt;
    if (ripples[i].t > ripples[i].life + 0.4) ripples.splice(i, 1);
  }
  for (let i = splashes.length-1; i >= 0; i--){
    const s = splashes[i];
    s.t += dt;
    s.vy -= 5.5*dt;
    s.x += s.vx*dt; s.y += s.vy*dt; s.z += s.vz*dt;
    if (s.t >= s.life) splashes.splice(i, 1);
  }
}

/* ---------- 渲染 ---------- */
const sideN = [[1,0,0],[0,0,-1],[-1,0,0],[0,0,1]]; // 外法线
const boxCenter = [0, (TOP+BOT)/2, 0];

function faceCenter(pts){ let x=0,y=0,z=0; for(const p of pts){x+=p[0];y+=p[1];z+=p[2];} return [x/pts.length,y/pts.length,z/pts.length]; }
function drawSide(i){
  const j = (i+1)%4;
  const P = curWaterPal();
  const q = [co[i], co[j], cb[j], cb[i]].map(proj);
  // 侧壁整体裁剪：半透明水彩、水斑、光丝全部锁在勾边内
  ctx.save();
  clipQuad(q);
  fillPoly(q, P.W, P.sideA, true);
  // 下半水色更深更沉（水的厚度）
  const vAt = (a, b, v) => [a[0]+(b[0]-a[0])*v, a[1]+(b[1]-a[1])*v, a[2]+(b[2]-a[2])*v];
  fillPoly([vAt(co[i], cb[i], 0.5), vAt(co[j], cb[j], 0.5), cb[j], cb[i]].map(proj), P.DK, 0.15, false);
  const d = sideDecos[i];
  for (const b of d.blobs) fillPoly(b.pts.map(proj), sideBlobCol(P, b.kind), b.a, false);
  for (const h of d.hatches){ // 折射光丝
    const p1 = proj(h[0]), p2 = proj(h[1]);
    if (p1 && p2) pen([p1, p2], P.DK, 1.0, 0.2, i*31 + h[0][0]*57, 0, false);
  }
  ctx.restore();
}
function drawWater(){
  const q = wi.map(proj);
  const P = curWaterPal();
  // 水面整体裁剪：所有水彩填充锁在钢笔勾边内
  ctx.save();
  clipQuad(q);
  fillPoly(q, P.W, P.topA, true);
  for (const b of waterBlobs) fillPoly(b.pts.map(proj), blobCol(P, b.kind), b.a, false);
  // 新颜色水彩染开：只做颜色铺开填满底座，不加波纹/湿边
  if (waterT < 1 && paintBlob){
    const s = 1.92 * easeW(waterT) + 0.001;
    const bp = paintBlob.map(p => proj([p[0]*s, WY + 0.004, p[1]*s]));
    if (bp.every(p => p)){
      ctx.save();
      clipQuad(bp);
      fillPoly(q, waterTo.W, waterTo.topA, true);
      for (const b of waterBlobs) fillPoly(b.pts.map(proj), blobCol(waterTo, b.kind), b.a, false);
      ctx.restore();
    }
  }
  // 纸纹肌理（multiply 让水彩透出纸的颗粒）
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.5;
  ctx.drawImage(paper, 0, 0, W, H);
  ctx.restore();
  // 深色沉边（被裁剪，只留内侧半圈）
  strokePoly(q, P.DK, 0.14, 4);
  // 斑点
  ctx.fillStyle = `rgba(${P.DK[0]},${P.DK[1]},${P.DK[2]},0.18)`;
  for (const s of waterSpecks){
    const p = proj([s[0], WY+0.001, s[1]]);
    if (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.1*SC, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  // 水面边界钢笔线（最上层，不被裁剪）
  for (let i = 0; i < 4; i++){
    const j = (i+1)%4;
    pen(wobblePts(wi[i], wi[j], 10, 0.008).map(proj), P.DK, 1.3, 0.55, i*17+3, 0.06);
  }
}
function drawShadow(){
  const e = 1.14, y = BOT - 0.015;
  const sq = [[e,y,e],[e,y,-e],[-e,y,-e],[-e,y,e]].map(p => [p[0]+0.05, p[1], p[2]+0.04]);
  fillPoly(sq.map(proj), SHADOW_C, 0.09, false);
  const sq2 = sq.map(p => [p[0]*1.07, p[1], p[2]*1.07]);
  fillPoly(sq2.map(proj), SHADOW_C, 0.05, false);
}
/* 底座 + 整块水体：背面棱线 → 各面（远到近）→ 近处棱线 */
function drawBox(){
  const sideVis = sideN.map(n => dot(n, sub(eye, boxCenter)) > 0);
  // 背面棱线：先画，被半透明水体罩住 → 隐约可透
  const hidEdge = e => (e.grp === 'bot' && !sideVis[e.side]) || (e.grp === 'ver' && !(sideVis[e.side[0]] || sideVis[e.side[1]]));
  for (const e of edgeDefs){
    if (!hidEdge(e)) continue;
    const pts = e.pts.map(proj);
    if (pts.some(p => !p)) continue;
    pen(pts, INK, e.w*0.8, e.al*0.3, e.id.length*37 + e.pts[0][0]*13, 0.05);
  }
  // 整块水体（画家算法：远面先画，半透明叠出厚度）
  const faces = [];
  for (let i = 0; i < 4; i++){
    const j = (i+1)%4;
    faces.push({ d: depthOf(faceCenter([co[i], co[j], cb[j], cb[i]])), fn: () => drawSide(i) });
  }
  faces.push({ d: depthOf([0, WY, 0]), fn: drawWater });
  faces.sort((a, b) => b.d - a.d);
  for (const f of faces) f.fn();

  // 近处钢笔棱线（可见面相邻的棱一定可见）
  for (const e of edgeDefs){
    if (hidEdge(e)) continue;
    const pts = e.pts.map(proj);
    if (pts.some(p => !p)) continue;
    pen(pts, INK, e.w, e.al, e.id.length*37 + e.pts[0][0]*13, 0.05);
  }
}
function drawRipples(){
  if (!ripples.length) return;
  const q = wi.map(proj);
  ctx.save();
  clipQuad(q); // 涟漪环裁剪在水面勾边内
  for (const rp of ripples){
    // 撞击点：落水瞬间的一个深色小点（真实反馈）
    if (rp.t < 0.16){
      const pc = proj([rp.cx, WY + 0.006, rp.cz]);
      if (pc){
        ctx.fillStyle = `rgba(${pal.SP_D[0]},${pal.SP_D[1]},${pal.SP_D[2]},${Math.min(1, 0.95*(1 - rp.t/0.16))})`;
        ctx.beginPath(); ctx.arc(pc[0], pc[1], 1.8*SC, 0, TAU); ctx.fill();
      }
    }
    for (const ring of rp.rings){
      const t = (rp.t - ring.delay) / rp.life;
      if (t < 0 || t > 1) continue;
      const r = ring.maxR * (1 - (1-t)*(1-t));
      const alpha = Math.min(1, 1.15 * (1 - t)) * ring.a;
      const pts = [];
      for (let k = 0; k < 18; k++){
        const a = k/18*TAU + ring.jit[k][0];
        const rr = r * (1 + ring.jit[k][1]);
        const p = proj([rp.cx + Math.cos(a)*rr, WY + 0.004, rp.cz + Math.sin(a)*rr]);
        if (p) pts.push(p);
      }
      pts.push(pts[0]);
      pen(pts, ring.c, ring.w, alpha, rp.seed + ring.delay*91, 0.05);
    }
  }
  ctx.restore();
}
function drawSplashes(){
  for (const s of splashes){
    if (s.t >= s.life) continue;
    const k = 1 - s.t/s.life;
    const p1 = proj([s.x, s.y, s.z]);
    if (!p1) continue;
    // 沿速度方向的水珠拖尾 → 有质量的实感
    const p0 = proj([s.x - s.vx*0.05, s.y - s.vy*0.05, s.z - s.vz*0.05]);
    const c = s.white ? pal.SP_W : pal.SP_D;
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(1, 0.95*k + 0.15)})`;
    ctx.lineWidth = Math.max(0.8, s.r*k + 0.5) * SC;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p0 ? p0[0] : p1[0], p0 ? p0[1] : p1[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
    // 白水珠的芯点亮
    if (s.white && s.t < s.life*0.5){
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 0.9*k)})`;
      ctx.beginPath();
      ctx.arc(p1[0], p1[1], Math.max(0.5, s.r*0.5*k) * SC, 0, TAU);
      ctx.fill();
    }
  }
}
