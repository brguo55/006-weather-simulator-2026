"use strict";
/* ============================================================
   effects/sakura.js：樱 —— 花瓣在 3D 里翻飞（自转 + 俯仰摇摆，少数整片翻滚），
   正反两面深浅不同；落水后浮在水面上随缓流漂、被涟漪推开，最后慢慢沉没；
   落在水体外的散在底座四周的桌面上
   ============================================================ */

const SAKURA_DRIFT = [0.17, 0.05];   // 春风：比雪更斜（x, z，与雨同向）
/* 花瓣轮廓（局部坐标，长 1：v = -0.5 为瓣根，v = +0.5 为带缺刻的瓣尖） */
const PETAL = [
  [0,-0.5],[0.13,-0.38],[0.26,-0.2],[0.35,0],[0.38,0.17],[0.34,0.33],[0.22,0.46],[0.08,0.48],[0,0.37],
  [-0.08,0.48],[-0.22,0.46],[-0.34,0.33],[-0.38,0.17],[-0.35,0],[-0.26,-0.2],[-0.13,-0.38]
];
const PETAL_COLS = [[246,214,221],[240,198,208],[250,231,233],[235,186,199]]; // 樱粉：浅 / 中 / 近白 / 稍深
const PETAL_BACK = [216,152,172];   // 反面更深一点
const PETAL_INK  = [168,102,120];   // 勾边：带粉的深褐
const PETAL_VEIN = [214,136,160];   // 瓣根一抹深粉
const PETAL_SINK = 3;               // 沉没（渐隐）时长（秒）

/* 姿态 → 花瓣平面的两根轴（e1 横向，e2 纵向）：先俯仰（绕 x）、再侧倾（绕 z）、最后偏航（绕 y） */
function petalAxes(yaw, pitch, roll){
  const c1 = Math.cos(pitch), s1 = Math.sin(pitch);
  const c2 = Math.cos(roll),  s2 = Math.sin(roll);
  const c3 = Math.cos(yaw),   s3 = Math.sin(yaw);
  return [
    [c2*c3, s2, -c2*s3],
    [s1*s2*c3 + c1*s3, -s1*c2, -s1*s2*s3 + c1*c3],
  ];
}
const petalPitch = p => p.tumble ? p.pa : Math.sin(p.pa)*p.amp;

/* 圆滑闭合轮廓：过各边中点的二次曲线（瓣尖缺刻仍在）；ox, oy 为整体平移 */
function petalPath(pts, ox, oy){
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[n-1][0] + pts[0][0])/2 + ox, (pts[n-1][1] + pts[0][1])/2 + oy);
  for (let i = 0; i < n; i++){
    const a = pts[i], b = pts[(i+1)%n];
    ctx.quadraticCurveTo(a[0] + ox, a[1] + oy, (a[0] + b[0])/2 + ox, (a[1] + b[1])/2 + oy);
  }
  ctx.closePath();
}
/* 画一片花瓣：c 中心，s 长度；wet = 漂在水面上（先在水上压一道淡淡的影） */
function drawPetal(c, e1, e2, s, col, a, wet){
  const pts = [];
  for (const q of PETAL){
    const u = q[0]*s, v = q[1]*s;
    const p = proj([c[0] + e1[0]*u + e2[0]*v, c[1] + e1[1]*u + e2[1]*v, c[2] + e1[2]*u + e2[2]*v]);
    if (!p) return;
    pts.push(p);
  }
  // 朝向相机的是哪一面：正面浅、反面深 → 翻飞时一明一暗
  const up = dot(cross(e2, e1), sub(eye, c)) > 0;
  const fc = up ? col : mixC(col, PETAL_BACK, 0.5);
  if (wet){
    const D = curWaterPal().DK;
    petalPath(pts, 1.2*SC, 1.1*SC);
    ctx.fillStyle = `rgba(${D[0]|0},${D[1]|0},${D[2]|0},${0.22*a})`;
    ctx.fill();
  }
  petalPath(pts, 0, 0);
  ctx.fillStyle = `rgba(${fc[0]|0},${fc[1]|0},${fc[2]|0},${0.93*a})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${PETAL_INK[0]},${PETAL_INK[1]},${PETAL_INK[2]},${0.5*a})`;
  ctx.lineWidth = 0.7*SC;
  ctx.stroke();
  // 瓣根一抹深粉
  const b0 = proj([c[0] - e2[0]*s*0.4,  c[1] - e2[1]*s*0.4,  c[2] - e2[2]*s*0.4]);
  const b1 = proj([c[0] - e2[0]*s*0.08, c[1] - e2[1]*s*0.08, c[2] - e2[2]*s*0.08]);
  if (b0 && b1){
    ctx.strokeStyle = `rgba(${PETAL_VEIN[0]},${PETAL_VEIN[1]},${PETAL_VEIN[2]},${0.45*a})`;
    ctx.lineWidth = Math.max(0.7, s*focal/b0[2]*0.13);
    ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
  }
}

const sakuraFx = {
  n: 44, live: 0, sink: PETAL_SINK,
  spawn(p, first){
    p.vy = rnd(0.24, 0.40);
    p.y = WY + (first ? rnd(0.05, 2.9) : rnd(2.4, 3.0));
    // 先定落点再按漂移反推出生点；约两成散落到底座四周
    const s = Math.random() < 0.8 ? 0 : 0.36;
    const k = (p.y - WY) / p.vy;
    p.x = rnd(-OH-s, OH+s) - SAKURA_DRIFT[0]*k;
    p.z = rnd(-OH-s, OH+s) - SAKURA_DRIFT[1]*k;
    p.s = rnd(0.055, 0.08);                                          // 花瓣长
    p.sw = rnd(0.08, 0.2); p.fr = rnd(0.7, 1.4); p.ph = rnd(0, TAU); // 飘摆
    p.yaw = rnd(0, TAU); p.wy = rnd(-1.8, 1.8);                      // 自转
    p.tumble = Math.random() < 0.3;                                  // 整片翻滚 / 来回摇摆
    p.pa = rnd(0, TAU);
    p.wp = p.tumble ? rnd(2.5, 5)*(Math.random() < 0.5 ? -1 : 1) : rnd(1.6, 3);
    p.amp = rnd(0.5, 1.1);
    p.ra = rnd(0, TAU); p.wr = rnd(1.1, 2.3); p.ramp = rnd(0.25, 0.6); // 侧倾
    p.col = PETAL_COLS[(Math.random()*PETAL_COLS.length)|0];
    p.a = rnd(0.82, 1);
    p.out = false;
    if (!first) p.fade = 0;               // 在高处重生也淡入，不凭空冒出
  },
  step(p, dt){
    p.ph += p.fr*dt; p.pa += p.wp*dt; p.ra += p.wr*dt; p.yaw += p.wy*dt;
    p.x += (SAKURA_DRIFT[0] + Math.cos(p.ph)*p.sw*p.fr)*dt;
    p.z += (SAKURA_DRIFT[1] + Math.cos(p.ph*0.8 + 1.3)*p.sw*0.5*p.fr)*dt;
    p.y -= p.vy*(1 + 0.3*Math.sin(p.pa*2))*dt;   // 翻飞时一顿一顿地落
    return settle(p);
  },
  landWater(p){
    addRipple(p.x, p.z, false, 0.1);
    // 落水时的俯仰 → 正面 / 反面朝上，剩下的倾角很快放平
    const pitch = petalPitch(p);
    addFloater({ fx: sakuraFx, x: p.x, y: WY + 0.004, z: p.z, s: p.s, col: p.col, a: p.a,
      yaw: p.yaw, spin: rnd(-0.5, 0.5), flip: Math.cos(pitch) < 0, tilt: Math.atan(Math.tan(pitch))*0.8,
      ph: rnd(0, TAU), life: rnd(14, 24), ground: false });
  },
  landGround(p){
    addFloater({ fx: sakuraFx, x: p.x, y: BOT + 0.004, z: p.z, s: p.s, col: p.col, a: p.a,
      yaw: p.yaw, spin: 0, flip: Math.random() < 0.3, tilt: 0,
      ph: 0, life: rnd(8, 14), ground: true });
  },
  // 只有落到水面以下、在水体背后的花瓣才会被水体挡住
  behind: (p, cd) => p.y < WY && p.dp > cd,
  draw(p){
    const [e1, e2] = petalAxes(p.yaw, petalPitch(p), Math.sin(p.ra)*p.ramp);
    drawPetal([p.x, p.y, p.z], e1, e2, p.s, p.col, p.a*p.fade, false);
  },
  floatStep(f, dt){
    f.yaw += f.spin*dt;
    f.spin *= Math.exp(-dt*0.4);
    f.tilt *= Math.exp(-dt*7);
    if (!f.ground) waterDrift(f, dt);
  },
  drawFloat(f){
    // 最后几秒慢慢沉下去：颜色被水色吃掉、渐隐（桌面上的只渐隐）
    const sink = Math.max(0, 1 - (f.life - f.t)/PETAL_SINK);
    const bob = f.ground ? 0 : Math.sin(f.t*1.7 + f.ph)*0.06;   // 随水轻轻起伏
    const [e1, e2] = petalAxes(f.yaw, (f.flip ? Math.PI : 0) + f.tilt + bob, 0);
    const col = f.ground ? f.col : mixC(f.col, curWaterPal().W, 0.6*sink);
    drawPetal([f.x, f.y, f.z], e1, e2, f.s, col, f.a*(1 - sink), !f.ground);
  },
};
