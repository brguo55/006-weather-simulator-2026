"use strict";
/* ============================================================
   audio.js：声音 —— 每种天气一路环境声，切换天气时交叉淡入淡出
     雨：录制的雨声（assets/rain-sound.js，base64 WAV 内嵌；AudioBuffer 样本级无缝循环）
     雪：低沉柔和的风声（布朗噪声 + 低通，阵风起伏）
     樱：轻柔的春风（粉噪声 + 带通）+ 偶尔一声风铃（都节音阶）
   首次点击 / 按键后才开声（浏览器自动播放策略）
   ============================================================ */

let AC = null;
const beds = {};      // 各天气环境声的总闸（增益 0 ↔ 1）
let chimeIn = 2.5;    // 距下一声风铃（秒）

function initAudio(){
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    for (const w of WEATHERS){
      const g = AC.createGain();
      g.gain.value = 0;
      g.connect(AC.destination);
      beds[w.key] = g;
    }
    startRainBed(beds.rain);
    startWindBed(beds.snow,   { brown: true,  type: 'lowpass',  f: 420, q: 0.6, vol: 0.20, lfo: [0.071, 0.113] });
    startWindBed(beds.sakura, { brown: false, type: 'bandpass', f: 650, q: 0.5, vol: 0.26, lfo: [0.090, 0.143] });
    setAmbience(WEATHERS[weatherIdx].key, 0.8);   // 开声：约 2.5 秒淡入
  } catch(err){ /* 音频不可用则静默 */ }
}
/* 交叉淡化到某个天气的环境声（tc：时间常数，秒） */
function setAmbience(key, tc){
  if (!AC) return;
  const now = AC.currentTime;
  for (const k in beds){
    const g = beds[k].gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(k === key ? 1 : 0, now, tc || 0.6);
  }
}

/* ---------- 雨：录音 ---------- */
function startRainBed(out){
  const go = () => {
    try {
      const bin = atob(window.RAIN_AUDIO_B64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      AC.decodeAudioData(bytes.buffer, buf => {
        const src = AC.createBufferSource();
        src.buffer = buf;
        src.loop = true;               // AudioBuffer 循环无间隙、无咔哒
        const g = AC.createGain();
        g.gain.setValueAtTime(0, AC.currentTime);
        g.gain.setTargetAtTime(0.85, AC.currentTime, 0.4);   // 录音晚到时也是淡入
        src.connect(g); g.connect(out);
        src.start();
      }, () => { /* 解码失败则静默 */ });
    } catch(err){ /* 音频不可用则静默 */ }
  };
  if (window.RAIN_AUDIO_B64) go();
  else { // <script async> 还没加载完：等它
    const tag = document.getElementById('rain-sound');
    if (tag) tag.addEventListener('load', go, { once: true });
  }
}

/* ---------- 雪 / 樱：合成风声 ---------- */
/* 可无缝循环的噪声：首尾等功率交叉淡化 → 接缝处无咔哒；归一到 RMS 0.2 */
function noiseLoop(sec, brown){
  const sr = AC.sampleRate, n = Math.floor(sec*sr), xf = Math.floor(0.5*sr);
  const raw = new Float32Array(n + xf);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < raw.length; i++){
    const w = Math.random()*2 - 1;
    if (brown){ b0 = (b0 + 0.02*w)/1.02; raw[i] = b0; }
    else {      // 粉噪声（Paul Kellet 简化版）
      b0 = 0.99765*b0 + w*0.099046; b1 = 0.963*b1 + w*0.2965164; b2 = 0.57*b2 + w*1.0526913;
      raw[i] = b0 + b1 + b2 + w*0.1848;
    }
  }
  const buf = AC.createBuffer(1, n, sr), d = buf.getChannelData(0);
  let ss = 0;
  for (let i = 0; i < n; i++){
    if (i < xf){ const k = i/xf*Math.PI/2; d[i] = raw[i]*Math.sin(k) + raw[n+i]*Math.cos(k); }
    else d[i] = raw[i];
    ss += d[i]*d[i];
  }
  const g = 0.2/Math.sqrt(ss/n || 1);
  for (let i = 0; i < n; i++) d[i] *= g;
  return buf;
}
/* 噪声 → 滤波 → 音量；两个不成整数比的慢 LFO 叠加推音量和截止频率 → 阵风起伏不规律 */
function startWindBed(out, o){
  const src = AC.createBufferSource();
  src.buffer = noiseLoop(8, o.brown);
  src.loop = true;
  const flt = AC.createBiquadFilter();
  flt.type = o.type; flt.frequency.value = o.f; flt.Q.value = o.q;
  const g = AC.createGain();
  g.gain.value = o.vol;
  for (const hz of o.lfo){
    const lfo = AC.createOscillator();
    lfo.frequency.value = hz;
    const dv = AC.createGain(); dv.gain.value = o.vol*0.3;
    const df = AC.createGain(); df.gain.value = o.f*0.25;
    lfo.connect(dv); dv.connect(g.gain);
    lfo.connect(df); df.connect(flt.frequency);
    lfo.start();
  }
  src.connect(flt); flt.connect(g); g.connect(out);
  src.start();
}

/* ---------- 樱：风铃 ---------- */
/* 都节音阶（A B C E F，《樱花》的调子）上随机一音：基音 + 两个略不谐的泛音，长尾衰减 */
const CHIME_HZ = [880, 987.77, 1046.5, 1318.51, 1396.91];
function chime(delay){
  const t0 = AC.currentTime + (delay || 0);
  const f = CHIME_HZ[(Math.random()*CHIME_HZ.length)|0], v = rnd(0.03, 0.055);
  for (const [m, a, d] of [[1, 1, 2.8], [2.76, 0.32, 1.3], [5.4, 0.12, 0.6]]){
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.value = f*m;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v*a, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(beds.sakura);
    o.start(t0); o.stop(t0 + d + 0.05);
  }
}
function tickAudio(dt){
  if (!AC || AC.state !== 'running' || WEATHERS[weatherIdx].key !== 'sakura') return;
  if ((chimeIn -= dt) > 0) return;
  chime(0);
  if (Math.random() < 0.35) chime(rnd(0.18, 0.42));   // 偶尔紧跟着再响一声
  chimeIn = rnd(3.5, 9);
}

/* ---------- 点水声 ---------- */
function plip(){
  if (!AC || AC.state !== 'running') return;
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    const t0 = AC.currentTime;
    o.frequency.setValueAtTime(500 + Math.random()*260, t0);
    o.frequency.exponentialRampToValueAtTime(150, t0 + 0.18);
    g.gain.setValueAtTime(0.075, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
    o.connect(g); g.connect(AC.destination);
    o.start(t0); o.stop(t0 + 0.26);
  } catch(err){}
}
