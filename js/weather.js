"use strict";
/* ============================================================
   weather.js：天气调度 —— 雨 / 雪 / 樱
   ------------------------------------------------------------
   每种天气是一个效果对象 fx（effects/*.js）：
     n, live           常驻粒子数 / 当前在空中的粒子数
     sink              浮物渐隐时长（秒）
     spawn(p, first)   出生 / 落定后重生（first：开场或切换天气时，在随机高度出现）
     step(p, dt)       下落一帧；落定（已生成涟漪、浮物）时返回 true
     behind(p, cd)     是否画在水体之前（被半透明水体罩住）；cd = 底座中心深度
     draw(p)
     floatStep(f, dt)  落定后的浮物：漂在水面上 / 散在桌面上
     drawFloat(f)
   切换天气：旧天气的粒子不再重生，落完即止；新天气的粒子约 1 秒内陆续淡入。
   ============================================================ */

const WEATHERS = [
  { key: 'rain',   fx: rainFx },
  { key: 'snow',   fx: snowFx },
  { key: 'sakura', fx: sakuraFx },
];
let weatherIdx = 0;          // 当前天气
const parts = [];            // 空中的雨滴 / 雪片 / 花瓣
const floaters = [];         // 落定的雪片 / 花瓣（漂在水面上，或散在底座四周的桌面上）
const FLOAT_MAX = 170;       // 浮物上限：超出时最早的那片提前渐隐
const FADE_IN = 0.8;         // 新粒子淡入（秒）
const GROW_IN = 1.2;         // 切换天气后多久长满（秒）
let partId = 0, growAcc = 0;

function addPart(fx, first, fade){
  const p = { id: partId++, fx, fade };
  fx.spawn(p, first);
  fx.live++;
  parts.push(p);
}
function switchWeather(i){
  if (i === weatherIdx || i < 0 || i >= WEATHERS.length) return;
  weatherIdx = i;
  growAcc = 0;
  setAmbience(WEATHERS[i].key);
}
// 开场：当前天气直接长满
for (let i = 0; i < WEATHERS[weatherIdx].fx.n; i++) addPart(WEATHERS[weatherIdx].fx, true, 1);

/* ---------- 雪 / 花瓣共用：落定判定 ----------
   先过水面：落在水上 → 浮在水面；落在水体外 → 继续落到桌面（底面高度）。
   水面以下只会在水体外侧：被风吹向底座时贴着侧壁滑落，不钻进水里。 */
function settle(p){
  if (p.y > WY) return false;
  if (!p.out){
    if (Math.abs(p.x) < WH && Math.abs(p.z) < WH){ p.fx.landWater(p); return true; }
    p.out = true;
  }
  const m = WH + 0.012, ax = m - Math.abs(p.x), az = m - Math.abs(p.z);
  if (ax > 0 && az > 0){
    if (ax < az) p.x = p.x < 0 ? -m : m;
    else         p.z = p.z < 0 ? -m : m;
  }
  if (p.y > BOT) return false;
  p.fx.landGround(p);
  return true;
}

/* ---------- 浮物 ---------- */
function addFloater(f){
  f.t = 0; f.ix = 0; f.iz = 0;
  floaters.push(f);
  if (floaters.length > FLOAT_MAX){
    // 最早的、还没开始渐隐的那一片提前渐隐（不直接删，避免突然消失）
    for (const o of floaters){
      if (o.life - o.t > o.fx.sink){ o.life = o.t + o.fx.sink; break; }
    }
  }
}
/* 水面缓流：极慢的回旋 + 一点顺风漂；被涟漪推开的冲量指数衰减；漂到水缘就停在边上 */
function waterDrift(f, dt){
  f.x += (-f.z*0.018 + 0.012 + f.ix)*dt;
  f.z += ( f.x*0.018 + 0.004 + f.iz)*dt;
  const k = Math.exp(-dt*2.4);
  f.ix *= k; f.iz *= k;
  const m = WH - 0.035;
  if (Math.abs(f.x) > m){ f.x = f.x < 0 ? -m : m; f.ix = 0; }
  if (Math.abs(f.z) > m){ f.z = f.z < 0 ? -m : m; f.iz = 0; }
}
/* 以 (x, z) 为圆心把水面上的浮物推开：r 影响半径，s 力度 */
function nudgeFloaters(x, z, r, s){
  for (const f of floaters){
    if (f.ground) continue;
    const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz);
    if (d >= r || d < 1e-4) continue;
    const k = s*(1 - d/r);
    f.ix += dx/d*k; f.iz += dz/d*k;
    if (f.spin !== undefined) f.spin += rnd(-2, 2)*k;
  }
}

/* ---------- 更新 ---------- */
function updateWeather(dt){
  const cur = WEATHERS[weatherIdx].fx;
  // 新天气陆续长满
  if (cur.live < cur.n){
    growAcc += cur.n*dt/GROW_IN;
    for (; growAcc >= 1 && cur.live < cur.n; growAcc--) addPart(cur, true, 0);
  }
  for (let i = parts.length - 1; i >= 0; i--){
    const p = parts[i];
    if (p.fade < 1) p.fade = Math.min(1, p.fade + dt/FADE_IN);
    if (!p.fx.step(p, dt)) continue;
    if (p.fx === cur && cur.live <= cur.n) cur.spawn(p, false); // 当前天气：落定即在高处重生
    else { parts.splice(i, 1); p.fx.live--; }                   // 旧天气：落完即止
  }
  for (let i = floaters.length - 1; i >= 0; i--){
    const f = floaters[i];
    f.t += dt;
    if (f.t >= f.life) floaters.splice(i, 1);
    else f.fx.floatStep(f, dt);
  }
}

/* ---------- 绘制（按与水体的遮挡关系分三段） ---------- */
/* 1. 水体之前：远处的雨、水体背后正往桌面落的、背后桌面上的（都被半透明水体罩住） */
function drawWeatherBehind(cd){
  for (const p of parts) p.dp = depthOf([p.x, p.y, p.z]);   // 本帧深度：behind 判定与远近排序共用
  for (const f of floaters) if (f.ground && depthOf([f.x, f.y, f.z]) > cd) f.fx.drawFloat(f);
  for (const p of parts) if (p.fx.behind(p, cd)) p.fx.draw(p);
}
/* 2. 水面上漂着的（涟漪之上） */
function drawFloaters(){
  for (const f of floaters) if (!f.ground) f.fx.drawFloat(f);
}
/* 3. 水体之后：前方桌面上的，再是其余空中的粒子（远到近，近的盖住远的） */
function drawWeatherFront(cd){
  for (const f of floaters) if (f.ground && depthOf([f.x, f.y, f.z]) <= cd) f.fx.drawFloat(f);
  const front = parts.filter(p => !p.fx.behind(p, cd));
  front.sort((a, b) => b.dp - a.dp);
  for (const p of front) p.fx.draw(p);
}
