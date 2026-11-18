'use strict';
/* =====================================================
   ИМПЕРИЯ ЭПОХ — игровая логика (без интерфейса)
   ===================================================== */

/* Хуки интерфейса: ui.js подменяет эти функции */
const UI = {
  toast() {}, change() {}, tapFx() {}, offline() {}, caravan() {}, modal() {}
};

let S = null; // сохраняемое состояние
let D = null; // производные значения (пересчитываются через calc())

/* ---------- Состояние ---------- */
function newState() {
  return {
    v: 1,
    res: { food: 30, wood: 30, stone: 0, gold: 0, sci: 0 },
    b: {}, u: {}, t: {}, terr: {},
    era: 0, legacy: 0, ach: {}, buy: 1, flags: {},
    st: { taps: 0, run: 0, total: 0, won: 0, lost: 0, trained: 0, rebirths: 0, time: 0, caravans: 0 },
    buff: null,
    last: Date.now(), created: Date.now()
  };
}

function migrate(o) {
  const s = newState();
  for (const k in o) {
    if (!(k in s)) continue;
    if (s[k] && typeof s[k] === 'object' && o[k] && typeof o[k] === 'object') Object.assign(s[k], o[k]);
    else s[k] = o[k];
  }
  for (const r of RK) if (!isFinite(s.res[r])) s.res[r] = 0;
  s.era = Math.max(0, Math.min(ERAS.length - 1, s.era | 0));
  return s;
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch (e) { return null; }
}

function saveGame() {
  try { S.last = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; }
  catch (e) { return false; }
}

/* ---------- Счётчики ---------- */
function cnt(id) { return S.b[id] || 0; }
function ucnt(id) { return S.u[id] || 0; }
function totalBuildings() { let n = 0; for (const k in S.b) n += S.b[k]; return n; }
function popUsed() { let n = 0; for (const k in S.u) n += S.u[k]; return n; }
function terrCount() { return Object.keys(S.terr).length; }
function techCount() { return Object.keys(S.t).length; }
function milestone(n) { let m = 1; for (const x of MILESTONES) if (n >= x) m *= 2; return m; }
function nextMilestone(n) { for (const x of MILESTONES) if (n < x) return x; return null; }

/* ---------- Главный пересчёт ---------- */
function calc() {
  const add = { food: 0, wood: 0, stone: 0, gold: 0, sci: 0, all: 0, click: 0, cap: 0, pop: 0, atk: 0, hp: 0, off: 0, ucost: 0, bcost: 0 };
  for (const t of TECHS) if (S.t[t.id]) for (const k in t.e) add[k] += t.e[k];
  for (const t of TERRS) if (S.terr[t.id]) for (const k in t.bonus) add[k] += t.bonus[k];
  const d = { add };

  d.buffOn = !!(S.buff && S.buff.until > Date.now());
  d.eraM = Math.pow(3, S.era);
  d.gm = d.eraM * (1 + 0.05 * S.legacy) * (1 + 0.02 * Object.keys(S.ach).length) * (d.buffOn ? S.buff.m : 1);
  const gAdd = add.all + 0.03 * cnt('power');
  d.mult = {};
  for (const r of RK) d.mult[r] = d.gm * (1 + add[r] + gAdd);

  d.rate = { food: 0, wood: 0, stone: 0, gold: 0, sci: 0 };
  d.bTotal = {};
  for (const b of BUILDINGS) {
    const n = cnt(b.id);
    if (!n || !b.prod) continue;
    const ms = milestone(n), o = {};
    for (const r in b.prod) { o[r] = b.prod[r] * n * ms * d.mult[r]; d.rate[r] += o[r]; }
    d.bTotal[b.id] = o;
  }

  const houses = cnt('house');
  d.pop = Math.floor(10 + houses * 5 * milestone(houses) + cnt('castle') * 25 + add.pop);
  d.popUsed = popUsed();
  let A = 0, H = 0, up = 0;
  for (const u of UNITS) {
    const n = ucnt(u.id);
    if (!n) continue;
    A += u.atk * n; H += u.hp * n; up += u.up * n;
  }
  d.atk = A * (1 + add.atk + 0.04 * cnt('smithy') + 0.05 * S.legacy);
  d.hp = H * (1 + add.hp + 0.04 * cnt('castle') + 0.03 * S.legacy);
  d.upkeep = up;
  d.rate.food -= up;

  // Вместимость склада: не меньше базовой, либо 30 минут производства; склады и технологии умножают
  d.capBase = 400 * Math.pow(4, S.era);
  d.capMult = (1 + 0.5 * cnt('storage')) * (1 + add.cap);
  d.cap = {};
  for (const r of RK) d.cap[r] = Math.max(d.capBase, Math.max(0, d.rate[r]) * 1800) * d.capMult;
  d.starving = S.res.food <= 0 && d.rate.food < 0;
  d.atkEff = d.atk * (d.starving ? 0.5 : 1);
  d.power = d.atkEff * d.hp;

  const cm = (1 + add.click) * d.eraM * (1 + 0.05 * S.legacy);
  d.clickBase = cm;
  d.click = {
    food: cm + 0.02 * Math.max(0, d.rate.food),
    wood: cm + 0.02 * d.rate.wood,
    stone: (cnt('quarry') ? cm * 0.5 : 0) + 0.02 * d.rate.stone,
    gold: (cnt('market') ? cm * 0.2 : 0) + 0.02 * d.rate.gold
  };
  return d;
}

/* ---------- Ресурсы ---------- */
function canAfford(c) { for (const r in c) if (S.res[r] < c[r]) return false; return true; }
function pay(c) { for (const r in c) S.res[r] = Math.max(0, S.res[r] - c[r]); }

function addRes(r, v, force) {
  if (!(v > 0)) return 0;
  const before = S.res[r];
  let after = before + v;
  if (!force) after = Math.min(D.cap[r], after);
  if (after < before) after = before;
  S.res[r] = after;
  const g = after - before;
  if (g > 0) { S.st.run += (r === 'sci' ? 5 : 1) * g; S.st.total += g; }
  return g;
}

function produce(dt, eff) {
  for (const r of RK) {
    const v = D.rate[r] * dt * eff;
    if (v > 0) addRes(r, v);
    else if (v < 0) S.res[r] = Math.max(0, S.res[r] + v);
  }
}

function offlineProgress(sec) {
  sec = Math.min(sec, OFFLINE_MAX);
  const eff = Math.min(1, 0.5 + D.add.off);
  const before = Object.assign({}, S.res);
  produce(sec, eff);
  const gain = {};
  for (const r of RK) gain[r] = S.res[r] - before[r];
  return { sec, gain, eff };
}

/* ---------- Здания ---------- */
function bDisc() { return 1 - Math.min(0.5, D.add.bcost); }

function bCostMany(b, n, k) {
  const f = (Math.pow(b.g, k) - 1) / (b.g - 1), disc = bDisc(), c = {};
  for (const r in b.cost) c[r] = Math.ceil(b.cost[r] * Math.pow(b.g, n) * f * disc);
  return c;
}

function bMaxAfford(b, n) {
  const disc = bDisc();
  let k = Infinity;
  for (const r in b.cost) {
    const base = b.cost[r] * Math.pow(b.g, n) * disc;
    const kk = Math.floor(Math.log(1 + S.res[r] * (b.g - 1) / base) / Math.log(b.g));
    k = Math.min(k, kk);
  }
  k = Math.max(0, Math.min(k, 500));
  while (k > 0 && !canAfford(bCostMany(b, n, k))) k--;
  return k;
}

function bBuyCount(b, n) { return S.buy === 0 ? Math.max(1, bMaxAfford(b, n)) : S.buy; }

function buyBuilding(id) {
  const b = BMAP[id];
  if (!b || b.era > S.era) return false;
  const n = cnt(id), k = bBuyCount(b, n), c = bCostMany(b, n, k);
  if (!canAfford(c)) { UI.toast('Не хватает ресурсов', 'warn'); return false; }
  pay(c);
  S.b[id] = n + k;
  D = calc();
  checkAch();
  UI.change('build');
  return true;
}

/* ---------- Армия ---------- */
function uDisc() { return 1 - Math.min(0.5, D.add.ucost); }

function uCost(u, k) {
  const c = {}, d = uDisc();
  for (const r in u.cost) c[r] = Math.ceil(u.cost[r] * d) * k;
  return c;
}

function uMax(u) {
  let k = D.pop - D.popUsed;
  const d = uDisc();
  for (const r in u.cost) k = Math.min(k, Math.floor(S.res[r] / Math.ceil(u.cost[r] * d)));
  return Math.max(0, k);
}

function uBuyCount(u) {
  const free = Math.max(0, D.pop - D.popUsed);
  const k = S.buy === 0 ? Math.max(1, uMax(u)) : S.buy;
  return Math.max(1, Math.min(k, free || 1));
}

function trainUnit(id) {
  const u = UMAP[id];
  if (!u || u.era > S.era) return false;
  if (D.pop - D.popUsed <= 0) { UI.toast('Нет места — стройте дома и замки', 'warn'); return false; }
  const k = uBuyCount(u), c = uCost(u, k);
  if (!canAfford(c)) { UI.toast('Не хватает ресурсов', 'warn'); return false; }
  pay(c);
  S.u[id] = ucnt(id) + k;
  S.st.trained += k;
  D = calc();
  checkAch();
  UI.change('army');
  return true;
}

function disbandUnit(id) {
  const n = ucnt(id);
  if (!n) return false;
  S.u[id] = n - 1;
  if (S.u[id] <= 0) delete S.u[id];
  D = calc();
  UI.change('army');
  return true;
}

/* ---------- Технологии и эпохи ---------- */
function techState(t) {
  if (S.t[t.id]) return 'done';
  if (t.era > S.era) return 'era';
  if (t.req && !S.t[t.req]) return 'locked';
  return 'open';
}

function research(id) {
  const t = TMAP[id];
  if (!t || techState(t) !== 'open') return false;
  if (S.res.sci < t.cost) { UI.toast('Не хватает науки', 'warn'); return false; }
  S.res.sci -= t.cost;
  S.t[id] = true;
  D = calc();
  checkAch();
  UI.toast(`Изучено: ${t.n}`, 'good');
  UI.change('tech');
  return true;
}

function nextEraInfo() { return ERAS[S.era + 1] || null; }

function advanceEra() {
  const e = nextEraInfo();
  if (!e) return false;
  if (!canAfford(e.cost)) { UI.toast('Не хватает ресурсов для новой эры', 'warn'); return false; }
  pay(e.cost);
  S.era++;
  D = calc();
  checkAch();
  UI.change('era');
  return true;
}

/* ---------- Карта и бои ---------- */
function terrState(i) {
  const t = TERRS[i];
  if (S.terr[t.id]) return 'done';
  if (i > 0 && !S.terr[TERRS[i - 1].id]) return 'locked';
  if (t.era > S.era) return 'era';
  return 'open';
}

function battleSim(A, H, EA, EH, rand) {
  const kA = A / EH, kE = EA / H;
  let x = 1, y = 1;
  const dt = 0.05 / Math.max(kA, kE);
  for (let i = 0; i < 6000 && x > 0 && y > 0; i++) {
    const r1 = rand ? 0.92 + Math.random() * 0.16 : 1;
    const r2 = rand ? 0.92 + Math.random() * 0.16 : 1;
    y -= dt * kA * x * r1;
    x -= dt * kE * y * r2;
  }
  const win = y <= 0 && x > 0;
  return { win, x: Math.max(0, x), y: Math.max(0, y) };
}

function battlePreview(i) {
  const t = TERRS[i], A = D.atkEff, H = D.hp;
  if (!(A > 0) || !(H > 0)) return { ratio: 0, loss: 1 };
  const ratio = (A * H) / (t.atk * t.hp);
  return { ratio, loss: ratio >= 1 ? 1 - Math.sqrt(1 - 1 / ratio) : 1 };
}

function terrReward(t) {
  const r = {};
  for (const k of RK) r[k] = Math.max(t.base, D.rate[k] * 120);
  return r;
}

function attack(i) {
  const t = TERRS[i];
  if (terrState(i) !== 'open') return null;
  if (popUsed() <= 0) { UI.toast('Сначала наберите армию', 'warn'); return null; }
  const res = battleSim(D.atkEff, D.hp, t.atk, t.hp, true);
  const frac = Math.min(0.95, res.win ? 1 - res.x : 0.6);
  const lost = {};
  let lostTotal = 0;
  for (const u of UNITS) {
    const n = ucnt(u.id);
    if (!n) continue;
    const f = n * frac;
    let l = Math.floor(f);
    if (Math.random() < f - l) l++;
    l = Math.min(n, l);
    if (l) { S.u[u.id] = n - l; if (S.u[u.id] <= 0) delete S.u[u.id]; lost[u.id] = l; lostTotal += l; }
  }
  let reward = null;
  if (res.win) {
    reward = terrReward(t);
    S.terr[t.id] = true;
    S.st.won++;
    for (const k of RK) addRes(k, reward[k], true);
  } else S.st.lost++;
  D = calc();
  checkAch();
  UI.change('army');
  return { win: res.win, lost, lostTotal, frac, reward, terr: t };
}

/* ---------- Возрождение ---------- */
function pendingLegacy() { return Math.floor(Math.cbrt(S.st.run / 4e5)); }
function canRebirth() { return S.era >= 2 && pendingLegacy() >= 1; }

function rebirth() {
  if (!canRebirth()) return 0;
  const gain = pendingLegacy();
  const old = S;
  S = newState();
  S.legacy = old.legacy + gain;
  S.ach = old.ach;
  S.flags = old.flags;
  S.buy = old.buy;
  S.created = old.created;
  S.st = Object.assign({}, old.st, { run: 0, rebirths: old.st.rebirths + 1 });
  D = calc();
  checkAch();
  saveGame();
  UI.change('all');
  return gain;
}

/* ---------- Достижения ---------- */
function checkAch() {
  let n = 0;
  for (const a of ACHS) {
    if (!S.ach[a.id] && a.f()) {
      S.ach[a.id] = true; n++;
      UI.toast(`🏆 ${a.n}: +2% к производству`, 'good');
    }
  }
  if (n) { D = calc(); UI.change('ach'); }
}

/* ---------- Сбор ресурсов и караван ---------- */
function tap() {
  const gain = {};
  let any = false;
  for (const r in D.click) {
    const g = addRes(r, D.click[r]);
    gain[r] = g;
    if (g > 0) any = true;
  }
  S.st.taps++;
  return { gain, any };
}

function caravanReward() {
  S.st.caravans++;
  if (Math.random() < 0.6) {
    const gain = {};
    for (const r of RK) { gain[r] = Math.max(D.rate[r] * 60, r === 'sci' ? 0 : 40 * D.eraM); addRes(r, gain[r], true); }
    D = calc();
    checkAch();
    return { type: 'res', gain };
  }
  S.buff = { until: Date.now() + 30000, m: 3 };
  D = calc();
  checkAch();
  return { type: 'buff' };
}

/* ---------- Сохранение: экспорт / импорт ---------- */
function exportSave() {
  saveGame();
  return btoa(unescape(encodeURIComponent(JSON.stringify(S))));
}

function importSave(str) {
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(String(str).trim()))));
    if (!o || !o.res || !o.st) return false;
    S = migrate(o);
    D = calc();
    saveGame();
    UI.change('all');
    return true;
  } catch (e) { return false; }
}

function resetGame() {
  S = newState();
  D = calc();
  saveGame();
  UI.change('all');
}

/* ---------- Игровой цикл ---------- */
let lastT = Date.now(), achT = 0, saveT = 0, carT = 70 + Math.random() * 60;

function initGame() {
  S = loadGame() || newState();
  D = calc();
  let off = null;
  const sec = (Date.now() - S.last) / 1000;
  if (sec > 60) off = offlineProgress(sec);
  lastT = Date.now();
  D = calc();
  return off;
}

function step() {
  const now = Date.now();
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt <= 0) return;
  D = calc();
  if (dt > 20) {
    // устройство «спало»: считаем как офлайн
    const r = offlineProgress(dt);
    S.st.time += Math.min(dt, OFFLINE_MAX);
    if (dt > 60) UI.offline(r);
    dt = 0;
  } else {
    produce(dt, 1);
    S.st.time += dt;
  }
  D = calc();
  achT += dt; saveT += dt; carT -= dt;
  if (achT >= 1) { achT = 0; checkAch(); }
  if (saveT >= 10) { saveT = 0; saveGame(); }
  if (carT <= 0) { carT = 70 + Math.random() * 70; UI.caravan(); }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    get S() { return S; }, get D() { return D; }, UI,
    newState, calc, initGame, step, tap, buyBuilding, trainUnit, research, advanceEra, attack,
    rebirth, canRebirth, pendingLegacy, caravanReward, terrState, techState, battlePreview, battleSim,
    bMaxAfford, bCostMany, uMax, uCost, setState(s) { S = s; D = calc(); }, setD(d) { D = d; },
    cnt, ucnt, popUsed, addRes, canAfford, importSave, exportSave
  };
}
