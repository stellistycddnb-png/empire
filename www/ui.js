'use strict';
/* =====================================================
   ИМПЕРИЯ ЭПОХ — интерфейс
   ===================================================== */

const $ = (s, r = document) => r.querySelector(s);
const R = {};          // ссылки на элементы по data-b
let tab = 'home';
let lastFullToast = 0;

/* ---------- Форматирование ---------- */
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 0.005) return '0';
  if (n < 1) return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  if (n < 10) return (Math.round(n * 10) / 10).toString();
  if (n < 1000) return Math.floor(n).toString();
  const e = Math.floor(Math.log10(n) / 3);
  if (e >= SUF.length) return n.toExponential(2).replace('+', '');
  const v = n / Math.pow(1000, e);
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + SUF[e];
}
function fmtI(n) { return n < 1000 ? String(Math.floor(n)) : fmt(n); }
function fmtTime(s) {
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин`;
  return `${s} с`;
}

/* ---------- Помощники DOM ---------- */
function collect(root) { root.querySelectorAll('[data-b]').forEach(e => { R[e.dataset.b] = e; }); }
function setT(k, v) { const e = R[k]; if (e && e._t !== v) { e.textContent = v; e._t = v; } }
function setH(k, v) { const e = R[k]; if (e && e._h !== v) { e.innerHTML = v; e._h = v; } }
function setCls(el, c, on) { if (el) el.classList.toggle(c, !!on); }
function costHTML(c) {
  return Object.keys(c).map(r => `<span class="cc${S.res[r] >= c[r] ? '' : ' bad'}">${RES[r].i} ${fmtI(c[r])}</span>`).join('');
}
function segHTML() {
  const o = [[1, '×1'], [10, '×10'], [100, '×100'], [0, 'MAX']];
  return `<div class="seg">${o.map(([v, l]) => `<button data-act="buy" data-v="${v}" class="${S.buy === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}

/* ---------- Всплывающие элементы ---------- */
function toast(msg, kind) {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.textContent = msg;
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2300);
}

function modal(html) {
  $('#sheet').innerHTML = html;
  $('#modal').classList.remove('hidden');
  $('#sheet').scrollTop = 0;
}
function closeModal() { $('#modal').classList.add('hidden'); }

function floatText(x, y, text) {
  const f = document.createElement('div');
  f.className = 'float';
  f.textContent = text;
  f.style.left = x + 'px';
  f.style.top = y + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 900);
}

/* ---------- Верхняя панель ---------- */
function buildTop() {
  $('#resbar').innerHTML = RK.map(r => `
    <div class="chip">
      <div class="cl"><span class="ci">${RES[r].i}</span><span class="cv" data-b="rv.${r}">0</span></div>
      <div class="cr" data-b="rr.${r}">+0/с</div>
      <div class="cbar"><i data-b="rb.${r}"></i></div>
    </div>`).join('');
  collect($('#resbar'));
}

function updTop() {
  $('#eraName').textContent = `${ERAS[S.era].i} ${ERAS[S.era].n}`;
  for (const r of RK) {
    const cap = D.cap[r], v = S.res[r], rate = D.rate[r];
    setT('rv.' + r, fmtI(v));
    setT('rr.' + r, (rate >= 0 ? '+' : '') + fmt(rate) + '/с');
    const p = Math.min(1, v / cap);
    const bar = R['rb.' + r];
    bar.style.width = (p * 100).toFixed(0) + '%';
    setCls(bar.parentNode, 'full', p >= 0.999);
    setCls(R['rr.' + r], 'neg', rate < 0);
  }
  const buff = $('#buff');
  if (D.buffOn) {
    buff.classList.remove('hidden');
    buff.textContent = `🔥 ×${S.buff.m} ${Math.max(0, Math.ceil((S.buff.until - Date.now()) / 1000))} с`;
  } else buff.classList.add('hidden');
  document.body.dataset.era = S.era;
}

/* ---------- Вкладка: Империя ---------- */
function buildHome() {
  $('#v-home').innerHTML = `
    <div class="tapzone">
      <button id="tap" class="tapbtn" aria-label="Собрать ресурсы"><span class="tapi" data-b="tap.i">🏕️</span></button>
      <div class="taphint" data-b="tap.h"></div>
    </div>
    <div class="card" id="eraCard"></div>
    <div class="row between"><h3>Постройки</h3><div data-b="seg.h"></div></div>
    <div id="blist"></div>`;
  collect($('#v-home'));
  buildEra();
  buildBList();
  $('#tap').addEventListener('pointerdown', onTap);
}

function onTap(e) {
  e.preventDefault();
  const r = tap();
  if (!r.any) {
    if (Date.now() - lastFullToast > 2500) { lastFullToast = Date.now(); toast('Склады полны! Построй склад или потрать ресурсы', 'warn'); }
    return;
  }
  const parts = [];
  for (const k of RK) if (r.gain[k] > 0 && parts.length < 3) parts.push(`+${fmt(r.gain[k])}${RES[k].i}`);
  floatText(e.clientX, e.clientY, parts.join(' '));
  const b = $('#tap');
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  updTop();
}

function buildEra() {
  const e = nextEraInfo(), c = $('#eraCard');
  if (!e) {
    c.innerHTML = `<div class="era-title"><span>🏆</span><div><b>Высшая эпоха достигнута!</b><div class="sub">Покоряй оставшиеся земли и соверши Возрождение (вкладка «Ещё»), чтобы стать сильнее.</div></div></div>`;
    return;
  }
  c.innerHTML = `
    <div class="era-title"><span>${e.i}</span><div><b>Следующая эра: ${e.n}</b>
      <div class="sub">Новые здания, войска и технологии, ×3 к производству</div></div></div>
    <div class="reqs">${RK.filter(r => e.cost[r]).map(r => `<div class="req" data-b="er.${r}"></div>`).join('')}</div>
    <button class="btn big" data-act="era" data-b="era.btn">Перейти в новую эру</button>`;
  collect(c);
}

function updEra() {
  const e = nextEraInfo();
  if (!e) return;
  let ok = true;
  for (const r of RK) {
    if (!e.cost[r]) continue;
    const have = S.res[r] >= e.cost[r];
    if (!have) ok = false;
    setH('er.' + r, `${RES[r].i} ${fmtI(Math.min(S.res[r], e.cost[r]))} / ${fmtI(e.cost[r])}`);
    setCls(R['er.' + r], 'ok', have);
  }
  setCls(R['era.btn'], 'off', !ok);
}

function buildBList() {
  const list = BUILDINGS.filter(b => b.era <= S.era);
  $('#blist').innerHTML = list.map(b => `
    <div class="item">
      <div class="ii">${b.i}</div>
      <div class="ib">
        <div class="in"><b>${b.n}</b><span class="cnt" data-b="bn.${b.id}"></span></div>
        <div class="id" data-b="bd.${b.id}"></div>
        <div class="ic" data-b="bc.${b.id}"></div>
      </div>
      <button class="buy" data-act="buyB" data-id="${b.id}" data-b="bb.${b.id}"><span data-b="bk.${b.id}">Купить</span></button>
    </div>`).join('');
  collect($('#blist'));
}

function bDesc(b, n) {
  const ms = milestone(n), nm = nextMilestone(n);
  let s = '';
  if (b.prod) {
    const per = Object.keys(b.prod).map(r => `+${fmt(b.prod[r] * milestone(Math.max(n, 1)) * D.mult[r])}${RES[r].i}`).join(' ');
    s = `${per}/с за шт.`;
    if (n > 0) s += ` · всего ${Object.keys(b.prod).map(r => fmt(D.bTotal[b.id][r]) + RES[r].i).join(' ')}/с`;
    if (nm) s += ` · до ×2: ещё ${nm - n}`;
  } else if (b.fx === 'pop') s = `+${5 * ms} 👥 за дом · всего ${fmt(5 * n * ms)}${nm ? ` · до ×2: ещё ${nm - n}` : ''}`;
  else if (b.fx === 'cap') s = `+50% к вместимости складов · сейчас ×${(1 + 0.5 * n).toFixed(1)}`;
  else if (b.fx === 'atk') s = `+4% атаки армии за уровень · сейчас +${4 * n}%`;
  else if (b.fx === 'castle') s = `+25 👥 и +4% здоровья армии · сейчас +${25 * n} 👥`;
  else if (b.fx === 'power') s = `+3% ко всему производству · сейчас +${3 * n}%`;
  return s;
}

function updBList() {
  for (const b of BUILDINGS) {
    if (b.era > S.era) continue;
    const n = cnt(b.id), k = bBuyCount(b, n), c = bCostMany(b, n, k);
    setT('bn.' + b.id, '×' + n);
    setH('bd.' + b.id, bDesc(b, n));
    setH('bc.' + b.id, costHTML(c));
    setT('bk.' + b.id, 'Купить ×' + k);
    setCls(R['bb.' + b.id], 'off', !canAfford(c));
  }
}

/* ---------- Вкладка: Армия ---------- */
function buildArmy() {
  const list = UNITS.filter(u => u.era <= S.era);
  $('#v-army').innerHTML = `
    <div class="card stats">
      <div class="st"><span>⚔️ Атака</span><b data-b="a.atk"></b></div>
      <div class="st"><span>❤️ Здоровье</span><b data-b="a.hp"></b></div>
      <div class="st"><span>💪 Сила</span><b data-b="a.pow"></b></div>
      <div class="st"><span>👥 Население</span><b data-b="a.pop"></b></div>
      <div class="st"><span>🍖 Содержание</span><b data-b="a.up"></b></div>
    </div>
    <div class="note warn hidden" data-b="a.warn">Армия голодает! Не хватает еды — сила снижена вдвое. Построй больше ферм.</div>
    <div class="row between"><h3>Войска</h3><div data-b="seg.a"></div></div>
    ${list.map(u => `
    <div class="item">
      <div class="ii">${u.i}</div>
      <div class="ib">
        <div class="in"><b>${u.n}</b><span class="cnt" data-b="un.${u.id}"></span></div>
        <div class="id">⚔️ ${fmt(u.atk)} · ❤️ ${fmt(u.hp)} · 🍖 ${fmt(u.up)}/с</div>
        <div class="ic" data-b="uc.${u.id}"></div>
      </div>
      <button class="buy" data-act="train" data-id="${u.id}" data-b="ub.${u.id}"><span data-b="uk.${u.id}">Нанять</span></button>
    </div>`).join('')}
    <div class="hint">Сила = Атака × Здоровье. Чтобы вместить больше войск, строй Дома и Замки. Кузница усиливает атаку.</div>`;
  collect($('#v-army'));
}

function updArmy() {
  setT('a.atk', fmt(D.atkEff));
  setT('a.hp', fmt(D.hp));
  setT('a.pow', fmt(D.power));
  setT('a.pop', `${D.popUsed} / ${D.pop}`);
  setT('a.up', `−${fmt(D.upkeep)}🌾/с`);
  setCls(R['a.warn'], 'hidden', !D.starving);
  for (const u of UNITS) {
    if (u.era > S.era) continue;
    const k = uBuyCount(u), c = uCost(u, k);
    setT('un.' + u.id, '×' + ucnt(u.id));
    setH('uc.' + u.id, costHTML(c));
    setT('uk.' + u.id, 'Нанять ×' + k);
    setCls(R['ub.' + u.id], 'off', !canAfford(c) || D.pop - D.popUsed <= 0);
  }
}

/* ---------- Вкладка: Карта ---------- */
function buildMap() {
  $('#v-map').innerHTML = `
    <div class="card">
      <div class="row between"><b>🗺️ Завоевание мира</b><span class="pill" data-b="m.prog"></span></div>
      <div class="sub">Захватывай территории по порядку: за каждую — награда и постоянный бонус. Зелёный кружок — победа вероятна.</div>
    </div>
    ${TERRS.map((t, i) => `
    <div class="terr" data-act="terr" data-i="${i}" data-b="tc.${i}">
      <div class="ti">${t.i}</div>
      <div class="tb"><b>${t.n}</b><div class="ts" data-b="ts.${i}"></div></div>
      <div class="tr" data-b="tr.${i}"></div>
    </div>`).join('')}`;
  collect($('#v-map'));
}

function updMap() {
  setT('m.prog', `${terrCount()} / ${TERRS.length}`);
  for (let i = 0; i < TERRS.length; i++) {
    const t = TERRS[i], st = terrState(i), card = R['tc.' + i];
    let sub = '', badge = '';
    if (st === 'done') { sub = `✅ Покорено · ${bonusText(t.bonus)}`; badge = '✅'; }
    else if (st === 'locked') { sub = `🔒 Сначала захвати: ${TERRS[i - 1].n}`; badge = '🔒'; }
    else if (st === 'era') { sub = `🔒 Нужна эра: ${ERAS[t.era].n}`; badge = '🔒'; }
    else {
      const pv = battlePreview(i);
      sub = `Сила врага: ${fmt(t.P)} · ты: ${fmt(D.power)}`;
      badge = pv.ratio >= 1.3 ? '🟢' : pv.ratio >= 0.95 ? '🟡' : '🔴';
    }
    setT('ts.' + i, sub);
    setT('tr.' + i, badge);
    setCls(card, 'done', st === 'done');
    setCls(card, 'lock', st === 'locked' || st === 'era');
  }
}

function showTerr(i) {
  const t = TERRS[i], st = terrState(i);
  if (st === 'locked') { toast('Сначала захвати предыдущую территорию', 'warn'); return; }
  if (st === 'era') { toast(`Нужна эра: ${ERAS[t.era].n}`, 'warn'); return; }
  const rew = terrReward(t);
  const rewHTML = RK.map(r => `<span class="cc">${RES[r].i} ${fmtI(rew[r])}</span>`).join('');
  let body = '';
  if (st === 'done') body = `<div class="note good">✅ Территория уже покорена.</div>`;
  else {
    const pv = battlePreview(i);
    let verdict, cls;
    if (pv.ratio >= 1.3) { verdict = `Победа уверенная. Ожидаемые потери: ~${Math.round(pv.loss * 100)}% армии.`; cls = 'good'; }
    else if (pv.ratio >= 0.95) { verdict = 'Исход неясен — бой может закончиться в любую сторону.'; cls = 'warn'; }
    else { verdict = 'Твоя армия слабее — вероятно поражение. Усиль войска, технологии или кузницу.'; cls = 'bad'; }
    body = `<div class="note ${cls}">${verdict}</div>
      <button class="btn big" data-act="attack" data-i="${i}">⚔️ В бой!</button>`;
  }
  modal(`<h2>${t.i} ${t.n}</h2>
    <div class="kv"><span>Атака врага</span><b>${fmt(t.atk)}</b></div>
    <div class="kv"><span>Здоровье врага</span><b>${fmt(t.hp)}</b></div>
    <div class="kv"><span>Сила врага</span><b>${fmt(t.P)}</b></div>
    <div class="kv"><span>Твоя сила</span><b>${fmt(D.power)}</b></div>
    <div class="kv"><span>Награда</span><b class="cl2">${rewHTML}</b></div>
    <div class="kv"><span>Постоянный бонус</span><b>${bonusText(t.bonus)}</b></div>
    ${body}
    <button class="btn ghost" data-act="close">Закрыть</button>`);
}

function doAttack(i) {
  const r = attack(i);
  if (!r) return;
  const lostTxt = r.lostTotal > 0
    ? Object.keys(r.lost).map(id => `${UMAP[id].i} ${UMAP[id].n} ×${r.lost[id]}`).join(', ')
    : 'без потерь';
  if (r.win) {
    modal(`<h2>🎉 Победа!</h2>
      <div class="sub">${r.terr.i} ${r.terr.n} теперь твоя.</div>
      <div class="kv"><span>Потери</span><b>${lostTxt}</b></div>
      <div class="kv"><span>Добыча</span><b class="cl2">${RK.map(k => `<span class="cc">${RES[k].i} ${fmtI(r.reward[k])}</span>`).join('')}</b></div>
      <div class="kv"><span>Бонус навсегда</span><b>${bonusText(r.terr.bonus)}</b></div>
      <button class="btn big" data-act="close">Отлично</button>`);
  } else {
    modal(`<h2>💀 Поражение</h2>
      <div class="sub">Враг оказался сильнее. Армия отступила.</div>
      <div class="kv"><span>Потери</span><b>${lostTxt}</b></div>
      <button class="btn big" data-act="close">Понятно</button>`);
  }
}

/* ---------- Вкладка: Наука ---------- */
function buildTech() {
  const vis = TECHS.filter(t => t.era <= S.era);
  const rank = t => ({ open: 0, locked: 1, done: 2 }[techState(t)]);
  vis.sort((a, b) => rank(a) - rank(b) || a.cost - b.cost);
  $('#v-sci').innerHTML = `
    <div class="card"><div class="row between"><b>🔬 Технологии</b><span class="pill">${techCount()} / ${TECHS.length}</span></div>
    <div class="sub">Наука копится от Школ, Университетов и Лабораторий. Новые технологии открываются с каждой эрой.</div></div>
    ${vis.map(t => {
      const st = techState(t);
      return `<div class="item${st === 'done' ? ' done' : ''}">
        <div class="ii">${t.i}</div>
        <div class="ib">
          <div class="in"><b>${t.n}</b></div>
          <div class="id">${bonusText(t.e)}</div>
          ${st === 'open' ? `<div class="ic"><span class="cc" data-b="tcst.${t.id}">🔬 ${fmtI(t.cost)}</span></div>` : ''}
          ${st === 'locked' ? `<div class="ic muted">🔒 Сначала изучи: ${TMAP[t.req].n}</div>` : ''}
          ${st === 'done' ? `<div class="ic ok">✅ Изучено</div>` : ''}
        </div>
        ${st === 'open' ? `<button class="buy" data-act="tech" data-id="${t.id}" data-b="tb.${t.id}">Изучить</button>` : ''}
      </div>`;
    }).join('')}`;
  collect($('#v-sci'));
}

function updTech() {
  for (const t of TECHS) {
    if (techState(t) !== 'open') continue;
    const ok = S.res.sci >= t.cost;
    setCls(R['tb.' + t.id], 'off', !ok);
    setCls(R['tcst.' + t.id], 'bad', !ok);
  }
}

/* ---------- Вкладка: Ещё ---------- */
function buildMore() {
  const achN = Object.keys(S.ach).length;
  $('#v-more').innerHTML = `
    <div class="card">
      <div class="row between"><b>♻️ Наследие</b><span class="pill" data-b="lg.pts"></span></div>
      <div class="sub" data-b="lg.info"></div>
      <button class="btn big" data-act="rebirth" data-b="lg.btn">Возрождение</button>
    </div>

    <div class="card">
      <div class="row between"><b>🏆 Достижения</b><span class="pill">${achN} / ${ACHS.length}</span></div>
      <div class="sub">Каждое достижение даёт +2% ко всему производству.</div>
      <div class="achs">${ACHS.map(a => `
        <div class="ach${S.ach[a.id] ? ' got' : ''}"><span>${S.ach[a.id] ? '🏆' : '🔒'}</span><div><b>${a.n}</b><div class="sub">${a.d}</div></div></div>`).join('')}
      </div>
    </div>

    <div class="card">
      <b>📊 Статистика</b>
      <div class="kv"><span>Время в игре</span><b data-b="s.time"></b></div>
      <div class="kv"><span>Сборов ресурсов</span><b data-b="s.taps"></b></div>
      <div class="kv"><span>Добыто за всё время</span><b data-b="s.total"></b></div>
      <div class="kv"><span>Побед / поражений</span><b data-b="s.war"></b></div>
      <div class="kv"><span>Нанято войск</span><b data-b="s.tr"></b></div>
      <div class="kv"><span>Поймано караванов</span><b data-b="s.car"></b></div>
      <div class="kv"><span>Возрождений</span><b data-b="s.reb"></b></div>
    </div>

    <div class="card">
      <b>⚙️ Настройки</b>
      <div class="btns">
        <button class="btn" data-act="help">📖 Как играть</button>
        <button class="btn" data-act="save">💾 Сохранить</button>
        <button class="btn" data-act="export">📤 Экспорт сохранения</button>
        <button class="btn" data-act="import">📥 Импорт сохранения</button>
        <button class="btn danger" data-act="reset">🗑️ Сбросить игру</button>
      </div>
      <div class="sub">Игра сохраняется автоматически каждые 10 секунд.</div>
    </div>`;
  collect($('#v-more'));
}

function updMore() {
  const pend = pendingLegacy();
  setT('lg.pts', `${S.legacy} оч.`);
  setT('lg.info', S.era < 2
    ? `Доступно с эры «${ERAS[2].n}». Каждое очко наследия даёт +5% к производству и +5% к атаке навсегда. Сейчас бонус: +${S.legacy * 5}%.`
    : `Возрождение сбросит прогресс, но даст ${pend} оч. наследия (+${pend * 5}% к производству навсегда). Сейчас бонус: +${S.legacy * 5}%.`);
  setCls(R['lg.btn'], 'off', !canRebirth());
  setT('lg.btn', canRebirth() ? `♻️ Возродиться (+${pend} оч.)` : 'Возрождение недоступно');
  setT('s.time', fmtTime(S.st.time));
  setT('s.taps', fmtI(S.st.taps));
  setT('s.total', fmt(S.st.total));
  setT('s.war', `${S.st.won} / ${S.st.lost}`);
  setT('s.tr', fmtI(S.st.trained));
  setT('s.car', fmtI(S.st.caravans));
  setT('s.reb', fmtI(S.st.rebirths));
}

/* ---------- Окна ---------- */
function showHelp() {
  modal(`<h2>📖 Как играть</h2>
    <div class="help">
      <p>👆 <b>Нажимай на лагерь</b> — это даёт еду, дерево и камень.</p>
      <p>🏠 <b>Покупай постройки</b> — они добывают ресурсы сами, даже когда игра закрыта (до 8 часов).</p>
      <p>🔬 <b>Изучай технологии</b> во вкладке «Наука» — это усиливает всё.</p>
      <p>🏰 <b>Копи ресурсы и переходи в новую эру</b> — откроются новые здания, войска и ×3 к производству.</p>
      <p>⚔️ <b>Нанимай армию</b> и захватывай территории на карте. Следи за едой: армия её ест.</p>
      <p>🐪 <b>Лови караваны</b> — они иногда проезжают по экрану и дают бонус.</p>
      <p>♻️ <b>Когда прогресс замедлится</b> — делай «Возрождение» во вкладке «Ещё» ради постоянных бонусов.</p>
    </div>
    <button class="btn big" data-act="close">Понятно, играем!</button>`);
}

function showOffline(r) {
  const lines = RK.filter(k => Math.abs(r.gain[k]) >= 1).map(k => `<div class="kv"><span>${RES[k].i} ${RES[k].n}</span><b>${r.gain[k] >= 0 ? '+' : ''}${fmt(r.gain[k])}</b></div>`).join('');
  modal(`<h2>👋 С возвращением!</h2>
    <div class="sub">Тебя не было ${fmtTime(r.sec)}. Твоя империя продолжала работать (эффективность ${Math.round(r.eff * 100)}%).</div>
    ${lines || '<div class="sub">Склады были полны — построй больше складов, чтобы копить дольше.</div>'}
    <button class="btn big" data-act="close">Забрать</button>`);
}

function showExport() {
  const code = exportSave();
  modal(`<h2>📤 Экспорт</h2>
    <div class="sub">Скопируй этот код и сохрани. Им можно восстановить игру на другом устройстве.</div>
    <textarea id="saveBox" readonly>${code}</textarea>
    <button class="btn big" data-act="copy">Скопировать</button>
    <button class="btn ghost" data-act="close">Закрыть</button>`);
}

function showImport() {
  modal(`<h2>📥 Импорт</h2>
    <div class="sub">Вставь код сохранения. Текущий прогресс будет заменён.</div>
    <textarea id="saveBox" placeholder="Вставь код сюда"></textarea>
    <button class="btn big" data-act="doimport">Загрузить</button>
    <button class="btn ghost" data-act="close">Отмена</button>`);
}

function showRebirth() {
  if (!canRebirth()) { toast(`Возрождение доступно с эры «${ERAS[2].n}»`, 'warn'); return; }
  const pend = pendingLegacy();
  modal(`<h2>♻️ Возрождение</h2>
    <div class="sub">Ты начнёшь заново: ресурсы, здания, армия, технологии и территории будут сброшены.</div>
    <div class="kv"><span>Получишь</span><b>${pend} оч. наследия</b></div>
    <div class="kv"><span>Бонус после</span><b>+${(S.legacy + pend) * 5}% к производству и атаке</b></div>
    <div class="sub">Достижения и наследие остаются навсегда.</div>
    <button class="btn big" data-act="dorebirth">♻️ Возродиться</button>
    <button class="btn ghost" data-act="close">Отмена</button>`);
}

function showReset() {
  modal(`<h2>🗑️ Сбросить игру?</h2>
    <div class="sub">Весь прогресс, включая наследие и достижения, будет удалён без возможности восстановления.</div>
    <button class="btn danger big" data-act="doreset">Да, удалить всё</button>
    <button class="btn ghost" data-act="close">Отмена</button>`);
}

/* ---------- Караван ---------- */
function spawnCaravan() {
  if (document.hidden || document.querySelector('.caravan')) return;
  const c = document.createElement('button');
  c.className = 'caravan';
  c.textContent = '🐪';
  c.style.top = (22 + Math.random() * 45) + 'vh';
  c.dataset.act = 'caravan';
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 11000);
}

function onCaravan(el) {
  el.remove();
  const r = caravanReward();
  if (r.type === 'res') {
    const parts = RK.filter(k => r.gain[k] >= 1).map(k => `+${fmt(r.gain[k])}${RES[k].i}`);
    toast(`🐪 Караван: ${parts.join(' ')}`, 'good');
  } else toast('🐪 Караван: ×3 к производству на 30 секунд!', 'good');
  refresh();
}

/* ---------- Вкладки ---------- */
const TABS = [
  ['home', '🏛️', 'Империя'], ['army', '⚔️', 'Армия'], ['map', '🗺️', 'Карта'], ['sci', '🔬', 'Наука'], ['more', '☰', 'Ещё']
];

function buildTabs() {
  $('#tabs').innerHTML = TABS.map(([id, ic, nm]) =>
    `<button data-act="tab" data-t="${id}" class="tabbtn" data-b="tab.${id}"><span class="tbi">${ic}</span><span class="tbn">${nm}</span><i class="dot hidden"></i></button>`).join('');
  collect($('#tabs'));
}

function showTab(id) {
  tab = id;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + id));
  TABS.forEach(([t]) => setCls(R['tab.' + t], 'on', t === id));
  $('#views').scrollTop = 0;
  refresh();
}

function updBadges() {
  const e = nextEraInfo();
  setCls(R['tab.home'].querySelector('.dot'), 'hidden', !(e && canAfford(e.cost)));
  setCls(R['tab.sci'].querySelector('.dot'), 'hidden', !TECHS.some(t => techState(t) === 'open' && S.res.sci >= t.cost));
  let can = false;
  for (let i = 0; i < TERRS.length; i++) if (terrState(i) === 'open' && battlePreview(i).ratio >= 1.3) can = true;
  setCls(R['tab.map'].querySelector('.dot'), 'hidden', !can);
  setCls(R['tab.more'].querySelector('.dot'), 'hidden', !(canRebirth() && pendingLegacy() >= Math.max(10, S.legacy)));
}

/* ---------- Обновление ---------- */
function updSegs() {
  const h = segHTML();
  setH('seg.h', h);
  setH('seg.a', h);
}

function refresh() {
  if (!S || !D) return;
  updTop();
  updSegs();
  updBadges();
  if (tab === 'home') {
    updEra(); updBList();
    const k = D.click;
    setT('tap.h', `Нажми: +${fmt(k.food)}🌾 +${fmt(k.wood)}🪵${k.stone > 0 ? ` +${fmt(k.stone)}🪨` : ''}${k.gold > 0 ? ` +${fmt(k.gold)}🪙` : ''}`);
    setT('tap.i', ERAS[S.era].i);
  } else if (tab === 'army') updArmy();
  else if (tab === 'map') updMap();
  else if (tab === 'sci') updTech();
  else if (tab === 'more') updMore();
}

function buildAll() {
  buildTop(); buildTabs(); buildHome(); buildArmy(); buildMap(); buildTech(); buildMore();
  TABS.forEach(([t]) => setCls(R['tab.' + t], 'on', t === tab));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + tab));
}

/* ---------- Хуки логики ---------- */
UI.toast = toast;
UI.modal = modal;
UI.offline = showOffline;
UI.caravan = spawnCaravan;
UI.change = function (kind) {
  if (kind === 'era' || kind === 'all') {
    buildAll();
    if (kind === 'era') { modal(`<h2>${ERAS[S.era].i} ${ERAS[S.era].n}</h2>
      <div class="sub">Новая эра началась! Открылись новые здания, войска и технологии. Всё производство ×3.</div>
      <button class="btn big" data-act="close">Вперёд!</button>`); }
  } else if (kind === 'tech') { buildTech(); }
  else if (kind === 'ach') { buildMore(); }
  else if (kind === 'army') { /* только числа */ }
  refresh();
};

/* ---------- События ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case 'tab': showTab(el.dataset.t); break;
    case 'buy': S.buy = +el.dataset.v; refresh(); break;
    case 'buyB': buyBuilding(id); refresh(); break;
    case 'train': trainUnit(id); refresh(); break;
    case 'tech': research(id); break;
    case 'era': advanceEra(); break;
    case 'terr': showTerr(+el.dataset.i); break;
    case 'attack': doAttack(+el.dataset.i); break;
    case 'close': closeModal(); break;
    case 'help': showHelp(); break;
    case 'save': toast(saveGame() ? 'Игра сохранена 💾' : 'Не удалось сохранить', saveGame() ? 'good' : 'warn'); break;
    case 'export': showExport(); break;
    case 'import': showImport(); break;
    case 'copy': {
      const box = $('#saveBox'); box.select();
      try { navigator.clipboard.writeText(box.value); } catch (err) { document.execCommand('copy'); }
      toast('Скопировано', 'good'); break;
    }
    case 'doimport': {
      if (importSave($('#saveBox').value)) { closeModal(); toast('Сохранение загружено', 'good'); }
      else toast('Неверный код сохранения', 'warn');
      break;
    }
    case 'rebirth': showRebirth(); break;
    case 'dorebirth': { const g = rebirth(); closeModal(); if (g) toast(`♻️ Возрождение! +${g} оч. наследия`, 'good'); break; }
    case 'reset': showReset(); break;
    case 'doreset': resetGame(); closeModal(); toast('Игра сброшена'); break;
    case 'caravan': break; // обрабатывается в pointerdown
  }
});

document.addEventListener('pointerdown', e => {
  const c = e.target.closest('.caravan');
  if (c) { e.preventDefault(); onCaravan(c); }
});

$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
window.addEventListener('pagehide', () => saveGame());

/* ---------- Запуск ---------- */
function startGame() {
  const off = initGame();
  buildAll();
  refresh();
  if (off) showOffline(off);
  else if (!S.flags.tut) { showHelp(); }
  S.flags.tut = true;
  setInterval(() => { step(); refresh(); }, 250);
}

startGame();
