"use strict";
/* ============================================================
   effects/snow.js：雪 —— 慢落、左右飘摆，六角冰晶与圆绒雪两种；
   落进水里即化（白点边缩小边变淡，偶尔一圈极细的涟漪），
   落在水体外的停在底座四周的桌面上，慢慢化掉
   ============================================================ */

const SNOW_DRIFT = [0.07, 0.03];   // 微风：雪几乎直落，只带一点点斜（x, z，与雨同向）
const snowFx = {
  n: 150, live: 0, sink: 1,
  spawn(f, first){
    f.vy = rnd(0.30, 0.50);
    f.y = WY + (first ? rnd(0.05, 2.9) : rnd(2.4, 3.0));
    // 先定落点再按漂移反推出生点（同雨）；少数散落到底座四周
    const s = Math.random() < 0.88 ? 0 : 0.3;
    const k = (f.y - WY) / f.vy;
    f.x = rnd(-OH-s, OH+s) - SNOW_DRIFT[0]*k;
    f.z = rnd(-OH-s, OH+s) - SNOW_DRIFT[1]*k;
    f.star = Math.random() < 0.2;                                   // 六角冰晶 / 圆绒雪
    f.r = f.star ? rnd(0.017, 0.025) : rnd(0.0075, 0.017);
    f.sw = rnd(0.03, 0.1); f.fr = rnd(0.5, 1.2); f.ph = rnd(0, TAU); // 飘摆：幅度 / 频率 / 相位
    f.rot = rnd(0, TAU); f.spin = rnd(-1.4, 1.4);
    f.c = pal.RAIN[(Math.random()*3)|0];  // 勾边取主题雨色：换主题后新落的雪即新色
    f.a = rnd(0.7, 1);
    f.out = false;
    if (!first) f.fade = 0;               // 在高处重生也淡入，不凭空冒出
  },
  step(f, dt){
    f.ph += f.fr*dt;
    f.x += (SNOW_DRIFT[0] + Math.cos(f.ph)*f.sw*f.fr)*dt;
    f.z += (SNOW_DRIFT[1] + Math.cos(f.ph*0.7 + 1.1)*f.sw*0.5*f.fr)*dt;
    f.y -= f.vy*dt;
    f.rot += f.spin*dt;
    return settle(f);
  },
  landWater(f){
    if (Math.random() < 0.3) addRipple(f.x, f.z, false, 0.06);
    addFloater({ fx: snowFx, x: f.x, y: WY + 0.003, z: f.z, r: f.r, c: f.c, life: rnd(1.4, 3.0), ground: false });
  },
  landGround(f){
    addFloater({ fx: snowFx, x: f.x, y: BOT, z: f.z, r: f.r, c: f.c, life: rnd(3, 6), ground: true });
  },
  // 只有落到水面以下、在水体背后的雪才会被水体挡住
  behind: (f, cd) => f.y < WY && f.dp > cd,
  draw(f){
    const p = proj([f.x, f.y, f.z]);
    if (!p) return;
    const r = Math.max(0.7, f.r*focal/p[2]);
    const a = f.a*f.fade, w = pal.SP_W, c = f.c;
    // 绒边：一圈极淡的白晕，雪才显得软
    ctx.fillStyle = `rgba(${w[0]},${w[1]},${w[2]},${0.22*a})`;
    ctx.beginPath(); ctx.arc(p[0], p[1], r*1.9, 0, TAU); ctx.fill();
    if (f.star){ // 六角冰晶：三笔交叉 + 白芯
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.85*a})`;
      ctx.lineWidth = Math.max(0.7, r*0.3);
      ctx.beginPath();
      for (let k = 0; k < 3; k++){
        const dx = Math.cos(f.rot + k*TAU/6)*r*1.25, dy = Math.sin(f.rot + k*TAU/6)*r*1.25;
        ctx.moveTo(p[0]-dx, p[1]-dy); ctx.lineTo(p[0]+dx, p[1]+dy);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(${w[0]},${w[1]},${w[2]},${0.95*a})`;
      ctx.beginPath(); ctx.arc(p[0], p[1], r*0.42, 0, TAU); ctx.fill();
    } else {     // 圆绒雪：白芯 + 一圈极细的淡彩勾边
      ctx.fillStyle = `rgba(${w[0]},${w[1]},${w[2]},${0.95*a})`;
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.55*a})`;
      ctx.lineWidth = 0.65*SC;
      ctx.stroke();
    }
  },
  floatStep(s, dt){ if (!s.ground) waterDrift(s, dt); },
  drawFloat(s){
    const p = proj([s.x, s.y, s.z]);
    if (!p) return;
    const k = s.t/s.life;
    // 平躺的圆 → 透视压扁成椭圆（视线越贴水面越扁）
    const sq = Math.max(0.2, (eye[1] - s.y)/Math.hypot(eye[0]-s.x, eye[1]-s.y, eye[2]-s.z));
    const r = Math.max(0.6, s.r*focal/p[2]*(s.ground ? 1.1 : 1.2 - 0.6*k)); // 水里边化边缩小
    const a = 1 - k*k;
    const w = pal.SP_W;
    ctx.fillStyle = `rgba(${w[0]},${w[1]},${w[2]},${0.9*a})`;
    ctx.beginPath(); ctx.ellipse(p[0], p[1], r, r*sq, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${0.4*a})`;
    ctx.lineWidth = 0.6*SC;
    ctx.stroke();
  },
};
