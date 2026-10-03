"use strict";
/* ============================================================
   effects/rain.js：雨 —— 斜风雨丝，落水溅起涟漪与水花
   （效果对象的接口见 weather.js 顶部说明）
   ============================================================ */

const wind = norm3([0.30, -1, 0.13]);
const rainFx = {
  n: 85, live: 0,
  spawn(d, first){
    // 先定落点：铺满整个方框顶面，偶带一点点随性外溢
    let lx, lz;
    if (Math.random() < 0.88){ lx = rnd(-OH, OH); lz = rnd(-OH, OH); }
    else { lx = rnd(-OH-0.16, OH+0.16); lz = rnd(-OH-0.16, OH+0.16); }
    d.y = WY + (first ? rnd(0, 2.6) : rnd(1.8, 2.8));
    // 风偏补偿：出生点反推，让下落被吹走的量刚好落在目标落点上（修整体斜偏）
    const k = (d.y - WY) / -wind[1];
    d.x = lx - wind[0]*k;
    d.z = lz - wind[2]*k;
    d.spd = rnd(3.3, 5.0);
    d.len = rnd(0.30, 0.48);
    d.c = pal.RAIN[(Math.random()*3)|0];
    d.w = rnd(1.1, 1.8);   // 稍粗一丁点，有实感
    d.a = rnd(0.45, 0.7);
  },
  step(d, dt){
    d.y += wind[1]*d.spd*dt;
    d.x += wind[0]*d.spd*dt;
    d.z += wind[2]*d.spd*dt;
    if (d.y > WY) return false;
    if (Math.abs(d.x) < WH && Math.abs(d.z) < WH){ // 整块顶面都是水
      if (Math.random() < 0.7) addRipple(d.x, d.z, false);
      if (Math.random() < 0.2) addSplash(d.x, d.z, 2 + (Math.random()*3|0));
      nudgeFloaters(d.x, d.z, 0.14, 0.05);         // 打在漂着的花瓣旁：轻轻推开
    }
    return true;
  },
  // 雨分两组：远处（先画，透过半透明水体隐约可见）/ 近处（最后画）
  behind: (d, cd) => d.dp > cd + 0.35,
  draw(d){
    const h = proj([d.x, d.y, d.z]);
    const t = proj([d.x - wind[0]*d.len, d.y - wind[1]*d.len, d.z - wind[2]*d.len]);
    if (!h || !t) return;
    const pts = [h];
    for (let k = 1; k < 3; k++){
      const u = k/3;
      pts.push([h[0]+(t[0]-h[0])*u + rnd(-1.3,1.3)*SC, h[1]+(t[1]-h[1])*u + rnd(-1.3,1.3)*SC]);
    }
    pts.push(t);
    pen(pts, d.c, d.w, d.a * d.fade, d.id*7.7, 0.03, false);
  },
};
