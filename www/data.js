'use strict';
/* =====================================================
   ИМПЕРИЯ ЭПОХ — данные игры (здания, армия, технологии, карта)
   ===================================================== */

const SAVE_KEY = 'empire_of_ages_v1';
const OFFLINE_MAX = 8 * 3600; // максимум секунд офлайн-дохода
const MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500, 750, 1000]; // на каждой отметке здание даёт x2

const RES = {
  food:  { n: 'Еда',     i: '🌾' },
  wood:  { n: 'Дерево',  i: '🪵' },
  stone: { n: 'Камень',  i: '🪨' },
  gold:  { n: 'Золото',  i: '🪙' },
  sci:   { n: 'Наука',   i: '🔬' }
};
const RK = ['food', 'wood', 'stone', 'gold', 'sci'];

/* ---------- Эпохи ---------- */
const ERAS = [
  { n: 'Каменный век',       i: '🏕️', cost: null },
  { n: 'Бронзовый век',      i: '🏺', cost: { food: 25000, wood: 25000, stone: 10000, sci: 3000 } },
  { n: 'Средневековье',      i: '🏰', cost: { food: 1200000, wood: 900000, stone: 180000, gold: 300000, sci: 150000 } },
  { n: 'Эпоха пороха',       i: '🔫', cost: { food: 6000000, wood: 4500000, stone: 6000000, gold: 4000000, sci: 5000000 } },
  { n: 'Индустриальная эра', i: '🏭', cost: { food: 6000000000, wood: 5000000000, stone: 3000000000, gold: 3000000000, sci: 300000000 } }
];

/* ---------- Здания ----------
   prod  — производство в секунду за 1 здание (до множителей)
   fx    — особый эффект (обрабатывается в calc())
   cost  — цена первой штуки, g — рост цены за каждую следующую */
const BUILDINGS = [
  { id: 'farm',    n: 'Ферма',         i: '🌾', era: 0, cost: { wood: 10 },                       g: 1.15, prod: { food: 0.5 } },
  { id: 'lumber',  n: 'Лесопилка',     i: '🪓', era: 0, cost: { food: 12 },                       g: 1.15, prod: { wood: 0.5 } },
  { id: 'quarry',  n: 'Каменоломня',   i: '⛏️', era: 0, cost: { wood: 60, food: 30 },             g: 1.16, prod: { stone: 0.3 } },
  { id: 'house',   n: 'Дом',           i: '🏠', era: 0, cost: { wood: 40, stone: 10 },            g: 1.18, fx: 'pop' },
  { id: 'storage', n: 'Склад',         i: '📦', era: 0, cost: { wood: 80, stone: 40 },            g: 1.30, fx: 'cap' },
  { id: 'school',  n: 'Школа',         i: '📜', era: 0, cost: { wood: 100, stone: 20 },           g: 1.17, prod: { sci: 0.2 } },

  { id: 'market',  n: 'Рынок',         i: '🏪', era: 1, cost: { wood: 500, stone: 250 },          g: 1.17, prod: { gold: 0.6 } },
  { id: 'smithy',  n: 'Кузница',       i: '⚒️', era: 1, cost: { stone: 600, gold: 100 },          g: 1.42,  fx: 'atk' },

  { id: 'mine',    n: 'Шахта',         i: '⛰️', era: 2, cost: { wood: 6000, stone: 3000, gold: 500 },   g: 1.17, prod: { stone: 12, gold: 1.5 } },
  { id: 'univ',    n: 'Университет',   i: '🎓', era: 2, cost: { wood: 8000, stone: 4000, gold: 1200 },  g: 1.18, prod: { sci: 6 } },
  { id: 'castle',  n: 'Замок',         i: '🏰', era: 2, cost: { stone: 12000, gold: 2000 },             g: 1.37, fx: 'castle' },

  { id: 'bank',    n: 'Банк',          i: '🏦', era: 3, cost: { stone: 80000, gold: 20000 },            g: 1.17, prod: { gold: 60 } },
  { id: 'factory', n: 'Мануфактура',   i: '🏭', era: 3, cost: { wood: 120000, stone: 60000, gold: 20000 }, g: 1.17, prod: { food: 150, wood: 150, stone: 80 } },

  { id: 'power',   n: 'Электростанция', i: '⚡', era: 4, cost: { stone: 2e6, gold: 5e5 },               g: 1.42,  fx: 'power' },
  { id: 'lab',     n: 'Лаборатория',   i: '🧪', era: 4, cost: { stone: 1.5e6, gold: 1e6 },              g: 1.18, prod: { sci: 600 } }
];

/* ---------- Армия ---------- */
const UNITS = [
  { id: 'warrior',   n: 'Воин',      i: '⚔️', era: 0, cost: { food: 30, wood: 15 },                  atk: 3,    hp: 10,   up: 0.05 },
  { id: 'archer',    n: 'Лучник',    i: '🏹', era: 1, cost: { wood: 150, gold: 30 },                 atk: 12,   hp: 22,   up: 0.2 },
  { id: 'horse',     n: 'Всадник',   i: '🐎', era: 2, cost: { food: 900, gold: 200 },                atk: 35,   hp: 90,   up: 0.8 },
  { id: 'trebuchet', n: 'Требюше',   i: '🎯', era: 2, cost: { wood: 2500, stone: 1500, gold: 300 },  atk: 130,  hp: 60,   up: 1 },
  { id: 'musket',    n: 'Мушкетёр',  i: '🔫', era: 3, cost: { food: 8000, wood: 3000, gold: 2500 },  atk: 160,  hp: 400,  up: 4 },
  { id: 'cannon',    n: 'Пушка',     i: '💣', era: 3, cost: { wood: 12000, stone: 8000, gold: 5000 }, atk: 700,  hp: 300,  up: 5 },
  { id: 'tank',      n: 'Танк',      i: '🛡️', era: 4, cost: { food: 1e5, stone: 1.5e5, gold: 6e4 },  atk: 2200, hp: 4500, up: 30 },
  { id: 'plane',     n: 'Самолёт',   i: '✈️', era: 4, cost: { wood: 2e5, stone: 2e5, gold: 1.2e5 },  atk: 9000, hp: 2500, up: 40 }
];

/* ---------- Технологии ----------
   e — эффекты. Ключи: food/wood/stone/gold/sci/all (+% производства), click (+x к сбору),
   cap (+% склада), pop (+жителей), atk, hp (+% армии), off (+офлайн-эффективность),
   ucost (скидка на армию), bcost (скидка на здания) */
const TECHS = [
  { id: 'fire',    n: 'Огонь',               i: '🔥', era: 0, cost: 15,   req: null,     e: { food: 0.25 } },
  { id: 'tools',   n: 'Каменные орудия',     i: '🪓', era: 0, cost: 25,   req: 'fire',   e: { wood: 0.25 } },
  { id: 'hunt',    n: 'Охота',               i: '🏹', era: 0, cost: 40,   req: 'fire',   e: { click: 1 } },
  { id: 'pick',    n: 'Кремнёвые кирки',     i: '⛏️', era: 0, cost: 60,   req: 'tools',  e: { stone: 0.25 } },
  { id: 'spear',   n: 'Копьё',               i: '🗡️', era: 0, cost: 80,   req: 'hunt',   e: { atk: 0.15 } },
  { id: 'pot',     n: 'Гончарство',          i: '🏺', era: 0, cost: 120,  req: 'pick',   e: { cap: 0.5 } },
  { id: 'write',   n: 'Письменность',        i: '✍️', era: 0, cost: 150,  req: 'pot',    e: { sci: 0.5 } },

  { id: 'bronze',  n: 'Бронзовые орудия',    i: '🥉', era: 1, cost: 6000,  req: 'write',  e: { all: 0.1 } },
  { id: 'coin',    n: 'Монеты',              i: '🪙', era: 1, cost: 7500,  req: 'bronze', e: { gold: 0.5 } },
  { id: 'irrig',   n: 'Ирригация',           i: '💧', era: 1, cost: 9000,  req: 'bronze', e: { food: 0.5 } },
  { id: 'wheel',   n: 'Колесо',              i: '🛞', era: 1, cost: 12000,  req: 'bronze', e: { bcost: 0.05 } },
  { id: 'armor',   n: 'Бронзовые доспехи',   i: '🛡️', era: 1, cost: 15000, req: 'bronze', e: { hp: 0.2 } },
  { id: 'law',     n: 'Законы',              i: '⚖️', era: 1, cost: 18000, req: 'coin',   e: { pop: 15 } },
  { id: 'math',    n: 'Математика',          i: '📐', era: 1, cost: 27000, req: 'write',  e: { sci: 0.5 } },

  { id: 'iron',    n: 'Железо',              i: '🔩', era: 2, cost: 1800000,  req: 'armor',  e: { atk: 0.25, hp: 0.25 } },
  { id: 'feudal',  n: 'Феодализм',           i: '👑', era: 2, cost: 2400000,  req: 'law',    e: { all: 0.15 } },
  { id: 'guild',   n: 'Гильдии',             i: '🏛️', era: 2, cost: 3000000, req: 'coin',   e: { gold: 0.75 } },
  { id: 'arch',    n: 'Архитектура',         i: '🏗️', era: 2, cost: 3600000, req: 'feudal', e: { cap: 1 } },
  { id: 'print',   n: 'Книгопечатание',      i: '📚', era: 2, cost: 4500000, req: 'math',   e: { sci: 0.75, off: 0.1 } },
  { id: 'horse',   n: 'Верховая езда',       i: '🐴', era: 2, cost: 5400000, req: 'iron',   e: { ucost: 0.1 } },

  { id: 'powder',  n: 'Порох',               i: '💥', era: 3, cost: 20000000,  req: 'iron',   e: { atk: 0.5 } },
  { id: 'steam',   n: 'Паровая машина',      i: '🚂', era: 3, cost: 30000000, req: 'feudal', e: { all: 0.25 } },
  { id: 'banking', n: 'Банковское дело',     i: '💱', era: 3, cost: 40000000,  req: 'guild',  e: { gold: 1 } },
  { id: 'nav',     n: 'Навигация',           i: '🧭', era: 3, cost: 50000000, req: 'steam', e: { food: 0.5, wood: 0.5 } },
  { id: 'enlight', n: 'Просвещение',         i: '💡', era: 3, cost: 60000000,  req: 'print',  e: { sci: 1, off: 0.1 } },

  { id: 'elec',    n: 'Электричество',       i: '⚡', era: 4, cost: 3e+09,  req: 'steam',  e: { all: 0.4 } },
  { id: 'engine',  n: 'Двигатель',           i: '🛢️', era: 4, cost: 4.5e+09,  req: 'powder', e: { atk: 0.5, hp: 0.5 } },
  { id: 'comp',    n: 'Компьютеры',          i: '💻', era: 4, cost: 7.5e+09,  req: 'enlight', e: { sci: 1.5, off: 0.1 } },
  { id: 'auto',    n: 'Автоматизация',       i: '🤖', era: 4, cost: 1.2e+10,  req: 'elec',   e: { all: 0.6, bcost: 0.1 } },
  { id: 'logist',  n: 'Логистика',           i: '🚚', era: 4, cost: 1.5e+10,  req: 'engine', e: { ucost: 0.15, cap: 2 } }
];

/* ---------- Карта завоеваний ---------- */
const TERR_DEFS = [
  // имя, эмодзи, эпоха, бонус за захват
  ['Дикие луга',         '🌿', 0, { food: 0.10 }],
  ['Лесное племя',       '🌲', 0, { wood: 0.10 }],
  ['Каменный перевал',   '⛰️', 0, { stone: 0.10 }],
  ['Бронзовый форт',     '🛡️', 1, { atk: 0.05 }],
  ['Торговый порт',      '⚓', 1, { gold: 0.15 }],
  ['Долина мудрецов',    '🕌', 1, { sci: 0.15 }],
  ['Замок разбойников',  '🏰', 2, { pop: 10 }],
  ['Пустынный эмират',   '🏜️', 2, { all: 0.05 }],
  ['Ледяной север',      '❄️', 2, { hp: 0.08 }],
  ['Остров пиратов',     '🏴‍☠️', 2, { gold: 0.2 }],
  ['Земли мушкетёров',   '🔫', 3, { atk: 0.08 }],
  ['Имперская столица',  '🏛️', 3, { all: 0.08 }],
  ['Мануфактурный союз', '⚙️', 3, { sci: 0.25 }],
  ['Нефтяной картель',   '🛢️', 4, { pop: 30 }],
  ['Республика машин',   '🤖', 4, { all: 0.10 }],
  ['Мировая держава',    '🌍', 4, { all: 0.15, atk: 0.10 }]
];
const TERRS = TERR_DEFS.map((d, i) => {
  const P = 3000 * Math.pow(3.1, i); // «сила» врага = атака × здоровье
  return {
    id: 't' + i, n: d[0], i: d[1], era: d[2], bonus: d[3], P,
    atk: Math.sqrt(P * 0.3), hp: Math.sqrt(P / 0.3),
    base: 100 * Math.pow(1.9, i)
  };
});

/* ---------- Достижения (каждое даёт +2% к производству) ---------- */
const ACHS = [
  { id: 'a_tap1',  n: 'Первые шаги',     d: 'Собери ресурсы 100 раз',        f: () => S.st.taps >= 100 },
  { id: 'a_tap2',  n: 'Трудяга',         d: 'Собери ресурсы 1000 раз',       f: () => S.st.taps >= 1000 },
  { id: 'a_farm',  n: 'Фермер',          d: 'Построй 10 ферм',               f: () => cnt('farm') >= 10 },
  { id: 'a_b100',  n: 'Строитель',       d: 'Построй 100 зданий',            f: () => totalBuildings() >= 100 },
  { id: 'a_b500',  n: 'Архитектор',      d: 'Построй 500 зданий',            f: () => totalBuildings() >= 500 },
  { id: 'a_e1',    n: 'Бронзовый рассвет', d: 'Достигни Бронзового века',    f: () => S.era >= 1 },
  { id: 'a_e2',    n: 'Рыцарство',       d: 'Достигни Средневековья',        f: () => S.era >= 2 },
  { id: 'a_e3',    n: 'Огненный залп',   d: 'Достигни Эпохи пороха',         f: () => S.era >= 3 },
  { id: 'a_e4',    n: 'Дым фабрик',      d: 'Достигни Индустриальной эры',   f: () => S.era >= 4 },
  { id: 'a_u1',    n: 'Новобранец',      d: 'Собери армию из 10 юнитов',     f: () => popUsed() >= 10 },
  { id: 'a_u2',    n: 'Полководец',      d: 'Собери армию из 100 юнитов',    f: () => popUsed() >= 100 },
  { id: 'a_w1',    n: 'Завоеватель',     d: 'Захвати 1 территорию',          f: () => terrCount() >= 1 },
  { id: 'a_w5',    n: 'Покоритель',      d: 'Захвати 5 территорий',          f: () => terrCount() >= 5 },
  { id: 'a_w16',   n: 'Владыка мира',    d: 'Захвати все территории',        f: () => terrCount() >= TERRS.length },
  { id: 'a_t10',   n: 'Мудрец',          d: 'Изучи 10 технологий',           f: () => techCount() >= 10 },
  { id: 'a_t25',   n: 'Академик',        d: 'Изучи 25 технологий',           f: () => techCount() >= 25 },
  { id: 'a_gold',  n: 'Богач',           d: 'Добудь 1 млн ресурсов за всё время', f: () => S.st.total >= 1e6 },
  { id: 'a_car',   n: 'Торговец',        d: 'Поймай 5 караванов',            f: () => S.st.caravans >= 5 },
  { id: 'a_reb',   n: 'Возрождение',     d: 'Соверши возрождение',           f: () => S.st.rebirths >= 1 }
];

/* ---------- Подсказки ---------- */
const BONUS_LABELS = {
  food: v => `+${pct(v)} 🌾 еды`, wood: v => `+${pct(v)} 🪵 дерева`, stone: v => `+${pct(v)} 🪨 камня`,
  gold: v => `+${pct(v)} 🪙 золота`, sci: v => `+${pct(v)} 🔬 науки`, all: v => `+${pct(v)} ко всему производству`,
  click: v => `+${pct(v)} к сбору ресурсов`, cap: v => `+${pct(v)} вместимости складов`,
  pop: v => `+${v} жителей`, atk: v => `+${pct(v)} атаки`, hp: v => `+${pct(v)} здоровья`,
  off: v => `+${pct(v)} офлайн-дохода`, ucost: v => `−${pct(v)} цены войск`, bcost: v => `−${pct(v)} цены зданий`
};
function pct(v) { return Math.round(v * 100) + '%'; }
function bonusText(e) { return Object.keys(e).map(k => BONUS_LABELS[k](e[k])).join(', '); }

const BMAP = {}; BUILDINGS.forEach(b => BMAP[b.id] = b);
const UMAP = {}; UNITS.forEach(u => UMAP[u.id] = u);
const TMAP = {}; TECHS.forEach(t => TMAP[t.id] = t);
