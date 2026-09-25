/* Drone Logistics OS — simulation engine (pure logic, no DOM).
   Browser: window.Sim · Node: require('./sim.js') */
(function (root) {
'use strict';

const CFG = {
  cruise: 20, climb: 6, drainPerKm: 1.8, hoverDrain: 0.05, reserve: 10, nextMission: 25, idleMargin: 30, swapTime: 60, winchTime: 20, winchAlt: 30,
  bays: 4, packs: 72, packCharge: 30 * 60,
  maxPickupKm: 10, sepH: 160, sepV: 22, layerE: 90, layerW: 120,
  slaMin: 30, orderEvery: 40, fleet: 36,
};

// ponytail: flat-earth projection around Dubai; error < 0.1% across the 40 km service area
const LAT0 = 25.15, LNG0 = 55.25, MY = 110574, MX = 111320 * Math.cos(LAT0 * Math.PI / 180);
const xy = p => [(p.lng - LNG0) * MX, (p.lat - LAT0) * MY];
const ll = ([x, y]) => ({ lng: LNG0 + x / MX, lat: LAT0 + y / MY });
const dist = (a, b) => Math.hypot((a.lng - b.lng) * MX, (a.lat - b.lat) * MY);
const bearing = (a, b) => (Math.atan2((b.lng - a.lng) * MX, (b.lat - a.lat) * MY) * 180 / Math.PI + 360) % 360;
const km = m => (m / 1000).toFixed(1);
const turn = (h, to, max) => { const d = ((to - h + 540) % 360) - 180; return (h + Math.max(-max, Math.min(max, d)) + 360) % 360; };

function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const PODS = [
  { id: 'P-01', name: 'Dubai Marina', lat: 25.0790, lng: 55.1390 },
  { id: 'P-02', name: 'Palm Jumeirah', lat: 25.1120, lng: 55.1395 },
  { id: 'P-03', name: 'Al Barsha', lat: 25.1100, lng: 55.2000 },
  { id: 'P-04', name: 'Dubai Hills', lat: 25.1020, lng: 55.2450 },
  { id: 'P-05', name: 'Downtown', lat: 25.1950, lng: 55.2780 },
  { id: 'P-06', name: 'Al Wasl', lat: 25.2010, lng: 55.2520 },
  { id: 'P-07', name: 'Deira', lat: 25.2700, lng: 55.3050 },
  { id: 'P-08', name: 'Silicon Oasis', lat: 25.1215, lng: 55.3800 },
  { id: 'P-09', name: 'Al Warqa', lat: 25.1950, lng: 55.4150 },
];
const HUB = { id: 'EH-01', name: 'Energy Hub · Meydan', lat: 25.1560, lng: 55.2950 };
const ZONES = [
  { id: 'NFZ-DXB', name: 'DXB International CTR', lat: 25.2532, lng: 55.3657, r: 5000, kind: 'airport' },
  { id: 'NFZ-DWC', name: 'DWC Al Maktoum CTR', lat: 24.8964, lng: 55.1614, r: 6000, kind: 'airport' },
  { id: 'NFZ-MIN', name: 'Al Minhad Air Base', lat: 25.0270, lng: 55.3660, r: 4000, kind: 'military' },
  { id: 'NFZ-ZAB', name: 'Zabeel Restricted Area', lat: 25.2240, lng: 55.2960, r: 1100, kind: 'restricted' },
];
const MERCHANTS = [
  { name: 'Marina Pharmacy 24h', cat: 'Pharmacy', lat: 25.0810, lng: 55.1410 },
  { name: 'Seaside Kitchen · JBR', cat: 'Food', lat: 25.0790, lng: 55.1350 },
  { name: 'Palm Fresh Grocer', cat: 'Grocery', lat: 25.1100, lng: 55.1420 },
  { name: 'Barsha Pharmacy', cat: 'Pharmacy', lat: 25.1120, lng: 55.1960 },
  { name: 'Hills Fresh Market', cat: 'Grocery', lat: 25.1040, lng: 55.2420 },
  { name: 'Hills Medical Centre', cat: 'Medical', lat: 25.1000, lng: 55.2500 },
  { name: 'Al Quoz Dark Store', cat: 'Parcel', lat: 25.1400, lng: 55.2250 },
  { name: 'Downtown Bistro', cat: 'Food', lat: 25.1940, lng: 55.2760 },
  { name: 'DIFC Legal Couriers', cat: 'Documents', lat: 25.2110, lng: 55.2800 },
  { name: 'Healthcare City Lab', cat: 'Medical', lat: 25.2300, lng: 55.3200 },
  { name: 'Deira Spice Kitchen', cat: 'Food', lat: 25.2680, lng: 55.3000 },
  { name: 'Oasis Pharmacy · DSO', cat: 'Pharmacy', lat: 25.1230, lng: 55.3780 },
  { name: 'Warqa Grocer', cat: 'Grocery', lat: 25.1930, lng: 55.4120 },
  { name: 'Meydan E-Store Hub', cat: 'Parcel', lat: 25.1650, lng: 55.3000 },
  { name: 'Jumeirah Bakery', cat: 'Food', lat: 25.2030, lng: 55.2500 },
];
const PLACES = [
  ['Marina Gate', 25.0880, 55.1475], ['JBR The Walk', 25.0780, 55.1330], ['JLT Cluster D', 25.0700, 55.1430],
  ['Emirates Hills', 25.0700, 55.1680], ['Dubai Internet City', 25.0950, 55.1590], ['Palm Frond G', 25.1170, 55.1300],
  ['Atlantis The Palm', 25.1304, 55.1171], ['Al Sufouh', 25.1080, 55.1700], ['Mall of the Emirates', 25.1181, 55.2006],
  ['Al Barsha South', 25.0960, 55.2120], ['Umm Suqeim 2', 25.1450, 55.2000], ['Alserkal Avenue', 25.1440, 55.2270],
  ['Dubai Hills Mall', 25.1020, 55.2400], ['Arabian Ranches', 25.0550, 55.2700], ['Motor City', 25.0460, 55.2380],
  ['JVC District 12', 25.0600, 55.2100], ['Bay Square', 25.1880, 55.2800], ['Burj Khalifa Blvd', 25.1960, 55.2740],
  ['DIFC Gate Village', 25.2130, 55.2820], ['City Walk', 25.2070, 55.2620], ['Jumeirah 1 Villas', 25.2250, 55.2600],
  ['Al Safa Park', 25.1880, 55.2450], ['Al Wasl Road', 25.1750, 55.2300], ['Meydan Heights', 25.1600, 55.3000],
  ['Al Jaddaf', 25.2150, 55.3250], ['Dubai Festival City', 25.2200, 55.3550], ['Gold Souk', 25.2700, 55.2970],
  ['Al Rigga', 25.2640, 55.3170], ['Al Qusais', 25.2800, 55.3800], ['Silicon Oasis HQ', 25.1180, 55.3830],
  ['Academic City', 25.1250, 55.4150], ['International City', 25.1640, 55.4060], ['Mirdif Hills', 25.2150, 55.4230],
  ['Al Warqa 3', 25.1900, 55.4200], ['Nad Al Sheba', 25.1650, 55.3300], ['Ras Al Khor', 25.1880, 55.3450],
  ['Al Karama', 25.2450, 55.3040], ['Oud Metha', 25.2340, 55.3150], ['Discovery Gardens', 25.0400, 55.1450],
  ['Jumeirah Golf Estates', 25.0220, 55.2000],
].map(([name, lat, lng]) => ({ name, lat, lng }));
const CATS = { Pharmacy: [0.2, 1.2, 15], Food: [0.8, 2.6, 18], Grocery: [1.4, 3.0, 20], Documents: [0.1, 0.5, 25], Parcel: [0.4, 2.8, 22], Medical: [0.2, 0.9, 35] };
const NAMES = ['Aisha K.', 'Omar S.', 'Rahul M.', 'Fatima A.', 'James W.', 'Priya N.', 'Khalid R.', 'Maria L.', 'Hassan T.', 'Sara B.', 'Arjun P.', 'Layla H.', 'Yousef D.', 'Chen W.', 'Noura F.', 'Daniel O.', 'Meera J.', 'Ahmed Z.', 'Elena V.', 'Faisal Q.', 'Hana M.', 'Rohan G.', 'Mariam E.', 'Lucas R.', 'Zainab I.'];

// DXB runway 12 threshold + approach geometry, and a coastal helicopter tour
const RWY = { lat: 25.2622, lng: 55.3485, u: [Math.sin(2 * Math.PI / 3), Math.cos(2 * Math.PI / 3)] };
const HELI = [[25.1304, 55.1171], [25.1412, 55.1853], [25.1600, 55.2050], [25.2150, 55.2500], [25.1950, 55.2760], [25.1500, 55.2200], [25.0900, 55.1350]].map(([lat, lng]) => ({ lat, lng }));

const AIRBORNE = new Set(['to-pickup', 'loading', 'to-drop', 'dropping', 'returning', 'to-hub', 'rebalancing', 'rtb', 'fault']);
const airborne = d => AIRBORNE.has(d.status) && d.alt > 0.5;

// ---------- geofence-aware routing ----------
const inside = (p, z) => dist(p, z) < z.r;
function segHits(a, b, z) {
  const [ax, ay] = xy(a), [bx, by] = xy(b), [cx, cy] = xy(z);
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx - cx, ay + t * dy - cy) < z.r;
}
function detour(a, b, z) { // waypoints on a 1.18r arc, shorter way round
  const c = xy(z), pa = xy(a), pb = xy(b), R = z.r * 1.18;
  const aA = Math.atan2(pa[1] - c[1], pa[0] - c[0]);
  let diff = Math.atan2(pb[1] - c[1], pb[0] - c[0]) - aA;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  const n = Math.max(2, Math.ceil(Math.abs(diff) / (Math.PI / 6))), out = [];
  for (let i = 1; i < n; i++) { const t = aA + diff * i / n; out.push(ll([c[0] + R * Math.cos(t), c[1] + R * Math.sin(t)])); }
  return out;
}
function planRoute(S, a, b) {
  const zones = S.zones.filter(z => z.active && !inside(a, z) && !inside(b, z));
  const pts = [{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }];
  for (let guard = 0; guard < 16; guard++) {
    let hit = -1, zone = null;
    for (let i = 0; i < pts.length - 1 && hit < 0; i++) for (const z of zones) if (segHits(pts[i], pts[i + 1], z)) { hit = i; zone = z; break; }
    if (hit < 0) break;
    pts.splice(hit + 1, 0, ...detour(pts[hit], pts[hit + 1], zone));
  }
  return pts.slice(1);
}
const pathLen = (a, pts) => pts.reduce((s, p, i) => s + dist(i ? pts[i - 1] : a, p), 0);
const energyFor = (S, m, kg = 0) => m / 1000 * CFG.drainPerKm * (1 + 0.07 * kg) * (1 + S.weather.wind / 120);
// ponytail: one energy hub (client spec) — every plan must keep enough charge to reach it
const hubCost = (S, p) => energyFor(S, pathLen(p, planRoute(S, p, S.hub)));

// ---------- state ----------
function log(S, level, msg, ref) { S.events.push({ id: ++S.seq, t: S.t, level, msg, ref }); if (S.events.length > 400) S.events.shift(); }

function create({ seed = 7, clock0 = Date.now() } = {}) {
  const R = rng(seed);
  const S = {
    t: 0, seq: 0, orderSeq: 0, tfrSeq: 0, R, cfg: CFG, clock0, acc: 0, pairs: {},
    pods: PODS.map(p => ({ ...p, pads: 6, served: 0 })),
    hub: { ...HUB, bays: Array(CFG.bays).fill(null), queue: [], charged: CFG.packs - 12, charging: Array.from({ length: 12 }, (_, i) => (i + 1) * 150), swaps: 0 },
    zones: ZONES.map(z => ({ ...z, active: true })),
    drones: [], orders: [], byId: new Map(), events: [], flashes: [], traffic: [],
    weather: { temp: 38, wind: 12, dir: 'NW', vis: 9, storm: false },
    stats: { delivered: 0, fallback: 0, km: 0, sep: 0, ta: 0, reroutes: 0, onTime: 0, totalMin: 0, faults: 0, depleted: 0, byHour: {}, byCat: {}, byPod: {}, timeByHour: {} },
    nextOrder: 3, rushUntil: 0, lastDecision: null,
  };
  for (let i = 0; i < CFG.fleet; i++) {
    const pod = S.pods[i % S.pods.length], exp = i % 4 === 3;
    S.drones.push({
      id: `DRN-${101 + i}`, model: exp ? 'Q4 Express' : 'H6 Cargo', maxKg: exp ? 1.5 : 3, speed: exp ? 24 : 20,
      lat: pod.lat, lng: pod.lng, alt: 0, heading: Math.round(R() * 360), battery: 60 + Math.round(R() * 40),
      status: 'idle', podId: pod.id, home: pod.id, legs: [], path: [], order: null, trail: [], lastTrail: -99,
      boost: 0, boostUntil: 0, cap: 0, capUntil: 0, lowHandled: false,
      cycles: 80 + Math.floor(R() * 320), health: 91 + Math.floor(R() * 9), km: 0, flights: 0, deliveries: 0,
    });
  }
  S.traffic = [
    { id: 'UAE237', type: 'jet', mode: 'arr', s: 17000 }, { id: 'UAE54', type: 'jet', mode: 'arr', s: 34000 },
    { id: 'FDB1461', type: 'jet', mode: 'dep', s: 0 }, { id: 'A6-HLT', type: 'heli', wp: 1, ...HELI[0], alt: 250, heading: 80 },
  ];
  S.traffic.forEach(a => stepTraffic(S, a, 0));
  log(S, 'ok', `Network online — ${PODS.length} pods, 1 energy hub, ${CFG.fleet} drones`);
  return S;
}

const hourOf = S => Math.floor(((S.clock0 / 1000 + S.t) / 3600 + 4) % 24); // Dubai = UTC+4
const orderOf = (S, dr) => dr.order && S.byId.get(dr.order);
const podBlocked = (S, p) => S.zones.some(z => z.active && inside(p, z));
const podLoad = (S, p) => S.drones.filter(d => d.podId === p.id || d.legs[0]?.land?.id === p.id).length;
function nearestPod(S, at, exclude) {
  const ok = S.pods.filter(p => !podBlocked(S, p) && p.id !== exclude && podLoad(S, p) < p.pads);
  return (ok.length ? ok : S.pods).reduce((b, p) => dist(p, at) < dist(b, at) ? p : b);
}

// ---------- orders & dispatch ----------
function addOrder(S, o = {}) {
  const R = S.R;
  const m = o.merchant || MERCHANTS[Math.floor(R() * MERCHANTS.length)];
  let drop = o.drop;
  if (!drop) {
    const near = PLACES.filter(p => dist(p, m) < 8000 && dist(p, m) > 900), pool = near.length ? near : PLACES;
    const pl = pool[Math.floor(R() * pool.length)];
    drop = { name: pl.name, lat: pl.lat + (R() - 0.5) * 0.004, lng: pl.lng + (R() - 0.5) * 0.004 };
  }
  const cat = o.cat || m.cat, [lo, hi, fee] = CATS[cat];
  const order = {
    id: `ORD-${10240 + ++S.orderSeq}`, customer: o.customer || NAMES[Math.floor(R() * NAMES.length)], cat,
    kg: o.kg ?? Math.round((lo + R() * (hi - lo)) * 10) / 10, priority: cat === 'Medical', fee: fee + Math.round(R() * 8),
    pickup: { name: m.name, lat: m.lat, lng: m.lng }, drop, status: 'queued', created: S.t, trace: [], source: o.source || 'api',
  };
  S.orders.push(order); S.byId.set(order.id, order);
  const old = S.orders.findIndex(x => ['delivered', 'fallback'].includes(x.status));
  if (S.orders.length > 600 && old >= 0) S.byId.delete(S.orders.splice(old, 1)[0].id);
  const z = S.zones.find(z => z.active && inside(drop, z));
  if (z) {
    Object.assign(order, { status: 'fallback', note: `Drop-off inside ${z.name} — handed to ground courier` });
    S.stats.fallback++;
    log(S, 'warn', `${order.id} drop-off inside ${z.name} → routed to ground courier`, order.id);
    return order;
  }
  log(S, 'info', `${order.id} received · ${cat} ${order.kg} kg · ${m.name} → ${drop.name}`, order.id);
  return order;
}

function tryAssign(S, o) {
  const trace = [];
  const pods = S.pods.filter(p => !podBlocked(S, p)).map(p => ({ p, d: dist(p, o.pickup) })).sort((a, b) => a.d - b.d).slice(0, 4);
  for (const { p, d } of pods) {
    const tag = `${p.id} ${p.name} · ${km(d)} km`;
    if (d > CFG.maxPickupKm * 1000) { trace.push([false, tag, 'outside service radius']); continue; }
    const ready = S.drones.filter(x => x.status === 'idle' && x.podId === p.id);
    if (!ready.length) { trace.push([false, tag, 'no drone on pad']); continue; }
    const fit = ready.filter(x => x.maxKg >= o.kg).sort((a, b) => b.battery - a.battery);
    if (!fit.length) { trace.push([false, tag, `${o.kg} kg exceeds Q4 payload`]); continue; }
    const r1 = planRoute(S, p, o.pickup), r2 = planRoute(S, o.pickup, o.drop);
    const m1 = pathLen(p, r1), m2 = pathLen(o.pickup, r2);
    const need = Math.ceil(energyFor(S, m1) + energyFor(S, m2, o.kg) + hubCost(S, o.drop) + 2 * CFG.winchTime * CFG.hoverDrain + CFG.reserve);
    const dr = fit[0];
    if (dr.battery < need) { trace.push([false, tag, `${dr.id} ${Math.round(dr.battery)}% < ${need}% needed`]); continue; }
    trace.push([true, tag, `${dr.id} ${Math.round(dr.battery)}% ≥ ${need}% needed`]);
    const extra = m1 + m2 - d - dist(o.pickup, o.drop), secs = (m1 + m2) / dr.speed + 2 * CFG.winchTime + 45;
    Object.assign(o, { status: 'assigned', droneId: dr.id, podId: p.id, assigned: S.t, eta: S.t + secs, meters: m1 + m2, trace, need });
    dr.order = o.id; dr.flights++; dr.lowHandled = false;
    dr.legs = [
      { kind: 'fly', to: o.pickup, status: 'to-pickup', path: r1 },
      { kind: 'winch', dur: CFG.winchTime, status: 'loading', done: 'picked' },
      { kind: 'fly', to: o.drop, status: 'to-drop', path: r2 },
      { kind: 'winch', dur: CFG.winchTime, status: 'dropping', done: 'delivered' },
      { kind: 'after' },
    ];
    startLeg(S, dr);
    S.flashes.push({ kind: 'arc', from: { lat: p.lat, lng: p.lng }, to: o.pickup, to2: o.drop, t: S.t });
    S.lastDecision = { order: o.id, cat: o.cat, kg: o.kg, t: S.t, trace, drone: dr.id, pod: p.id, km: km(m1 + m2), detour: extra > 80 ? km(extra) : null, eta: Math.round(secs / 60) };
    log(S, 'ok', `Dispatch ${o.id} → ${dr.id} from ${p.id} ${p.name} · ${km(m1 + m2)} km · ETA ${Math.round(secs / 60)} min${extra > 80 ? ` · geofence detour +${km(extra)} km` : ''}`, o.id);
    return true;
  }
  o.trace = trace;
  if (!o.waitLogged) { o.waitLogged = true; log(S, 'warn', `${o.id} waiting — no eligible drone at nearest pods`, o.id); }
  return false;
}

function dispatch(S) {
  if (S.weather.storm) return;
  S.orders.filter(o => o.status === 'queued')
    .sort((a, b) => (b.priority - a.priority) || (a.created - b.created))
    .forEach(o => tryAssign(S, o));
}

function requeue(S, dr, note, pickup) {
  const o = orderOf(S, dr);
  dr.order = null;
  if (!o) return null;
  if (pickup) o.pickup = pickup;
  Object.assign(o, { status: 'queued', droneId: null, podId: null, note, waitLogged: false });
  return o;
}

// ---------- mission legs ----------
function startLeg(S, dr) {
  const leg = dr.legs[0];
  if (!leg) { dr.status = 'idle'; return; }
  if (leg.kind === 'after') { dr.legs.shift(); return afterMission(S, dr); }
  if (leg.kind === 'rebalance') { dr.legs.shift(); return rebalance(S, dr); }
  dr.status = leg.status || dr.status;
  if (leg.kind === 'fly') { dr.podId = null; dr.path = leg.path || planRoute(S, dr, leg.to); }
  if (leg.kind === 'winch') leg.left = leg.dur;
}
function nextLeg(S, dr) { dr.legs.shift(); startLeg(S, dr); }
function goPod(S, dr, p, status) { dr.legs = [{ kind: 'fly', to: p, status, land: { type: 'pod', id: p.id } }]; startLeg(S, dr); }
function sendToHub(S, dr, why) {
  dr.legs = [{ kind: 'fly', to: S.hub, status: 'to-hub', land: { type: 'hub' } }, { kind: 'swap', status: 'queued-swap' }, { kind: 'rebalance' }];
  startLeg(S, dr);
  log(S, 'warn', `${dr.id} battery ${Math.round(dr.battery)}% — ${why}, auto-routed to ${S.hub.name}`, dr.id);
}
function afterMission(S, dr) { // return to a pod only if, once there, it can still fly a mission and reach the hub
  const p = nearestPod(S, dr), left = dr.battery - energyFor(S, pathLen(dr, planRoute(S, dr, p))) - hubCost(S, p);
  if (left < CFG.nextMission) return sendToHub(S, dr, 'not enough for another mission');
  goPod(S, dr, p, 'returning');
}
function rebalance(S, dr) { // send fresh drone where drones are scarce and orders are waiting
  const open = S.pods.filter(p => !podBlocked(S, p));
  const waiting = p => S.orders.filter(o => o.status === 'queued' && dist(o.pickup, p) < 5000).length;
  const reachable = open.filter(p => dr.battery - hubCost(S, p) * 2 >= CFG.idleMargin + 5); // arrive with a mission + hub trip in hand
  const score = p => podLoad(S, p) - 0.7 * waiting(p) + dist(p, dr) / 1e4;
  const p = (reachable.length ? reachable : open.length ? open : S.pods).reduce((b, p) => score(p) < score(b) ? p : b);
  goPod(S, dr, p, 'rebalancing');
  log(S, 'info', `Fleet rebalancing: ${dr.id} → ${p.id} ${p.name} (${podLoad(S, p) - 1} drones stationed)`, dr.id);
}
function dock(S, dr, land) {
  dr.alt = 0; dr.path = []; dr.hubCost = null;
  if (land.type === 'pod') { dr.podId = land.id; dr.status = 'idle'; }
  else S.hub.queue.push(dr.id);
}

function fly(S, dr, leg, dt) {
  const target = dr.path[0] || leg.to, d = dist(dr, target), toEnd = dist(dr, leg.to);
  const atDest = dr.path.length === 0 && d < 0.5;
  const final = dr.path.length <= 1 && toEnd < 350;
  let tgt = atDest ? (leg.land ? 0 : CFG.winchAlt) : final ? (leg.land ? 25 : CFG.winchAlt + 10)
    : (dr.heading < 180 ? CFG.layerE : CFG.layerW) + dr.boost;
  if (dr.cap && !atDest) tgt = Math.min(tgt, dr.cap);
  const dz = tgt - dr.alt; dr.alt += Math.sign(dz) * Math.min(Math.abs(dz), CFG.climb * dt);
  if (!atDest) {
    const v = (dr.alt < 25 && !final ? 0.25 : 1) * dr.speed * (S.weather.storm ? 0.8 : 1), step = v * dt;
    if (d > 1) dr.heading = turn(dr.heading, bearing(dr, target), 120 * dt);
    if (d <= step) { dr.lat = target.lat; dr.lng = target.lng; if (dr.path.length) dr.path.shift(); }
    else { dr.lat += (target.lat - dr.lat) * step / d; dr.lng += (target.lng - dr.lng) * step / d; }
    const moved = Math.min(step, d), o = orderOf(S, dr);
    dr.battery -= energyFor(S, moved, o && o.status === 'picked' ? o.kg : 0);
    dr.km += moved / 1000; S.stats.km += moved / 1000;
  } else dr.battery -= CFG.hoverDrain * dt;
  if (atDest && Math.abs(dr.alt - tgt) < 0.5) {
    if (leg.land) dock(S, dr, leg.land);
    nextLeg(S, dr);
  }
}

function winchDone(S, dr, leg) {
  const o = orderOf(S, dr);
  if (!o) return;
  if (leg.done === 'picked') {
    Object.assign(o, { status: 'picked', pickedAt: S.t });
    log(S, 'info', `${dr.id} collected ${o.id} at ${o.pickup.name}`, o.id);
    return;
  }
  const mins = (S.t - o.created) / 60, h = hourOf(S), st = S.stats;
  Object.assign(o, { status: 'delivered', delivered: S.t, mins });
  dr.order = null; dr.deliveries++;
  st.delivered++; st.totalMin += mins; if (mins <= CFG.slaMin) st.onTime++;
  st.byHour[h] = (st.byHour[h] || 0) + 1; st.timeByHour[h] = (st.timeByHour[h] || 0) + mins;
  st.byCat[o.cat] = (st.byCat[o.cat] || 0) + 1; st.byPod[o.podId] = (st.byPod[o.podId] || 0) + 1;
  const pod = S.pods.find(p => p.id === o.podId); if (pod) pod.served++;
  S.flashes.push({ kind: 'drop', at: o.drop, t: S.t });
  log(S, 'ok', `${o.id} delivered to ${o.customer} · ${o.drop.name} · ${mins.toFixed(1)} min`, o.id);
}

function swapStep(S, dr, leg, dt) {
  const H = S.hub;
  if (leg.bay == null) {
    const i = H.bays.indexOf(null);
    if (i < 0 || H.charged <= 0 || H.queue[0] !== dr.id) { dr.status = 'queued-swap'; return; }
    H.queue.shift(); H.bays[i] = dr.id; H.charged--;
    Object.assign(leg, { bay: i, left: CFG.swapTime }); dr.status = 'swapping';
    return;
  }
  leg.left -= dt;
  if (leg.left > 0) return;
  H.bays[leg.bay] = null; H.charging.push(S.t + CFG.packCharge * (1 - dr.battery / 100)); H.swaps++;
  dr.battery = 100; dr.cycles++; dr.lowHandled = false;
  log(S, 'ok', `${dr.id} battery swapped at bay ${leg.bay + 1} in ${CFG.swapTime}s — 100%`, dr.id);
  nextLeg(S, dr);
}

function lowBattery(S, dr) { // in-flight: finish delivery if energy allows, otherwise divert + hand over payload
  dr.lowHandled = true;
  const o = orderOf(S, dr);
  if (o && o.status === 'picked') {
    const toDrop = pathLen(dr, planRoute(S, dr, o.drop)), toHub = pathLen(o.drop, planRoute(S, o.drop, S.hub));
    if (dr.battery - energyFor(S, toDrop, o.kg) - energyFor(S, toHub) > 6) {
      dr.legs = dr.legs.map(l => l.kind === 'after' ? { kind: 'fly', to: S.hub, status: 'to-hub', land: { type: 'hub' } } : l);
      dr.legs.push({ kind: 'swap', status: 'queued-swap' }, { kind: 'rebalance' });
      log(S, 'warn', `${dr.id} battery ${Math.round(dr.battery)}% — completing ${o.id}, then auto-routing to Energy Hub`, dr.id);
      return;
    }
    requeue(S, dr, `Payload transferred at Energy Hub after ${dr.id} low-battery divert`, { name: 'Energy Hub transfer', lat: S.hub.lat, lng: S.hub.lng });
    log(S, 'alert', `${dr.id} battery ${Math.round(dr.battery)}% insufficient for ${o.id} — diverting, payload re-dispatched from hub`, dr.id);
  } else if (o) {
    requeue(S, dr, `Re-dispatched: ${dr.id} low battery`);
    log(S, 'warn', `${o.id} re-dispatched — ${dr.id} low battery`, o.id);
  }
  sendToHub(S, dr, 'low battery in flight');
}

function stepDrone(S, dr, dt) {
  if (dr.status === 'fault') {
    dr.alt = Math.max(0, dr.alt - 3 * dt);
    if (!dr.alt) { dr.status = 'grounded'; dr.until = S.t + 240; log(S, 'alert', `${dr.id} landed safely — ground recovery team en route`, dr.id); }
    return;
  }
  if (dr.status === 'grounded' && S.t > dr.until) {
    const p = S.pods.find(p => p.id === dr.home);
    Object.assign(dr, { lat: p.lat, lng: p.lng, podId: p.id, status: 'maintenance', until: S.t + 300, trail: [] });
    log(S, 'info', `${dr.id} recovered to ${p.id} ${p.name} — diagnostics & maintenance`, dr.id);
    return;
  }
  if (dr.status === 'maintenance' && S.t > dr.until) { Object.assign(dr, { status: 'idle', battery: 100, health: dr.health - 2 }); log(S, 'ok', `${dr.id} passed diagnostics — back in service`, dr.id); return; }
  if (['grounded', 'maintenance'].includes(dr.status)) return;
  if (S.t > dr.boostUntil) dr.boost = 0;
  if (S.t > dr.capUntil) dr.cap = 0;

  if (dr.status === 'idle' && !S.weather.storm && dr.battery < (dr.hubCost ??= hubCost(S, dr)) + CFG.idleMargin) return sendToHub(S, dr, 'proactive swap at pod');
  const leg = dr.legs[0];
  if (!leg) return;
  if (airborne(dr) && dr.battery < 25 && !dr.lowHandled && dr.status !== 'to-hub') return lowBattery(S, dr);
  if (leg.kind === 'fly') fly(S, dr, leg, dt);
  else if (leg.kind === 'winch') {
    dr.alt += Math.sign(CFG.winchAlt - dr.alt) * Math.min(Math.abs(CFG.winchAlt - dr.alt), CFG.climb * dt);
    dr.battery -= CFG.hoverDrain * dt;
    if ((leg.left -= dt) <= 0) { winchDone(S, dr, leg); nextLeg(S, dr); }
  } else if (leg.kind === 'swap') swapStep(S, dr, leg, dt);
  if (dr.battery <= 0) { dr.battery = 0; S.stats.depleted++; injectFault(S, dr.id, 'battery depleted'); }
}

// ---------- airspace ----------
function separation(S) {
  // ponytail: pods/hub sequence their own launches, so only en-route drones outside terminal areas are deconflicted
  const terminal = d => dist(d, S.hub) < 450 || S.pods.some(p => dist(p, d) < 350);
  const air = S.drones.filter(d => airborne(d) && d.alt > 45 && d.status !== 'fault' && !terminal(d));
  for (let i = 0; i < air.length; i++) for (let j = i + 1; j < air.length; j++) {
    const a = air[i], b = air[j];
    if (Math.abs(a.alt - b.alt) >= CFG.sepV) continue;
    const d = dist(a, b);
    if (d >= CFG.sepH) continue;
    const key = a.id + b.id;
    if (S.t - (S.pairs[key] ?? -1e9) < 40) continue;
    S.pairs[key] = S.t;
    const pri = x => (orderOf(S, x)?.priority ? 2 : 0) + (x.status === 'to-drop' ? 1 : 0);
    const [y, other] = pri(a) >= pri(b) ? [b, a] : [a, b];
    Object.assign(y, { boost: 25, boostUntil: S.t + 20 });
    S.stats.sep++;
    log(S, 'info', `Separation assured: ${y.id} climbed +25 m (${other.id} at ${Math.round(d)} m)`, y.id);
  }
}

function stepTraffic(S, a, dt) {
  if (a.type === 'heli') {
    const tgt = HELI[a.wp], d = dist(a, tgt), step = 45 * dt;
    a.heading = bearing(a, tgt);
    if (d <= step) { a.wp = (a.wp + 1) % HELI.length; } else { a.lat += (tgt.lat - a.lat) * step / d; a.lng += (tgt.lng - a.lng) * step / d; }
    for (const dr of S.drones) {
      if (!airborne(dr) || dr.cap || S.t < dr.capUntil + 30 || dist(dr, a) > 1300) continue;
      Object.assign(dr, { cap: 60, capUntil: S.t + 35 });
      S.stats.ta++;
      log(S, 'warn', `Traffic advisory: helicopter ${a.id} at ${a.alt} m, ${km(dist(dr, a))} km from ${dr.id} → descending to 60 m`, dr.id);
    }
    return;
  }
  const [ux, uy] = RWY.u;
  if (a.mode === 'arr') { a.s -= 75 * dt; if (a.s < -2600) a.s = 26000 + S.R() * 12000; }
  else { a.s += 80 * dt; if (a.s > 26000) a.s = -S.R() * 20000; }
  const s = a.mode === 'arr' ? -a.s : Math.max(0, a.s);
  Object.assign(a, ll([xy(RWY)[0] + ux * s, xy(RWY)[1] + uy * s]));
  a.alt = Math.round(a.mode === 'arr' ? Math.max(0, a.s * 0.0524) : Math.max(0, (a.s - 2200) * 0.09));
  a.heading = 120;
  a.hidden = a.mode === 'dep' && a.s < 0;
}

// ---------- scenario controls ----------
function setStorm(S, on) {
  S.weather.storm = on;
  Object.assign(S.weather, on ? { vis: 1.2, wind: 32, dir: 'NW' } : { vis: 9, wind: 12 });
  if (!on) { log(S, 'ok', 'Weather clear — operations resumed, dispatching held orders'); return; }
  log(S, 'alert', 'Sandstorm alert: visibility 1.2 km, wind 32 kt — operations suspended, all drones returning to nearest pod');
  for (const dr of S.drones) {
    if (!AIRBORNE.has(dr.status) || ['to-hub', 'fault'].includes(dr.status)) continue;
    const p = nearestPod(S, dr), o = orderOf(S, dr);
    requeue(S, dr, 'Held — weather suspension', o?.status === 'picked' ? { name: `${p.id} ${p.name} (weather hold)`, lat: p.lat, lng: p.lng } : null);
    goPod(S, dr, p, 'rtb');
  }
}
function replanAll(S) {
  let n = 0;
  for (const dr of S.drones) {
    const leg = dr.legs[0];
    dr.legs.forEach((l, i) => { if (i && l.kind === 'fly') l.path = null; });
    if (leg?.kind !== 'fly') continue;
    const before = pathLen(dr, dr.path);
    dr.path = planRoute(S, dr, leg.to);
    if (Math.abs(pathLen(dr, dr.path) - before) > 30) n++;
  }
  for (const o of S.orders) {
    const z = o.status === 'queued' && S.zones.find(z => z.active && inside(o.drop, z));
    if (z) { Object.assign(o, { status: 'fallback', note: `Drop-off inside ${z.name} — handed to ground courier` }); S.stats.fallback++; }
  }
  S.stats.reroutes += n;
  log(S, 'info', `${n} in-flight route${n === 1 ? '' : 's'} re-planned around updated airspace`);
}
function addZone(S, lat, lng, r = 1200, name) {
  const z = { id: `TFR-${++S.tfrSeq}`, name: name || `Temporary Flight Restriction ${S.tfrSeq}`, lat, lng, r, kind: 'tfr', active: true };
  S.zones.push(z);
  log(S, 'alert', `${z.id} declared — ${km(r)} km radius, effective immediately`);
  replanAll(S);
  return z;
}
function toggleZone(S, id) {
  const z = S.zones.find(z => z.id === id);
  z.active = !z.active;
  log(S, z.active ? 'alert' : 'info', `${z.id} ${z.name} ${z.active ? 'activated' : 'released'}`);
  replanAll(S);
}
function injectFault(S, id, why = 'motor 3 anomaly') {
  const pool = S.drones.filter(d => airborne(d) && d.status !== 'fault' && (!id || d.id === id));
  const dr = id ? pool[0] : pool[Math.floor(S.R() * pool.length)];
  if (!dr) return null;
  const o = orderOf(S, dr), p = nearestPod(S, dr);
  if (o) requeue(S, dr, `Re-dispatched after ${dr.id} fault`, o.status === 'picked' ? { name: `${p.id} ${p.name} (recovered payload)`, lat: p.lat, lng: p.lng } : null);
  Object.assign(dr, { status: 'fault', legs: [], path: [] });
  S.stats.faults++;
  log(S, 'alert', `${dr.id} ${why} — controlled emergency landing${o ? `, ${o.id} re-dispatched automatically` : ''}`, dr.id);
  return dr;
}
function drainBattery(S, id) {
  const dr = S.drones.find(d => d.id === id);
  if (!dr) return;
  dr.battery = Math.min(dr.battery, 22); dr.lowHandled = false;
  log(S, 'warn', `${dr.id} battery telemetry: ${dr.battery}% (simulated cell degradation)`, dr.id);
  if (dr.status === 'idle') sendToHub(S, dr, 'critical at pod');
}
function recallToHub(S, id) {
  const dr = S.drones.find(d => d.id === id);
  if (!dr || ['to-hub', 'queued-swap', 'swapping', 'fault', 'grounded'].includes(dr.status)) return;
  if (orderOf(S, dr)) requeue(S, dr, `Re-dispatched: ${dr.id} recalled by operator`);
  sendToHub(S, dr, 'operator recall');
}
function rush(S) {
  S.rushUntil = S.t + 900;
  for (let i = 0; i < 8; i++) addOrder(S);
  log(S, 'info', 'Demand surge: order rate ×3 for 15 min — dispatch scaling across pods');
}

// ---------- main loop ----------
function tick(S, dt) {
  while (dt > 0) { const h = Math.min(dt, 0.5); step(S, h); dt -= h; }
}
function step(S, dt) {
  S.t += dt;
  if ((S.nextOrder -= dt) <= 0) { addOrder(S); S.nextOrder = (S.t < S.rushUntil ? CFG.orderEvery / 3 : CFG.orderEvery) * (0.4 + S.R() * 1.2); }
  const H = S.hub;
  H.charging = H.charging.filter(t => t > S.t || (H.charged++, false));
  for (const dr of S.drones) {
    stepDrone(S, dr, dt);
    if (airborne(dr) && S.t - dr.lastTrail >= 3) { dr.trail.push({ lng: dr.lng, lat: dr.lat, alt: dr.alt, t: S.t }); dr.lastTrail = S.t; if (dr.trail.length > 90) dr.trail.shift(); }
    else if (!airborne(dr) && dr.trail.length && S.t - dr.lastTrail > 300) dr.trail = [];
  }
  S.traffic.forEach(a => stepTraffic(S, a, dt));
  if ((S.acc += dt) >= 1) {
    S.acc = 0;
    dispatch(S); separation(S);
    const w = S.weather;
    if (!w.storm) { w.wind = Math.max(6, Math.min(20, w.wind + (S.R() - 0.5) * 0.6)); w.temp = 38 + Math.round(Math.sin(S.t / 5000) * 2); }
    S.flashes = S.flashes.filter(f => S.t - f.t < 30);
  }
}

const api = {
  CFG, PODS, HUB, MERCHANTS, PLACES, CATS, RWY, HELI,
  create, tick, addOrder, dispatch, planRoute, pathLen, dist, bearing, inside, airborne, hourOf,
  setStorm, addZone, toggleZone, injectFault, drainBattery, recallToHub, rush, nearestPod, orderOf,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
