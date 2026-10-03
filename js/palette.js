"use strict";
/* ============================================================
   palette.js：钢笔墨色 / 纸色 / 七套水体主题 + 换主题时的水彩染开
   ============================================================ */

/* ---------- 调色板（莫兰迪低饱和 + 钢笔深褐墨） ---------- */
const INK      = [62, 48, 38];        // 深褐钢笔墨
const PAPER    = [243, 236, 221];     // 米色纸
const SHADOW_C = [115, 128, 136];

/* ---------- 主题色系（莫兰迪低饱和） ---------- */
/* W 水面主色 / LT 亮部 / DK 暗部 / RAIN 雨丝三阶（雪片勾边也取此色）/ SP_D 深色水花·涟漪 / SP_W 白色 */
const THEMES = [
  { name:'墨黑', W:[48,50,54], LT:[66,69,74], DK:[34,36,40],              // 墨黑水面
    RAIN:[[178,182,186],[190,194,198],[165,169,174]],
    SP_D:[190,193,197], SP_W:[250,251,253], topA:0.85, sideA:0.45 },
  { name:'透白', W:[240,243,241], LT:[248,250,248], DK:[219,226,222],          // 半白透明
    RAIN:[[203,210,205],[212,217,212],[193,201,196]],
    SP_D:[214,221,216], SP_W:[253,254,252], topA:0.55, sideA:0.32 },
  { name:'雨蓝', W:[168,190,200], LT:[199,215,223], DK:[143,167,178],          // 现在的蓝
    RAIN:[[120,148,162],[133,158,170],[108,136,151]],
    SP_D:[100,134,150], SP_W:[251,252,250], topA:0.82, sideA:0.42 },
  { name:'浅绿', W:[172,190,173], LT:[202,216,202], DK:[146,166,148],          // 莫兰迪浅绿
    RAIN:[[123,144,124],[135,153,134],[110,132,111]],
    SP_D:[103,127,106], SP_W:[250,252,249], topA:0.80, sideA:0.40 },
  { name:'浅粉', W:[213,187,192], LT:[228,208,212], DK:[187,159,165],          // 莫兰迪浅粉
    RAIN:[[164,138,143],[175,149,154],[151,126,132]],
    SP_D:[151,117,124], SP_W:[252,250,250], topA:0.78, sideA:0.40 },
  { name:'灰紫', W:[193,188,203], LT:[212,208,222], DK:[167,161,180],          // 莫兰迪浅灰紫
    RAIN:[[149,142,162],[160,153,172],[136,129,150]],
    SP_D:[138,129,155], SP_W:[252,251,253], topA:0.78, sideA:0.40 },
  { name:'浅金', W:[240,222,164], LT:[250,238,196], DK:[220,200,140],          // 浅亮金黄
    RAIN:[[208,188,128],[216,196,136],[198,178,120]],
    SP_D:[198,175,115], SP_W:[255,254,247], topA:0.78, sideA:0.40 },
];
let themeIdx = 2;                  // 当前主题
let pal = THEMES[themeIdx];       // 即时调色板：雨丝 / 水花 / 涟漪（切换即生效）
let waterFrom = THEMES[themeIdx]; // 水体过渡 · 起点（快照）
let waterTo   = THEMES[themeIdx]; // 水体过渡 · 终点
let waterT    = 1;                // 过渡进度 0→1
const WATER_DUR = 1.7;            // 水彩铺开时长（秒）
const lerpN = (a, b, t) => a + (b - a) * t;
const lerpC = (a, b, t) => [lerpN(a[0],b[0],t), lerpN(a[1],b[1],t), lerpN(a[2],b[2],t)];
const mixC  = (a, b, t) => lerpC(a, b, t);
const easeW = t => 1 - Math.pow(1 - t, 3);
function curWaterPal(){
  if (waterT >= 1) return waterTo;
  const e = easeW(waterT);
  return {
    W:  lerpC(waterFrom.W,  waterTo.W,  e),
    LT: lerpC(waterFrom.LT, waterTo.LT, e),
    DK: lerpC(waterFrom.DK, waterTo.DK, e),
    topA:  lerpN(waterFrom.topA,  waterTo.topA,  e),
    sideA: lerpN(waterFrom.sideA, waterTo.sideA, e),
  };
}
const blobCol     = (P, kind) => kind === 0 ? P.LT : (kind === 1 ? P.DK : mixC(P.W, P.LT, 0.5));
const sideBlobCol = (P, kind) => kind === 1 ? P.DK : mixC(P.W, P.LT, 0.55);

/* 水彩扩散边界（单位圆抖动形状，切换主题时重生成 → 染开的边缘不规则） */
let paintBlob = null;
function makePaintBlob(){
  const n = 30, pts = [];
  let o = 0;
  for (let k = 0; k < n; k++){
    const a = k/n*TAU;
    o = o*0.55 + rnd(-0.1, 0.1);
    const r = 1 + o;
    pts.push([Math.cos(a)*r, Math.sin(a)*r]);
  }
  pts.push(pts[0]);
  paintBlob = pts;
}
function switchTheme(i){
  if (i === themeIdx || i < 0 || i >= THEMES.length) return;
  waterFrom = curWaterPal();   // 中途再切：从当前混合态继续染
  themeIdx = i;
  pal = THEMES[i];            // 雨/水花/涟漪即时换新（新落下的雨即是新色）
  waterTo = THEMES[i];
  waterT = 0;
  makePaintBlob();
}
