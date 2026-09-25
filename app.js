/* Drone Logistics OS — command center UI: 3D map, fleet & ops panels, admin pages, customer app */
'use strict';
const $ = s => document.querySelector(s);
const ALT_X = 2.2;   // ponytail: visual altitude exaggeration so the 90/120 m flight layers read at city zoom
const WARM = 1500;   // sim seconds pre-run so the network is already busy on load
let HOME = { center: [55.262, 25.150], zoom: 10.95, pitch: 48, bearing: -24 };
const MX = 111320 * Math.cos(25.15 * Math.PI / 180), MY = 110574;

const STATUS = {
  idle: ['On pad', '#8ea3b8'], 'to-pickup': ['To pickup', '#3ad6f0'], loading: ['Loading · winch', '#3ad6f0'],
  'to-drop': ['Delivering', '#3ee08f'], dropping: ['Lowering parcel', '#3ee08f'], returning: ['Returning', '#7c95ff'],
  rebalancing: ['Rebalancing', '#7c95ff'], rtb: ['Weather RTB', '#ffb547'], 'to-hub': ['To energy hub', '#ffb547'],
  'queued-swap': ['Swap queue', '#b394ff'], swapping: ['Battery swap', '#b394ff'], fault: ['Emergency landing', '#ff5d62'],
  grounded: ['Grounded', '#ff5d62'], maintenance: ['Maintenance', '#ffb547'],
};
const ORDER_ST = { queued: ['Queued', '#ffb547'], assigned: ['Drone assigned', '#3ad6f0'], picked: ['In flight', '#3ee08f'], delivered: ['Delivered', '#8ea3b8'], fallback: ['Ground courier', '#ff5d62'] };
const CAT_COL = { Pharmacy: '#3ad6f0', Food: '#ffb547', Grocery: '#3ee08f', Documents: '#b394ff', Parcel: '#7c95ff', Medical: '#ff5d62' };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const RGB = Object.fromEntries(Object.entries(STATUS).map(([k, [, c]]) => [k, hex(c)]));
// ---------- theme ----------
// ponytail: hues are authored for dark; light mode swaps each for a darker twin that reads on white
const LIGHT_HUE = { '#8ea3b8': '#64748b', '#3ad6f0': '#0891b2', '#3ee08f': '#16a34a', '#7c95ff': '#4f63d8', '#ffb547': '#c27803', '#b394ff': '#7c5cdb', '#ff5d62': '#dc3d43', '#2dd4bf': '#0f9488', '#d9b26a': '#9c7427' };
const DARK_HUE = Object.fromEntries(Object.entries(LIGHT_HUE).map(([d, l]) => [l, d]));
let theme = 'dark';
try { theme = localStorage.getItem('dlos-theme') === 'light' ? 'light' : 'dark'; } catch { /* storage blocked: stay dark */ }
const tc = h => theme === 'light' ? (LIGHT_HUE[h] || h) : h;
function recolor() {
  const m = theme === 'light' ? LIGHT_HUE : DARK_HUE;
  for (const v of [...Object.values(STATUS), ...Object.values(ORDER_ST)]) v[1] = m[v[1]] || v[1];
  for (const k in CAT_COL) CAT_COL[k] = m[CAT_COL[k]] || CAT_COL[k];
  for (const k in STATUS) RGB[k] = hex(STATUS[k][1]);
}
const PAL = {
  dark: { glide: [226, 236, 248, 50], pod: [45, 212, 191], hub: [217, 178, 106], queued: [255, 181, 71], pick: [58, 214, 240], drop: [62, 224, 143], edge: [5, 8, 13, 255], shadow: [0, 0, 0, 150], sel: [255, 255, 255],
    plane: [236, 242, 250, 245], planeTxt: [205, 218, 232, 230], labelBg: [5, 8, 13, 200], nfzTxt: [255, 140, 145, 225], tfrTxt: [255, 190, 110, 235], podTxt: [190, 245, 236, 240], hubTxt: [240, 207, 143, 255],
    tip: { background: 'rgba(8,13,21,.96)', color: '#e3ebf5', border: '1px solid rgba(148,178,212,.25)' } },
  light: { glide: [30, 45, 70, 80], pod: [13, 148, 136], hub: [176, 132, 48], queued: [194, 120, 3], pick: [8, 145, 178], drop: [22, 163, 74], edge: [255, 255, 255, 255], shadow: [15, 30, 55, 55], sel: [17, 26, 38],
    plane: [30, 41, 59, 240], planeTxt: [30, 41, 59, 235], labelBg: [255, 255, 255, 230], nfzTxt: [200, 40, 50, 235], tfrTxt: [170, 90, 10, 240], podTxt: [12, 90, 82, 255], hubTxt: [120, 88, 24, 255],
    tip: { background: 'rgba(255,255,255,.97)', color: '#111a26', border: '1px solid rgba(15,30,55,.18)', boxShadow: '0 6px 18px rgba(15,30,55,.15)' } },
};
const STYLE = { dark: 'https://tiles.openfreemap.org/styles/dark', light: 'https://tiles.openfreemap.org/styles/positron' };
document.documentElement.dataset.theme = theme;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const IC = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>', pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  plus: '<path d="M5 12h14M12 5v14"/>', zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  film: '<path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  locate: '<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  bolt: '<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2"/><path d="m11 9-2 3h3l-2 3"/>',
  low: '<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2M6 11v2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${IC[n]}</svg>`;

// ---------- deck icons ----------
const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const armPts = [30, 90, 150, 210, 270, 330].map(a => [64 + 46 * Math.sin(a * Math.PI / 180), 64 - 46 * Math.cos(a * Math.PI / 180)]);
const DRONE_ICON = { id: 'drone', width: 128, height: 128, mask: true, url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="#fff" stroke-width="8" stroke-linecap="round">${armPts.map(([x, y]) => `<line x1="64" y1="64" x2="${x}" y2="${y}"/>`).join('')}</g><g fill="#fff">${armPts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill-opacity=".5"/>`).join('')}<circle cx="64" cy="64" r="18"/><path d="M64 20 L74 38 L54 38 Z"/></g></svg>`) };
const JET_ICON = { id: 'jet', width: 96, height: 96, mask: true, url: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><path fill="#fff" d="M12 2c.8 0 1.3.9 1.3 2v5.2l7.7 4.6v2l-7.7-2.4v4.3l2.2 1.7v1.6L12 20.2 8.5 21v-1.6l2.2-1.7v-4.3L3 15.8v-2l7.7-4.6V4c0-1.1.5-2 1.3-2z"/></svg>') };
const HELI_ICON = { id: 'heli', width: 96, height: 96, mask: true, url: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><g fill="#fff"><ellipse cx="12" cy="10" rx="3.2" ry="4.5"/><rect x="11.3" y="13" width="1.4" height="8" rx=".7"/><rect x="9" y="20" width="6" height="1.4" rx=".7"/></g><g stroke="#fff" stroke-width="1.3" stroke-linecap="round"><line x1="3" y1="3" x2="21" y2="17"/><line x1="21" y1="3" x2="3" y2="17"/></g></svg>') };

// ---------- simulation bootstrap ----------
const S = Sim.create({ seed: 7, clock0: Date.now() - WARM * 1000 });
for (let i = 0; i < WARM; i++) Sim.tick(S, 1);
S.flashes = [];
// ponytail: synthetic history for the earlier hours of today so the day-level KPIs/charts read realistically; everything after load is live simulation
const NOW_H = Sim.hourOf(S);
const HIST = {}, HIST_T = {};
for (let h = 6; h < NOW_H; h++) { HIST[h] = Math.round(46 + 32 * Math.sin((h - 6) / 17 * Math.PI) + (h * 7919 % 9)); HIST_T[h] = 9 + (h * 31 % 5) * 0.6; }
const HIST_TOTAL = Object.values(HIST).reduce((a, b) => a + b, 0);
const CAT_SHARE = { Pharmacy: .22, Food: .31, Grocery: .17, Documents: .07, Parcel: .15, Medical: .08 };

const ui = { speed: 10, paused: false, sel: null, follow: false, tab: 'command', cine: false, pick: null, fleetF: 'all', logF: 'all', ordF: 'all', lastEv: S.seq, charts: null,
  phone: { open: false, step: 'form', built: false, cat: 'Pharmacy', merchant: 0, drop: 3, pin: null, kg: 0.6, order: null } };

const pod = id => S.pods.find(p => p.id === id);
const drone = id => S.drones.find(d => d.id === id);
const countBy = (arr, f) => arr.reduce((m, x) => (m[f(x)] = (m[f(x)] || 0) + 1, m), {});
const clockStr = (t, opt = {}) => new Date(S.clock0 + t * 1000).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dubai', ...opt });
const blocked = p => S.zones.some(z => z.active && Sim.inside(p, z));
const batCol = b => tc(b > 50 ? '#3ee08f' : b > 25 ? '#ffb547' : '#ff5d62');
const batHtml = b => `<span class="bat"><span class="bar"><i style="width:${Math.max(3, b)}%;background:${batCol(b)}"></i></span>${Math.round(b)}%</span>`;
const pill = ([lab, c]) => `<span class="pill" style="background:${c}22;color:${c}">${lab}</span>`;
const mmss = s => `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, '0')}s`;
const linkify = s => s.replace(/\b(DRN-\d+|ORD-\d+)\b/g, '<span class="ref" data-ref="$1">$1</span>');
function whereOf(d) {
  const leg = d.legs[0];
  if (d.podId) return pod(d.podId).name;
  if (leg?.land?.type === 'pod') return `→ ${pod(leg.land.id).name}`;
  if (['to-hub', 'queued-swap', 'swapping'].includes(d.status)) return 'Energy Hub';
  if (d.order) return `${d.order} → ${leg?.to?.name || ''}`;
  return d.status === 'fault' || d.status === 'grounded' ? 'Safe landing zone' : '';
}
function speedOf(d) {
  const leg = d.legs[0];
  if (!Sim.airborne(d) || leg?.kind !== 'fly' || !d.path.length) return 0;
  return Math.round(d.speed * 3.6 * (d.alt < 25 ? 0.25 : 1) * (S.weather.storm ? 0.8 : 1));
}

// ---------- map ----------
recolor();
const map = new maplibregl.Map({ container: 'map', style: STYLE[theme], ...HOME, maxPitch: 75, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
// fit the whole network (Marina → Al Warqa) to whatever map width the screen leaves
const fitHome = () => { const c = map.cameraForBounds([[55.13, 25.09], [55.42, 25.29]], { padding: 20, bearing: -24 }); if (c) HOME = { center: c.center, zoom: c.zoom + 0.1, pitch: 48, bearing: -24 }; };
fitHome(); map.jumpTo(HOME);
map.on('styleimagemissing', e => map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) }));
map.on('style.load', () => {
  const set = (id, prop, v) => map.getLayer(id) && map.setPaintProperty(id, prop, v);
  const light = theme === 'light';
  if (!light) {
  set('background', 'background-color', '#070b12');
  set('water', 'fill-color', '#0a1724'); set('waterway', 'line-color', '#0a1724');
  set('landuse_residential', 'fill-color', '#0a0f17');
  set('landcover_wood', 'fill-color', '#0a1410'); set('landuse_park', 'fill-color', '#0a1410');
  set('building', 'fill-color', '#0d1520'); set('building', 'fill-outline-color', '#152131');
  set('highway_minor', 'line-color', '#111a26'); set('highway_major_inner', 'line-color', '#15202e'); set('highway_major_subtle', 'line-color', '#182433');
  set('highway_motorway_inner', 'line-color', '#233750'); set('highway_motorway_subtle', 'line-color', '#1b2a3c');
  set('aeroway-runway', 'line-color', '#1c2838'); set('aeroway-area', 'fill-color', '#0b111a');
  ['place_other', 'place_suburb', 'place_village', 'place_town', 'place_city', 'place_city_large'].forEach(id => { set(id, 'text-color', '#62768c'); set(id, 'text-halo-color', '#05080d'); });
  }
  map.addLayer({
    id: 'bld3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 5], ...(light ? [0, '#e2e7ee', 40, '#d4dce6', 150, '#c1cddb', 350, '#a9bacd'] : [0, '#172438', 40, '#1f3350', 150, '#2b4a72', 350, '#3f6d9c'])],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.8, ['coalesce', ['get', 'render_height'], 5]],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.95,
    },
  }, ['highway_name_other', 'highway-name-path'].find(id => map.getLayer(id)));
  map.setLight({ anchor: 'viewport', color: light ? '#ffffff' : '#d6e6ff', intensity: light ? 0.3 : 0.4, position: [1.4, 200, 35] });
});

const ring = z => z._ring ||= Array.from({ length: 65 }, (_, i) => { const a = i / 64 * 2 * Math.PI; return [z.lng + z.r * Math.sin(a) / MX, z.lat + z.r * Math.cos(a) / MY]; });
const [UX, UY] = Sim.RWY.u;
const GLIDE = [Array.from({ length: 29 }, (_, i) => [Sim.RWY.lng - UX * i * 1000 / MX, Sim.RWY.lat - UY * i * 1000 / MY, i * 1000 * 0.0524]),
  Array.from({ length: 27 }, (_, i) => [Sim.RWY.lng + UX * i * 1000 / MX, Sim.RWY.lat + UY * i * 1000 / MY, Math.max(0, (i * 1000 - 2200) * 0.09)])];

function dispPos(d) { // drones on pads/hub apron sit on a ring of pads around the site
  const atHub = !d.podId && ['queued-swap', 'swapping'].includes(d.status);
  if (d.alt < 0.5 && (d.podId || atHub)) {
    const base = d.podId ? pod(d.podId) : S.hub;
    const group = S.drones.filter(x => x.alt < 0.5 && (d.podId ? x.podId === d.podId : !x.podId && ['queued-swap', 'swapping'].includes(x.status)));
    const a = (group.indexOf(d) * 60 + 30) * Math.PI / 180, r = d.podId ? 250 : 400;
    return [base.lng + r * Math.sin(a) / MX, base.lat + r * Math.cos(a) / MY, 0];
  }
  return [d.lng, d.lat, d.alt * ALT_X];
}

function tooltip({ object, layer }) {
  if (!object || !layer) return null;
  let h = '';
  if (layer.id === 'drones') h = `<b>${object.id}</b> · ${object.model}<br>${STATUS[object.status][0]} · ${Math.round(object.battery)}% · ${Math.round(object.alt)} m`;
  else if (layer.id === 'pods') h = `<b>${object.id} ${object.name}</b><br>${S.drones.filter(d => d.podId === object.id).length} on pads · ${object.served} delivered${blocked(object) ? '<br><span style="color:#ff5d62">Suspended — inside TFR</span>' : ''}`;
  else if (layer.id === 'hub') h = `<b>${S.hub.name}</b><br>${S.hub.charged} charged packs · ${S.hub.bays.filter(Boolean).length}/4 bays busy`;
  else if (layer.id === 'nfz') h = `<b>${object.name}</b><br>${object.kind === 'tfr' ? 'Temporary restriction' : 'No-fly zone'} · r ${(object.r / 1000).toFixed(1)} km`;
  else if (layer.id === 'traffic') h = `<b>${object.id}</b> · ${object.type === 'heli' ? 'Helicopter' : 'Airliner'} (ADS-B)<br>${object.alt} m · hdg ${Math.round(object.heading)}°`;
  else return null;
  return { html: h, style: { ...PAL[theme].tip, borderRadius: '8px', font: '12px Manrope', padding: '7px 10px' } };
}
const overlay = new deck.MapboxOverlay({ interleaved: false, layers: [], getTooltip: tooltip });
map.addControl(overlay);

function buildLayers(now) {
  const t = S.t, sel = ui.sel, selD = sel && drone(sel), pulse = (now % 2.4) / 2.4;
  const zones = S.zones.filter(z => z.active), air = S.drones.filter(d => d.alt > 0.5);
  const active = S.orders.filter(o => ['queued', 'assigned', 'picked'].includes(o.status));
  const col = d => RGB[d.status], sites = [...S.pods, S.hub], P = PAL[theme];
  const fade = f => Math.max(0, 255 * (1 - (t - f.t) / 30));
  return [
    new deck.PathLayer({ id: 'glide', data: GLIDE, getPath: p => p, getColor: P.glide, getWidth: 1.5, widthUnits: 'pixels' }),
    new deck.PolygonLayer({ id: 'nfz', data: zones, pickable: true, getPolygon: ring, extruded: true, wireframe: true, getElevation: z => z.kind === 'airport' ? 520 : 330,
      getFillColor: z => z.kind === 'tfr' ? [255, 160, 60, 38] : [255, 70, 85, 26], getLineColor: z => z.kind === 'tfr' ? [255, 176, 80, 210] : [255, 93, 98, 140], lineWidthMinPixels: 1 }),
    new deck.ColumnLayer({ id: 'pods', data: S.pods, pickable: true, diskResolution: 6, radius: 150, angle: 30, getPosition: p => [p.lng, p.lat], getElevation: 60,
      getFillColor: p => blocked(p) ? [255, 93, 98, 220] : [...P.pod, 220], updateTriggers: { getFillColor: [zones.length, theme] } }),
    new deck.ColumnLayer({ id: 'hub', data: [S.hub], pickable: true, diskResolution: 6, radius: 240, angle: 30, getPosition: p => [p.lng, p.lat], getElevation: 110, getFillColor: [...P.hub, 235], updateTriggers: { getFillColor: theme } }),
    new deck.ScatterplotLayer({ id: 'pulse', data: sites, getPosition: p => [p.lng, p.lat], getRadius: p => (p === S.hub ? 380 : 240) + pulse * (p === S.hub ? 900 : 520), stroked: true, filled: false,
      getLineColor: p => [...(p === S.hub ? P.hub : P.pod), 190 * (1 - pulse)], lineWidthMinPixels: 1.5, updateTriggers: { getRadius: pulse, getLineColor: pulse } }),
    new deck.ScatterplotLayer({ id: 'drops', data: active, getPosition: o => [o.drop.lng, o.drop.lat], getRadius: 120, radiusMinPixels: 5, stroked: true, getFillColor: [...P.drop, 40], getLineColor: [...P.drop, 220], lineWidthMinPixels: 1.5 }),
    new deck.ScatterplotLayer({ id: 'pickups', data: active.filter(o => o.status !== 'picked'), getPosition: o => [o.pickup.lng, o.pickup.lat], getRadius: 80, radiusMinPixels: 3.5,
      getFillColor: o => o.status === 'queued' ? [...P.queued, 240] : [...P.pick, 230], stroked: true, getLineColor: P.edge, lineWidthMinPixels: 1 }),
    new deck.ScatterplotLayer({ id: 'flash', data: S.flashes.filter(f => f.kind === 'drop'), getPosition: f => [f.at.lng, f.at.lat], getRadius: f => 120 + (t - f.t) * 30, stroked: true, filled: false,
      getLineColor: f => [...P.drop, fade(f)], lineWidthMinPixels: 2 }),
    new deck.ArcLayer({ id: 'arcs', data: S.flashes.filter(f => f.kind === 'arc').flatMap(f => [{ a: f.from, b: f.to, f }, { a: f.to, b: f.to2, f }]),
      getSourcePosition: d => [d.a.lng, d.a.lat], getTargetPosition: d => [d.b.lng, d.b.lat], getSourceColor: d => [...P.hub, fade(d.f)], getTargetColor: d => [...P.pick, fade(d.f)], getWidth: 2.5, getHeight: 0.45 }),
    new deck.PathLayer({ id: 'routes', data: air.filter(d => d.legs[0]?.kind === 'fly' && d.path.length), widthUnits: 'pixels',
      getPath: d => [[d.lng, d.lat], ...d.path.map(p => [p.lng, p.lat]), ...(d.id === sel ? d.legs.slice(1).filter(l => l.kind === 'fly').map(l => [l.to.lng, l.to.lat]) : [])],
      getColor: d => [...col(d), d.id === sel ? 235 : 60], getWidth: d => d.id === sel ? 3 : 1.2 }),
    new deck.TripsLayer({ id: 'trails', data: S.drones.filter(d => d.trail.length > 1 && Sim.airborne(d)), currentTime: t, trailLength: 240, fadeTrail: true, widthMinPixels: 2.5, capRounded: true, jointRounded: true,
      getPath: d => [...d.trail.map(p => [p.lng, p.lat, p.alt * ALT_X]), [d.lng, d.lat, d.alt * ALT_X]], getTimestamps: d => [...d.trail.map(p => p.t), t], getColor: col }),
    new deck.LineLayer({ id: 'tethers', data: air, getSourcePosition: d => [d.lng, d.lat, 0], getTargetPosition: d => [d.lng, d.lat, d.alt * ALT_X], getColor: d => [...col(d), 70], getWidth: 1 }),
    new deck.ScatterplotLayer({ id: 'shadows', data: air, getPosition: d => [d.lng, d.lat], getRadius: 40, radiusMinPixels: 2, getFillColor: P.shadow }),
    selD && new deck.ScatterplotLayer({ id: 'selring', data: [selD], getPosition: dispPos, getRadius: 160 + 110 * pulse, stroked: true, filled: false, getLineColor: [...P.sel, 230 * (1 - pulse)], lineWidthMinPixels: 2 }),
    new deck.IconLayer({ id: 'drones', data: S.drones, pickable: true, getIcon: () => DRONE_ICON, getPosition: dispPos, getAngle: d => -d.heading, getColor: col,
      getSize: d => d.id === sel ? 240 : 170, sizeUnits: 'meters', sizeMinPixels: 14, sizeMaxPixels: 46, billboard: false,
      updateTriggers: { getPosition: t, getAngle: t, getColor: t, getSize: sel }, onClick: ({ object }) => object && select(object.id) }),
    new deck.IconLayer({ id: 'traffic', data: S.traffic.filter(a => !a.hidden), pickable: true, getIcon: a => a.type === 'heli' ? HELI_ICON : JET_ICON, getPosition: a => [a.lng, a.lat, a.alt],
      getAngle: a => -a.heading, getSize: a => a.type === 'heli' ? 28 : 40, sizeUnits: 'pixels', billboard: false, getColor: P.plane, updateTriggers: { getColor: theme } }),
    new deck.TextLayer({ id: 'traffic-lbl', data: S.traffic.filter(a => !a.hidden), getPosition: a => [a.lng, a.lat, a.alt], getText: a => `${a.id} · ${a.alt} m`, characterSet: 'auto', getSize: 10.5,
      getColor: P.planeTxt, getPixelOffset: [0, -26], fontFamily: 'JetBrains Mono', fontWeight: 600, background: true, getBackgroundColor: P.labelBg, backgroundPadding: [4, 2] }),
    new deck.TextLayer({ id: 'nfz-lbl', data: zones, getPosition: z => [z.lng, z.lat, z.kind === 'airport' ? 540 : 350], characterSet: 'auto', getSize: 10, fontFamily: 'Manrope', fontWeight: 800,
      getText: z => `${z.kind === 'tfr' ? 'TFR' : 'NO-FLY'} · ${z.name.toUpperCase()}`, getColor: z => z.kind === 'tfr' ? P.tfrTxt : P.nfzTxt, updateTriggers: { getColor: theme } }),
    new deck.TextLayer({ id: 'site-lbl', data: sites, getPosition: p => [p.lng, p.lat, p === S.hub ? 250 : 140], characterSet: 'auto', getSize: 11, fontFamily: 'Manrope', fontWeight: 800,
      getText: p => p === S.hub ? 'EH-01 ENERGY HUB' : `${p.id} ${p.name.toUpperCase()}`, getColor: p => p === S.hub ? P.hubTxt : P.podTxt, updateTriggers: { getColor: theme, getBackgroundColor: theme },
      getPixelOffset: [0, -12], background: true, getBackgroundColor: P.labelBg, backgroundPadding: [6, 3] }),
  ];
}

// ---------- header, KPIs, panels ----------
function renderHeader() {
  $('#clock').textContent = clockStr(S.t) + ' GST';
  const w = S.weather;
  $('#wx').innerHTML = `${ic(w.storm ? 'wind' : 'sun')} ${w.temp}°C · Wind ${Math.round(w.wind)} kt ${w.dir} · Vis ${w.vis} km`;
  const tfr = S.zones.some(z => z.kind === 'tfr' && z.active);
  const [cls, txt] = w.storm ? ['bad', 'Weather hold · ops suspended'] : tfr ? ['warn', 'Operational · TFR active'] : ['ok', 'Operations normal'];
  $('#ops').className = 'ops ' + cls; $('#ops span').textContent = txt;
  $('#storm').classList.toggle('on', w.storm);
  $('#b-storm').innerHTML = `${ic('wind')} ${w.storm ? 'Clear weather' : 'Sandstorm'}`;
}

function renderKpis() {
  const c = countBy(S.drones, d => d.status), st = S.stats, live = st.delivered;
  const air = S.drones.filter(Sim.airborne).length;
  const energy = (c['to-hub'] || 0) + (c['queued-swap'] || 0) + (c.swapping || 0);
  const inProg = S.orders.filter(o => o.status === 'assigned' || o.status === 'picked').length;
  const queued = S.orders.filter(o => o.status === 'queued').length;
  const k = [
    ['Airborne', air, `/ ${S.drones.length}`, tc('#3ad6f0')], ['On pads', c.idle || 0, 'ready', tc('#8ea3b8')], ['Energy cycle', energy, 'to hub / swapping', tc('#b394ff')],
    ['Delivered today', HIST_TOTAL + live, ''], ['In progress', inProg, `${queued} queued`],
    ['Avg delivery', live ? (st.totalMin / live).toFixed(1) : '—', 'min'], ['On-time ≤ 30 min', live ? Math.round(100 * st.onTime / live) + '%' : '—', ''],
    ['Airspace events', st.sep + st.ta + st.reroutes, 'auto-resolved'], ['CO₂ avoided', Math.round((HIST_TOTAL + live) * 1.4), 'kg vs van'],
  ];
  $('#kpis').innerHTML = k.map(([l, v, s, dot]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${dot ? `<span class="dot" style="background:${dot};box-shadow:0 0 8px ${dot}"></span>` : ''}${v}<small>${s}</small></div></div>`).join('');
}

const FF = { all: () => true, air: d => Sim.airborne(d), pad: d => d.status === 'idle', energy: d => ['to-hub', 'queued-swap', 'swapping'].includes(d.status), alert: d => ['fault', 'grounded', 'maintenance', 'rtb'].includes(d.status) || d.battery < 30 };
function renderFleet() {
  $('#fleet-count').textContent = `${S.drones.length} drones`;
  $('#fleet-filter').innerHTML = [['all', 'All'], ['air', 'Airborne'], ['pad', 'On pad'], ['energy', 'Energy'], ['alert', 'Alerts']]
    .map(([k, l]) => `<button class="chip ${ui.fleetF === k ? 'on' : ''}" data-ff="${k}">${l}<b>${S.drones.filter(FF[k]).length}</b></button>`).join('');
  $('#fleet-list').innerHTML = S.drones.filter(FF[ui.fleetF]).map(d => {
    const [lab, c] = STATUS[d.status];
    return `<div class="row ${ui.sel === d.id ? 'sel' : ''}" data-id="${d.id}"><span class="sdot" style="background:${c};box-shadow:0 0 6px ${c}"></span><div style="min-width:0"><div class="id">${d.id} <span class="dim" style="font:500 10.5px Manrope">${d.model}</span></div><div class="sub">${lab} · ${esc(whereOf(d))}</div></div>${batHtml(d.battery)}</div>`;
  }).join('');
}

function renderDecision() {
  const D = S.lastDecision;
  const q = S.orders.filter(o => o.status === 'queued').length, fl = S.orders.filter(o => ['assigned', 'picked'].includes(o.status)).length;
  $('#qstats').innerHTML = `<div><div class="l">Queued</div><div class="v" style="color:${q > 4 ? 'var(--amber)' : 'inherit'}">${q}</div></div><div><div class="l">In flight</div><div class="v">${fl}</div></div><div><div class="l">Swaps today</div><div class="v">${S.hub.swaps}</div></div>`;
  if (!D) { $('#decision').innerHTML = '<div class="hd"><span>Dispatch engine</span></div><div class="muted" style="margin-top:6px">Waiting for the first order…</div>'; return; }
  const ago = Math.max(0, Math.round(S.t - D.t));
  $('#decision').innerHTML = `<div class="hd"><span>Dispatch engine · nearest pod</span><span class="mono">${ago < 60 ? ago + 's' : Math.round(ago / 60) + 'm'} ago</span></div>
    <div class="ord"><span class="ref" data-ref="${D.order}">${D.order}</span><span class="muted" style="font:600 12px Manrope">${D.cat} · ${D.kg} kg</span>${D.cat === 'Medical' ? pill(['Priority', tc('#ff5d62')]) : ''}</div>
    ${D.trace.map(([ok, tag, note]) => `<div class="tr-row ${ok ? 'ok' : 'no'}"><span class="m">${ok ? '✓' : '✕'}</span><span>${esc(tag)} — ${esc(note)}</span></div>`).join('')}
    <div class="res">→ <span class="ref" data-ref="${D.drone}">${D.drone}</span> · ${D.km} km · ETA ${D.eta} min${D.detour ? ` · geofence detour +${D.detour} km` : ''}</div>`;
}

const LOGF = {
  all: () => true, dispatch: e => /Dispatch|received|delivered|collected|waiting|re-dispatch/i.test(e.msg),
  energy: e => /battery|swap|Energy Hub|rebalanc/i.test(e.msg), airspace: e => /Separation|Traffic advisory|TFR|re-planned|restricted|geofence|airspace/i.test(e.msg),
  alerts: e => e.level === 'alert' || e.level === 'warn',
};
const evHtml = e => `<div class="ev ${e.level}"><span class="t">${clockStr(e.t)}</span><span class="m">${linkify(esc(e.msg))}</span></div>`;
function renderLog(full) {
  const el = $('#log');
  if (full) {
    $('#log-filter').innerHTML = [['all', 'All'], ['dispatch', 'Dispatch'], ['energy', 'Energy'], ['airspace', 'Airspace'], ['alerts', 'Alerts']].map(([k, l]) => `<button class="chip ${ui.logF === k ? 'on' : ''}" data-lf="${k}">${l}</button>`).join('');
    el.innerHTML = S.events.filter(LOGF[ui.logF]).slice(-150).reverse().map(evHtml).join('');
    ui.lastEv = S.seq; return;
  }
  const fresh = S.events.filter(e => e.id > ui.lastEv);
  ui.lastEv = S.seq;
  fresh.filter(e => e.level === 'alert').slice(-2).forEach(e => toast(e.msg));
  const html = fresh.filter(LOGF[ui.logF]).reverse().map(evHtml).join('');
  if (html) { el.insertAdjacentHTML('afterbegin', html); while (el.children.length > 150) el.lastChild.remove(); }
}
function toast(msg, kind = 'bad') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.innerHTML = linkify(esc(msg));
  $('#toasts').prepend(t); setTimeout(() => t.remove(), 5500);
  while ($('#toasts').children.length > 3) $('#toasts').lastChild.remove();
}

// ---------- selected drone card ----------
function renderCard() {
  const el = $('#dcard'), d = ui.sel && drone(ui.sel);
  if (!d || ui.tab !== 'command') { el.classList.add('hidden'); el.dataset.card = ''; return; }
  el.classList.remove('hidden');
  if (el.dataset.card !== d.id) {
    el.dataset.card = d.id;
    const vid = d.lng < 55.2 ? 'feed-marina-web.mp4' : 'feed-szr-web.mp4';
    el.innerHTML = `<div class="dhead"><span class="sdot" id="dc-dot"></span><span class="id">${d.id}</span><span class="pill" style="background:rgba(217,178,106,.12);color:var(--gold)">${d.model.split(' ')[0]} · ${d.maxKg} kg</span><span id="dc-st"></span><button class="x" data-act="close" title="Close">${ic('x')}</button></div>
      <div class="feed"><video id="dc-vid" src="assets/${vid}" autoplay muted loop playsinline></video><img id="dc-img" class="hidden" src="assets/energy-hub.jpg" alt="">
        <div class="hud"><div class="tl"><b>LIVE</b><span>CAM-1 · GIMBAL −30°</span></div><div class="tr" id="dc-clk"></div><div class="cross"></div><div class="bl"><span id="dc-h1"></span><span id="dc-h2"></span></div></div>
        <div class="standby hidden" id="dc-sb"></div></div>
      <div class="tele" id="dc-tele"></div><div class="mission" id="dc-mis"></div>
      <div class="actions"><button class="btn" data-act="follow">${ic('nav')} Follow</button><button class="btn warn" data-act="hub">${ic('bolt')} Recall to hub</button><button class="btn warn" data-act="drain">${ic('low')} Simulate low battery</button><button class="btn bad" data-act="fault">${ic('alert')} Inject fault</button></div>`;
  }
  const [lab, c] = STATUS[d.status], fly = Sim.airborne(d), o = Sim.orderOf(S, d), leg = d.legs[0];
  $('#dc-dot').style.cssText = `background:${c};box-shadow:0 0 8px ${c}`;
  $('#dc-st').innerHTML = pill([lab, c]);
  const swap = ['queued-swap', 'swapping'].includes(d.status);
  $('#dc-img').classList.toggle('hidden', !swap);
  $('#dc-vid').classList.toggle('hidden', swap);
  const sb = $('#dc-sb');
  const sbTxt = d.status === 'fault' ? '<span style="color:var(--red)">⚠ Emergency landing in progress</span>' : d.status === 'grounded' ? 'Link idle · ground recovery en route'
    : swap ? (d.status === 'swapping' ? 'Robotic battery swap in progress' : 'Waiting for swap bay') : !fly ? 'On pad · camera standby' : '';
  sb.innerHTML = sbTxt; sb.classList.toggle('hidden', !sbTxt);
  const v = $('#dc-vid'); if (fly && v.paused) v.play().catch(() => {}); else if (!fly && !v.paused) v.pause();
  const spd = speedOf(d);
  $('#dc-clk').textContent = clockStr(S.t);
  $('#dc-h1').textContent = `ALT ${Math.round(d.alt)} m  SPD ${spd} km/h`;
  $('#dc-h2').textContent = `HDG ${String(Math.round(d.heading)).padStart(3, '0')}°  BAT ${Math.round(d.battery)}%`;
  const toGo = leg?.kind === 'fly' ? Sim.pathLen(d, d.path.length ? d.path : [leg.to]) : 0;
  const eta = o?.eta ? Math.max(0, o.eta - S.t) : toGo / d.speed;
  $('#dc-tele').innerHTML = [['Altitude', `${Math.round(d.alt)} m`], ['Ground speed', `${spd} km/h`], ['Heading', `${Math.round(d.heading)}°`],
    ['Battery', `<span style="color:${batCol(d.battery)}">${Math.round(d.battery)}%</span>`], ['To target', `${(toGo / 1000).toFixed(1)} km`], [o ? 'Delivery ETA' : 'Leg ETA', fly ? mmss(eta) : '—']]
    .map(([l, v]) => `<div><div class="l">${l}</div><div class="v">${v}</div></div>`).join('');
  let mis;
  if (o) {
    const stage = { assigned: d.status === 'loading' ? 2 : 1, picked: d.status === 'dropping' ? 4 : 3 }[o.status] || 0;
    mis = `<div><span class="mono" style="font-weight:700">${o.id}</span> · ${o.cat} ${o.kg} kg · ${esc(o.customer)}${o.priority ? ' ' + pill(['Priority', tc('#ff5d62')]) : ''}</div>
      <div class="route">${esc(o.pickup.name)} → ${esc(o.drop.name)} · dispatched from ${o.podId} with ${o.need}% energy plan</div>
      <div class="steps">${[1, 2, 3, 4].map(i => `<span class="${i <= stage ? 'on' : ''}"></span>`).join('')}</div><div class="steps-l"><span>To pickup</span><span>Winch load</span><span>En route</span><span>Lower parcel</span></div>`;
  } else {
    const msg = { idle: `Ready on pad at ${pod(d.podId)?.name} — available for dispatch`, 'to-hub': `Auto-routed to Energy Hub · battery ${Math.round(d.battery)}%`, 'queued-swap': 'Queued for a swap bay at Energy Hub',
      swapping: 'Robotic arm exchanging battery pack (≈60 s)', returning: `Returning to ${whereOf(d).replace('→ ', '')} after delivery`, rebalancing: `Rebalancing fleet → ${whereOf(d).replace('→ ', '')}`,
      rtb: 'Weather hold — returning to nearest pod', fault: 'Motor anomaly — controlled descent to safe landing zone', grounded: 'Awaiting ground recovery team', maintenance: 'Post-incident diagnostics at home pod' }[d.status] || '';
    mis = `<div class="muted">${esc(msg)}</div><div class="route">Flights today ${d.flights} · deliveries ${d.deliveries} · ${d.km.toFixed(1)} km · health ${d.health}% · ${d.cycles} battery cycles</div>`;
  }
  $('#dc-mis').innerHTML = mis;
  el.querySelector('[data-act=follow]').classList.toggle('on', ui.follow);
}

function select(id, fly = true) {
  const d = drone(id);
  if (!d) return;
  if (ui.tab !== 'command') setTab('command');
  ui.sel = id; ui.follow = true;
  if (fly) { const [lng, lat] = dispPos(d); map.flyTo({ center: [lng, lat], zoom: 14.2, pitch: 62, duration: 1600, essential: true }); }
  renderCard(); renderFleet();
}
function deselect() { ui.sel = null; ui.follow = false; renderCard(); renderFleet(); }

// ---------- customer app ----------
function phoneQuote() {
  const P = ui.phone, m = Sim.MERCHANTS[P.merchant], drop = P.pin || Sim.PLACES[P.drop];
  const p = Sim.nearestPod(S, m), km = (Sim.dist(p, m) + Sim.dist(m, drop)) / 1000;
  const nfz = S.zones.find(z => z.active && Sim.inside(drop, z));
  return { km, min: Math.round(km * 1000 / 20 / 60 + 2.5), fee: Math.round(10 + 2.2 * Sim.dist(m, drop) / 1000 + (P.kg > 3 ? 6 : P.kg > 1.5 ? 3 : 0)), nfz };
}
function buildForm() {
  const P = ui.phone, ms = Sim.MERCHANTS.map((m, i) => [m, i]).filter(([m]) => m.cat === P.cat);
  if (!ms.some(([, i]) => i === P.merchant)) P.merchant = ms[0][1];
  $('#app-body').innerHTML = `<h5>Send it by air</h5><div class="sub">Drone delivery across Dubai in minutes.</div>
    <label>What are you sending?</label><div class="cats">${Object.keys(Sim.CATS).map(c => `<button data-cat="${c}" class="${c === P.cat ? 'on' : ''}">${c}</button>`).join('')}</div>
    <label>Pickup from</label><select id="ph-m">${ms.map(([m, i]) => `<option value="${i}" ${i === P.merchant ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
    <label>Deliver to</label><select id="ph-d">${P.pin ? '<option value="-1" selected>📍 Pinned location</option>' : ''}${Sim.PLACES.map((p, i) => `<option value="${i}" ${!P.pin && i === P.drop ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <button class="pinbtn" data-act="pin">📍 Drop a pin on the map instead</button>
    <label>Parcel weight · <span id="ph-kgv">${P.kg.toFixed(1)} kg</span></label><input id="ph-kg" type="range" min="0.1" max="5" step="0.1" value="${P.kg}" style="width:100%;accent-color:#c9a35a">
    <div id="ph-q"></div><button class="cta" data-act="send">Request drone</button>`;
  P.built = true;
}
function renderPhone() {
  const P = ui.phone;
  $('#phone').classList.toggle('hidden', !P.open || ui.tab !== 'command');
  $('#b-phone').classList.toggle('on', P.open);
  if (!P.open) return;
  $('#ph-time').textContent = clockStr(S.t, { hour: '2-digit', minute: '2-digit' });
  if (P.step === 'form') {
    if (!P.built) buildForm();
    const q = phoneQuote();
    $('#ph-q').innerHTML = `<div class="quote"><div><div class="v">${q.km.toFixed(1)} km</div><div class="l">Air route</div></div><div><div class="v">~${q.min} min</div><div class="l">Arrival</div></div><div><div class="v">AED ${q.fee}</div><div class="l">Price</div></div></div>${q.nfz ? `<div class="notice">This address is inside <b>${q.nfz.name}</b> restricted airspace — we'll book a ground courier automatically.</div>` : ''}`;
    return;
  }
  const o = S.byId.get(P.order);
  if (!o) { P.step = 'form'; P.built = false; return; }
  const d = o.droneId && drone(o.droneId);
  const stage = { queued: 1, assigned: 2, picked: d?.status === 'dropping' ? 4 : 3, delivered: 5 }[o.status] ?? 1;
  const steps = [['Order placed', `${o.id} · ${o.cat} ${o.kg} kg`], ['Drone assigned', o.droneId ? `${o.droneId} launched from ${o.podId} ${pod(o.podId)?.name}` : 'Finding the nearest pod…'],
    ['Picked up', o.pickup.name], ['On the way', d ? `${Math.round(d.alt)} m · ${speedOf(d)} km/h · battery ${Math.round(d.battery)}%` : 'Flying the geofenced air corridor'], ['Delivered', 'Parcel lowered by winch — no contact']];
  const eta = o.eta ? Math.max(0, o.eta - S.t) : null;
  let top;
  if (o.status === 'fallback') top = `<div class="notice" style="margin-top:14px">📦 ${esc(o.note)}. A courier will reach you in ~35 min.</div>`;
  else if (o.status === 'delivered') top = `<div class="trk-eta"><div class="s">Delivered in</div><div class="big">${o.mins.toFixed(1)} min</div><div class="s">${esc(o.drop.name)}</div></div><img class="dimg" src="assets/delivery.jpg" alt="">`;
  else top = `<div class="trk-eta"><div class="s">${o.status === 'queued' ? 'Assigning a drone' : 'Arriving in'}</div><div class="big">${eta != null ? Math.max(1, Math.ceil(eta / 60)) + ' min' : '—'}</div><div class="s">To ${esc(o.drop.name)}</div></div>`;
  $('#app-body').innerHTML = `<h5 style="font-size:17px">Your delivery</h5>${top}
    ${o.status === 'fallback' ? '' : `<div class="tl2">${steps.map(([l, s], i) => `<div class="${i + 1 < stage || stage === 5 ? 'done' : i + 1 === stage ? 'now' : ''}"><i></i><span>${l}<small>${esc(s)}</small></span></div>`).join('')}</div>`}
    ${d && o.status !== 'delivered' ? `<button class="cta" data-act="track" style="background:#fff;color:#17191c;border:1px solid #e0ddd5">Watch drone live</button>` : ''}
    <button class="cta" data-act="again">${o.status === 'delivered' || o.status === 'fallback' ? 'Send another' : 'New order'}</button>`;
}
function phoneSend() {
  const P = ui.phone, m = Sim.MERCHANTS[P.merchant], pl = P.pin || Sim.PLACES[P.drop];
  const o = Sim.addOrder(S, { merchant: m, cat: P.cat, kg: P.kg, customer: 'You · demo customer', source: 'app', drop: { name: pl.name, lat: pl.lat, lng: pl.lng } });
  Sim.dispatch(S);
  P.order = o.id; P.step = 'track';
  toast(`Customer app order ${o.id} — ${o.status === 'fallback' ? 'restricted airspace, ground courier booked' : o.droneId ? `${o.droneId} dispatched from ${o.podId}` : 'queued for next drone'}`, 'ok');
  if (o.droneId) select(o.droneId);
  renderPhone();
}

// ---------- pages ----------
function pageOrders() {
  const F = ui.ordF, c = countBy(S.orders, o => o.status);
  const list = S.orders.slice().reverse().filter(o => F === 'all' || o.status === F).slice(0, 180);
  return `<div class="phd"><div><h2>Orders</h2><p class="lead" style="margin:0">Each order is auto-assigned to the nearest pod holding a drone with the payload capacity and battery for pickup, delivery and a guaranteed return to the Energy Hub.</p></div>
    <div class="chips" style="padding:0;flex-wrap:nowrap">${[['all', 'All', S.orders.length], ...Object.entries(ORDER_ST).map(([k, [l]]) => [k, l, c[k] || 0])].map(([k, l, n]) => `<button class="chip ${F === k ? 'on' : ''}" data-of="${k}">${l}<b>${n}</b></button>`).join('')}</div></div>
    <div class="card"><table><thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Type</th><th>Kg</th><th>Pickup</th><th>Drop-off</th><th>Pod</th><th>Drone</th><th>Status</th><th>Time</th><th>Fee</th></tr></thead><tbody>
    ${list.map(o => `<tr class="click" data-order="${o.id}"><td class="num">${o.id}</td><td class="num">${clockStr(o.created, { hour: '2-digit', minute: '2-digit' })}</td><td>${esc(o.customer)}</td>
      <td><span class="sdot" style="display:inline-block;margin-right:6px;background:${CAT_COL[o.cat]}"></span>${o.cat}${o.priority ? ' ' + pill(['P1', tc('#ff5d62')]) : ''}</td><td class="num">${o.kg}</td><td>${esc(o.pickup.name)}</td><td>${esc(o.drop.name)}</td>
      <td class="num">${o.podId || '—'}</td><td class="num">${o.droneId || '—'}</td><td>${pill(ORDER_ST[o.status])}</td>
      <td class="num">${o.status === 'delivered' ? o.mins.toFixed(1) + ' min' : o.eta && o.status !== 'queued' ? 'ETA ' + mmss(Math.max(0, o.eta - S.t)) : o.status === 'queued' ? 'wait ' + mmss(S.t - o.created) : '—'}</td><td class="num">AED ${o.fee}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function pageFleet() {
  const st = S.drones, avail = st.filter(d => !['fault', 'grounded', 'maintenance'].includes(d.status)).length;
  const flights = st.reduce((a, d) => a + d.flights, 0), km = st.reduce((a, d) => a + d.km, 0);
  return `<div class="phd"><div><h2>Fleet</h2><p class="lead" style="margin:0">${st.length} autonomous drones — ${st.filter(d => d.model === 'H6 Cargo').length} × H6 Cargo and ${st.filter(d => d.model !== 'H6 Cargo').length} × Q4 Express (86 km/h). Every drone carries up to 5 kg.</p></div></div>
    <div class="hero" style="margin-bottom:14px;min-height:230px;background:#181c22"><img src="assets/drone.jpg" alt="" style="object-fit:contain;object-position:right center"><div class="ov"><h3>H6 Cargo drone</h3><p>Hexacopter with winch-lowered cargo pod, swappable 1.9 kWh battery, ADS-B receiver and dual-redundant GNSS.</p>
      <div class="nums"><div><div class="v">5 kg</div><div class="l">Payload</div></div><div><div class="v">~50 km</div><div class="l">Range / pack</div></div><div><div class="v">72 km/h</div><div class="l">Cruise</div></div><div><div class="v">60 s</div><div class="l">Battery swap</div></div></div></div></div>
    <div class="grid g4" style="margin-bottom:14px">
      <div class="card stat"><h4>Availability</h4><div class="v">${Math.round(100 * avail / st.length)}%</div><div class="s">${avail} of ${st.length} mission-ready</div></div>
      <div class="card stat"><h4>Avg battery</h4><div class="v">${Math.round(st.reduce((a, d) => a + d.battery, 0) / st.length)}%</div><div class="s">swaps only at Energy Hub</div></div>
      <div class="card stat"><h4>Flights this session</h4><div class="v">${flights}</div><div class="s">${km.toFixed(0)} km flown</div></div>
      <div class="card stat"><h4>Fleet health</h4><div class="v">${Math.round(st.reduce((a, d) => a + d.health, 0) / st.length)}%</div><div class="s">predictive maintenance score</div></div></div>
    <div class="card"><table><thead><tr><th>Drone</th><th>Model</th><th>Status</th><th>Battery</th><th>Location / mission</th><th>Alt</th><th>Flights</th><th>Km</th><th>Cycles</th><th>Health</th><th>Home</th></tr></thead><tbody>
    ${st.map(d => `<tr class="click" data-drone="${d.id}"><td class="num" style="font-weight:600">${d.id}</td><td>${d.model}</td><td>${pill(STATUS[d.status])}</td><td>${batHtml(d.battery)}</td><td>${esc(whereOf(d))}</td>
      <td class="num">${Math.round(d.alt)} m</td><td class="num">${d.flights}</td><td class="num">${d.km.toFixed(1)}</td><td class="num">${d.cycles}</td><td class="num" style="color:${d.health < 90 ? 'var(--amber)' : 'inherit'}">${d.health}%</td><td class="num">${d.home}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function pagePods() {
  const H = S.hub, total = S.cfg.packs, charging = H.charging.length;
  const busy = H.bays.filter(Boolean).length;
  const stationed = S.drones.filter(d => d.podId).length, inbound = S.drones.filter(d => d.legs[0]?.land?.type === 'pod').length;
  const pack = Array.from({ length: total }, (_, i) => i < H.charged ? 'c' : i < H.charged + charging ? 'g' : 'd');
  return `<div class="phd"><div><h2>Pods &amp; Energy</h2><p class="lead" style="margin:0">Nine SkyPods launch and recover drones; one central Energy Hub performs every battery swap. Drones are routed there automatically before charge runs short.</p></div></div>
    <div class="grid g2" style="margin-bottom:14px">
      <div class="hero"><img src="assets/pod.jpg" alt=""><div class="ov"><h3>SkyPod network</h3><p>Rooftop hexagonal pods with 6 landing pads each, weather station and automated parcel hand-off.</p>
        <div class="nums"><div><div class="v">${S.pods.length}</div><div class="l">Pods</div></div><div><div class="v">${S.pods.length * 6}</div><div class="l">Pads</div></div><div><div class="v">${stationed}</div><div class="l">Drones docked</div></div><div><div class="v">${inbound}</div><div class="l">Inbound</div></div></div></div></div>
      <div class="hero"><img src="assets/energy-hub.jpg" alt=""><div class="ov"><h3>${H.name}</h3><p>Robotic arm swaps a battery in ${S.cfg.swapTime} s. Depleted packs recharge on racks while the drone is already back in service.</p>
        <div class="nums"><div><div class="v">${H.charged}</div><div class="l">Charged packs</div></div><div><div class="v">${charging}</div><div class="l">Charging</div></div><div><div class="v">${H.swaps}</div><div class="l">Swaps</div></div><div><div class="v">${H.queue.length}</div><div class="l">In queue</div></div></div></div></div></div>
    <div class="card" style="padding:16px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h4>Swap bays · ${busy}/4 busy</h4><span class="muted">Hub pack stock (${total}): <b style="color:var(--green)">${H.charged} charged</b> · <b style="color:var(--amber)">${charging} charging</b> · ${busy} in swap bays</span></div>
      <div class="bays" style="margin-top:12px">${H.bays.map((id, i) => {
        const d = id && drone(id), leg = d?.legs[0], p = leg?.left != null ? 1 - leg.left / S.cfg.swapTime : 0;
        return `<div class="bay ${id ? 'busy' : ''}"><div class="muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:700">Bay ${i + 1}</div>${id ? `<div class="mono" style="font-size:16px;font-weight:600;margin-top:6px">${id}</div><div class="prog"><i style="width:${Math.round(p * 100)}%"></i></div><div class="muted mono" style="font-size:11px;margin-top:5px">${Math.ceil(leg.left)} s left</div>` : '<div class="dim" style="margin-top:14px">Free</div>'}</div>`;
      }).join('')}</div>
      <div class="packs">${pack.map(k => `<i class="${k}"></i>`).join('')}</div>
      ${H.queue.length ? `<div class="muted" style="margin-top:10px">Queue: ${H.queue.map(id => `<span class="ref" data-ref="${id}">${id}</span>`).join(', ')}</div>` : ''}</div>
    <div class="grid g3">${S.pods.map(p => {
      const docked = S.drones.filter(d => d.podId === p.id), inb = S.drones.filter(d => d.legs[0]?.land?.id === p.id).length, bl = blocked(p);
      const near = S.orders.filter(o => o.status === 'queued' && Sim.dist(o.pickup, p) < 5000).length;
      return `<div class="card pod"><div class="top2"><div><div class="nm">${p.name}</div><div class="muted mono" style="font-size:11px">${p.id} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</div></div>${pill(bl ? ['Suspended · TFR', tc('#ff5d62')] : ['Online', tc('#3ee08f')])}</div>
        <div class="pads">${Array.from({ length: 6 }, (_, i) => { const d = docked[i]; return `<div class="pad" style="${d ? `background:${STATUS[d.status][1]}` : ''}" title="${d ? d.id : 'free'}">${d ? d.id.slice(-3) : ''}</div>`; }).join('')}</div>
        <div class="kv"><div><div class="l">Docked</div><div class="v">${docked.length}</div></div><div><div class="l">Inbound</div><div class="v">${inb}</div></div><div><div class="l">Delivered</div><div class="v">${p.served}</div></div></div>
        ${near ? `<div style="margin-top:8px;color:var(--amber);font-size:11.5px">${near} order${near > 1 ? 's' : ''} waiting nearby — rebalancing drones here</div>` : ''}</div>`;
    }).join('')}</div>`;
}

function altProfile() {
  const W = 820, Hh = 300, x = lng => 50 + (lng - 55.1) / (55.45 - 55.1) * (W - 70), y = a => Hh - 30 - Math.min(a, 160) / 160 * (Hh - 70);
  const bands = [[150, 'Ceiling 150 m', '#ff5d62'], [120, 'Westbound layer 120 m', '#7c95ff'], [90, 'Eastbound layer 90 m', '#3ad6f0'], [60, 'Traffic-advisory cap 60 m', '#ffb547'], [30, 'Winch / hand-off 30 m', '#8ea3b8']].map(([a, l, c]) => [a, l, tc(c)]);
  const zones = S.zones.filter(z => z.active);
  return `<svg viewBox="0 0 ${W} ${Hh}" style="width:100%;height:auto;display:block">
    ${zones.map(z => { const a = x(z.lng - z.r / MX), b = x(z.lng + z.r / MX); return `<rect x="${a}" y="${y(160)}" width="${Math.max(2, b - a)}" height="${y(0) - y(160)}" fill="${z.kind === 'tfr' ? 'rgba(255,170,70,.1)' : 'rgba(255,93,98,.08)'}"/><text x="${(a + b) / 2}" y="${y(0) + 16}" style="fill:var(--red)" font-size="9.5" text-anchor="middle" font-family="Manrope" font-weight="700">${z.id}</text>`; }).join('')}
    ${bands.map(([a, l, c]) => `<line x1="50" x2="${W - 20}" y1="${y(a)}" y2="${y(a)}" stroke="${c}" stroke-opacity=".45" stroke-dasharray="4 5"/><text x="${W - 22}" y="${y(a) - 5}" fill="${c}" font-size="10.5" text-anchor="end" font-family="Manrope" font-weight="700">${l}</text>`).join('')}
    <line x1="50" x2="${W - 20}" y1="${y(0)}" y2="${y(0)}" style="stroke:var(--line2)"/>
    ${[0, 50, 100, 150].map(a => `<text x="40" y="${y(a) + 4}" style="fill:var(--dim)" font-size="10" text-anchor="end" font-family="JetBrains Mono">${a}</text>`).join('')}
    ${S.pods.map(p => `<rect x="${x(p.lng) - 3}" y="${y(0) - 3}" width="6" height="6" transform="rotate(45 ${x(p.lng)} ${y(0)})" style="fill:var(--teal)"/>`).join('')}
    <rect x="${x(S.hub.lng) - 4}" y="${y(0) - 4}" width="8" height="8" transform="rotate(45 ${x(S.hub.lng)} ${y(0)})" style="fill:var(--gold)"/>
    ${S.drones.filter(Sim.airborne).map(d => `<circle cx="${x(d.lng)}" cy="${y(d.alt)}" r="4.5" fill="${STATUS[d.status][1]}" style="stroke:var(--panel)"><title>${d.id} ${Math.round(d.alt)} m</title></circle>`).join('')}
    <text x="50" y="18" style="fill:var(--muted)" font-size="10.5" font-family="Manrope" font-weight="700">WEST (Marina) → EAST (Al Warqa) · live vertical profile · manned traffic above 150 m not to scale</text>
  </svg>`;
}
function pageAirspace() {
  const st = S.stats;
  const recent = S.events.filter(LOGF.airspace).slice(-10).reverse();
  return `<div class="phd"><div><h2>Airspace &amp; traffic</h2><p class="lead" style="margin:0">Geofenced no-fly zones, direction-based altitude layers, automatic drone-to-drone separation and ADS-B traffic advisories for manned aircraft.</p></div>
      <button class="btn warn" data-act="tfr">${ic('ban')} Declare TFR on map</button></div>
    <div class="grid g4" style="margin-bottom:14px">
      <div class="card stat"><h4>Separations assured</h4><div class="v">${st.sep}</div><div class="s">min 160 m horizontal / 22 m vertical</div></div>
      <div class="card stat"><h4>Traffic advisories</h4><div class="v">${st.ta}</div><div class="s">manned aircraft within 1.3 km</div></div>
      <div class="card stat"><h4>Dynamic re-routes</h4><div class="v">${st.reroutes}</div><div class="s">after airspace changes</div></div>
      <div class="card stat"><h4>Geofence conformance</h4><div class="v" style="color:var(--green)">100%</div><div class="s">${st.fallback} drop-offs handed to ground couriers</div></div></div>
    <div class="card" style="padding:14px 16px;margin-bottom:14px"><h4>Vertical profile</h4>${altProfile()}</div>
    <div class="grid g2">
      <div class="card"><div style="padding:14px 16px 4px"><h4>Restricted airspace</h4></div><table><thead><tr><th>Zone</th><th>Type</th><th>Radius</th><th>Active</th></tr></thead><tbody>
        ${S.zones.map(z => `<tr><td><b>${z.id}</b> <span class="muted">${esc(z.name)}</span></td><td>${{ airport: 'Airport CTR', military: 'Military', restricted: 'Restricted', tfr: 'Temporary' }[z.kind]}</td><td class="num">${(z.r / 1000).toFixed(1)} km</td><td><button class="sw ${z.active ? 'on' : ''}" data-zone="${z.id}" aria-label="toggle ${z.id}"></button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="card"><div style="padding:14px 16px 4px"><h4>Manned traffic · ADS-B</h4></div><table><thead><tr><th>Callsign</th><th>Type</th><th>Altitude</th><th>Phase</th></tr></thead><tbody>
        ${S.traffic.filter(a => !a.hidden).map(a => `<tr><td class="num"><b>${a.id}</b></td><td>${a.type === 'heli' ? 'Helicopter · tour' : 'Airliner'}</td><td class="num">${a.alt} m</td><td>${a.type === 'heli' ? 'Coastal circuit' : a.mode === 'arr' ? 'Approach RWY 12 DXB' : 'Departure RWY 12 DXB'}</td></tr>`).join('')}
      </tbody></table>
      <div style="padding:12px 16px 14px"><h4 style="margin-bottom:6px">Recent airspace events</h4>${recent.map(evHtml).join('') || '<div class="dim">None yet</div>'}</div></div>
    </div>`;
}

function pageAnalytics() {
  return `<div class="phd"><div><h2>Analytics</h2><p class="lead" style="margin:0">Today's network performance (06:00–now, Dubai time). Current hour updates live.</p></div></div>
    <div class="grid g4" style="margin-bottom:14px" id="an-stats"></div>
    <div class="grid g2" style="margin-bottom:14px"><div class="card"><div style="padding:14px 16px 0"><h4>Deliveries per hour</h4></div><div class="chart-wrap"><canvas id="c1"></canvas></div></div>
      <div class="card"><div style="padding:14px 16px 0"><h4>Average delivery time (min)</h4></div><div class="chart-wrap"><canvas id="c2"></canvas></div></div></div>
    <div class="grid g2"><div class="card"><div style="padding:14px 16px 0"><h4>Order mix</h4></div><div class="chart-wrap"><canvas id="c3"></canvas></div></div>
      <div class="card"><div style="padding:14px 16px 0"><h4>Deliveries by pod (live session)</h4></div><div class="chart-wrap"><canvas id="c4"></canvas></div></div></div>`;
}
function analyticsData() {
  const st = S.stats, hours = []; for (let h = 6; h <= Math.max(6, NOW_H + 1); h++) hours.push(h);
  const cnt = h => (HIST[h] || 0) + (st.byHour[h] || 0);
  const tm = h => st.byHour[h] ? st.timeByHour[h] / st.byHour[h] : HIST_T[h] ?? null;
  const total = HIST_TOTAL + st.delivered;
  const cats = Object.keys(Sim.CATS).map(c => Math.round(HIST_TOTAL * CAT_SHARE[c]) + (st.byCat[c] || 0));
  return { hours, cnt: hours.map(cnt), tm: hours.map(tm), cats, total, pods: S.pods.map(p => st.byPod[p.id] || 0) };
}
function updateAnalytics() {
  const A = analyticsData(), st = S.stats;
  const util = S.drones.filter(d => d.order).length / S.drones.length;
  const done = S.orders.filter(o => o.status === 'delivered' && o.meters), avgRoute = done.length && done.reduce((a, o) => a + o.meters, 0) / done.length;
  $('#an-stats').innerHTML = [['Deliveries today', A.total, `${st.delivered} this session`], ['Fleet utilisation', Math.round(util * 100) + '%', 'drones carrying an order now'],
    ['Energy per delivery', st.delivered ? Math.round(S.hub.swaps * 1900 / Math.max(1, st.delivered)) + ' Wh' : '—', '1.9 kWh swappable pack'], ['Avg air route', avgRoute ? (avgRoute / 1000).toFixed(1) + ' km' : '—', 'pod → pickup → drop-off']]
    .map(([l, v, s]) => `<div class="card stat"><h4>${l}</h4><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  if (!ui.charts) {
    Chart.defaults.color = theme === 'light' ? '#5a6778' : '#8697ab'; Chart.defaults.borderColor = theme === 'light' ? 'rgba(15,30,55,.08)' : 'rgba(148,178,212,.1)'; Chart.defaults.font.family = 'Manrope';
    const opt = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } };
    ui.charts = [
      new Chart($('#c1'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: tc('#3ad6f0'), borderRadius: 4, maxBarThickness: 26 }] }, options: opt }),
      new Chart($('#c2'), { type: 'line', data: { labels: [], datasets: [{ data: [], borderColor: tc('#d9b26a'), backgroundColor: 'rgba(217,178,106,.14)', fill: true, tension: .35, pointRadius: 3, spanGaps: true }] }, options: opt }),
      new Chart($('#c3'), { type: 'doughnut', data: { labels: Object.keys(Sim.CATS), datasets: [{ data: [], backgroundColor: Object.keys(Sim.CATS).map(c => CAT_COL[c]), borderColor: theme === 'light' ? '#ffffff' : '#0a111b', borderWidth: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '64%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, padding: 12 } } } } }),
      new Chart($('#c4'), { type: 'bar', data: { labels: S.pods.map(p => p.name), datasets: [{ data: [], backgroundColor: tc('#2dd4bf'), borderRadius: 4, maxBarThickness: 18 }] }, options: { ...opt, indexAxis: 'y', scales: { x: { beginAtZero: true }, y: { grid: { display: false } } } } }),
    ];
  }
  const [c1, c2, c3, c4] = ui.charts, lab = A.hours.map(h => `${String(h).padStart(2, '0')}:00`);
  c1.data.labels = lab; c1.data.datasets[0].data = A.cnt; c2.data.labels = lab; c2.data.datasets[0].data = A.tm;
  c3.data.datasets[0].data = A.cats; c4.data.datasets[0].data = A.pods;
  ui.charts.forEach(c => c.update('none'));
}

const PAGES = { orders: pageOrders, fleet: pageFleet, pods: pagePods, airspace: pageAirspace };
function renderPage(first) {
  if (ui.tab === 'command') return;
  if (ui.tab === 'analytics') { if (first) { ui.charts?.forEach(c => c.destroy()); ui.charts = null; $('#page').innerHTML = pageAnalytics(); } updateAnalytics(); return; }
  $('#page').innerHTML = PAGES[ui.tab]();
}
function setTab(t) {
  ui.tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('#page').classList.toggle('hidden', t === 'command');
  if (t !== 'command') { $('#page').scrollTop = 0; renderPage(true); }
  renderCard(); renderPhone();
}

// ---------- interaction ----------
function setPick(mode) {
  ui.pick = mode;
  const n = $('#mapnote');
  n.classList.toggle('on', !!mode);
  n.innerHTML = mode === 'tfr' ? `${ic('ban')} Click the map to declare a 1.2 km Temporary Flight Restriction <button class="btn" data-act="cancel">Cancel</button>`
    : mode === 'pin' ? `${ic('locate')} Click the map to drop the delivery pin <button class="btn" data-act="cancel">Cancel</button>` : '';
  map.getCanvas().style.cursor = mode ? 'crosshair' : '';
}
map.on('click', e => {
  if (!ui.pick) return;
  const { lng, lat } = e.lngLat;
  if (ui.pick === 'tfr') Sim.addZone(S, lat, lng, 1200);
  if (ui.pick === 'pin') { ui.phone.pin = { name: `Pinned · ${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng }; ui.phone.built = false; renderPhone(); }
  setPick(null);
});
map.on('dragstart', () => { ui.follow = false; });
['mousedown', 'wheel', 'touchstart'].forEach(ev => map.on(ev, e => { if (ui.cine && e.originalEvent) setCine(false); }));

function setCine(on) {
  ui.cine = on; clearTimeout(ui.cineT);
  $('#b-cine').classList.toggle('on', on);
  if (!on) return;
  (function hop() {
    const pool = S.drones.filter(d => ['to-drop', 'to-pickup'].includes(d.status) && d.alt > 60);
    const d = pool[Math.floor(Math.random() * pool.length)];
    if (d) { ui.sel = d.id; ui.follow = true; map.flyTo({ center: [d.lng, d.lat], zoom: 14.4 + Math.random() * 0.8, pitch: 60 + Math.random() * 10, bearing: Math.random() * 360 - 180, duration: 4500, essential: true }); }
    ui.cineT = setTimeout(hop, 15000);
  })();
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab],[data-id],[data-ref],[data-ff],[data-lf],[data-of],[data-order],[data-drone],[data-zone],[data-act],[data-cat]');
  if (!t) return;
  const D = t.dataset;
  if (D.tab) return setTab(D.tab);
  if (D.id) return select(D.id);
  if (D.drone) return select(D.drone);
  if (D.ref || D.order) {
    const r = D.ref || D.order;
    if (r.startsWith('DRN')) return select(r);
    const o = S.byId.get(r);
    if (o?.droneId && ['assigned', 'picked'].includes(o.status)) return select(o.droneId);
    if (ui.tab !== 'orders') setTab('orders');
    return;
  }
  if (D.ff) { ui.fleetF = D.ff; return renderFleet(); }
  if (D.lf) { ui.logF = D.lf; return renderLog(true); }
  if (D.of) { ui.ordF = D.of; return renderPage(); }
  if (D.zone) { Sim.toggleZone(S, D.zone); return renderPage(); }
  if (D.cat) { ui.phone.cat = D.cat; ui.phone.built = false; return renderPhone(); }
  const d = ui.sel && drone(ui.sel), P = ui.phone;
  switch (D.act) {
    case 'close': return deselect();
    case 'follow': ui.follow = !ui.follow; if (ui.follow && d) map.flyTo({ center: dispPos(d).slice(0, 2), zoom: Math.max(map.getZoom(), 13.8), duration: 900 }); return renderCard();
    case 'hub': return d && Sim.recallToHub(S, d.id);
    case 'drain': return d && Sim.drainBattery(S, d.id);
    case 'fault': if (d && !Sim.injectFault(S, d.id)) toast(`${d.id} is not airborne — fault injection needs a flying drone`, 'warn'); return;
    case 'tfr': setTab('command'); return setPick('tfr');
    case 'cancel': return setPick(null);
    case 'pin': return setPick('pin');
    case 'send': return phoneSend();
    case 'track': { const o = S.byId.get(P.order); return o?.droneId && select(o.droneId); }
    case 'again': P.step = 'form'; P.built = false; P.pin = null; return renderPhone();
  }
});
document.addEventListener('change', e => {
  const P = ui.phone;
  if (e.target.id === 'ph-m') P.merchant = +e.target.value;
  if (e.target.id === 'ph-d') { const v = +e.target.value; if (v >= 0) { P.drop = v; P.pin = null; } }
});
document.addEventListener('input', e => { if (e.target.id === 'ph-kg') { ui.phone.kg = +e.target.value; $('#ph-kgv').textContent = ui.phone.kg.toFixed(1) + ' kg'; } });
document.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  if (e.key === 'Escape') { setPick(null); deselect(); setCine(false); }
});

function togglePause() { ui.paused = !ui.paused; $('#play').innerHTML = ui.paused ? `${ic('play')} Resume` : `${ic('pause')} Pause`; }
$('#play').onclick = togglePause;
$('#speed').innerHTML = [1, 5, 10, 30, 60].map(s => `<button data-s="${s}" class="${s === ui.speed ? 'on' : ''}">${s}×</button>`).join('');
$('#speed').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; ui.speed = +b.dataset.s; $('#speed').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
document.querySelectorAll('[data-ic]').forEach(b => b.insertAdjacentHTML('afterbegin', ic(b.dataset.ic) + ' '));
$('#b-order').onclick = () => { const o = Sim.addOrder(S); Sim.dispatch(S); toast(`${o.id} ${o.cat} · ${o.pickup.name} → ${o.drop.name}${o.droneId ? ` · ${o.droneId} dispatched` : ''}`, 'ok'); };
$('#b-rush').onclick = () => { Sim.rush(S); Sim.dispatch(S); toast('Demand surge: 8 orders injected, order rate ×3 for 15 min', 'warn'); };
$('#b-storm').onclick = () => Sim.setStorm(S, !S.weather.storm);
$('#b-tfr').onclick = () => { setTab('command'); setPick('tfr'); };
$('#b-fault').onclick = () => {
  const cur = ui.sel && drone(ui.sel);
  const d = Sim.injectFault(S, cur && Sim.airborne(cur) ? cur.id : undefined);
  if (d) select(d.id); else toast('No airborne drone available for fault injection', 'warn');
};
$('#b-cine').onclick = () => setCine(!ui.cine);
function setTheme(t) {
  theme = t;
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('dlos-theme', t); } catch { /* per-viewer convenience only */ }
  recolor();
  $('#b-theme').innerHTML = ic(t === 'light' ? 'moon' : 'sun');
  map.setStyle(STYLE[t], { diff: false }); // full reload so style.load re-adds the 3D buildings
  ui.charts?.forEach(c => c.destroy()); ui.charts = null;
  renderAll(); renderLog(true); renderPage(true);
}
$('#b-theme').innerHTML = ic(theme === 'light' ? 'moon' : 'sun');
$('#b-theme').onclick = () => setTheme(theme === 'light' ? 'dark' : 'light');
$('#b-view').onclick = () => { setCine(false); deselect(); fitHome(); map.flyTo({ ...HOME, duration: 1800 }); };
$('#b-phone').onclick = () => { ui.phone.open = !ui.phone.open; if (ui.phone.open) setTab('command'); renderPhone(); };
togglePause(); togglePause();

// ---------- loops ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!ui.paused) Sim.tick(S, dt * ui.speed);
  overlay.setProps({ layers: buildLayers(now / 1000).filter(Boolean) });
  const d = ui.follow && ui.sel && drone(ui.sel);
  if (d && !map.isMoving()) map.jumpTo({ center: dispPos(d).slice(0, 2), bearing: map.getBearing() + (ui.cine ? dt * 4 : 0) });
  else if (ui.cine && !map.isMoving()) map.setBearing(map.getBearing() + dt * 3);
  requestAnimationFrame(frame);
}
// ponytail: panels re-render on a timer; skip while a pointer is down so row clicks never land on a replaced node
let pointerDown = false;
addEventListener('pointerdown', () => { pointerDown = true; }, true);
addEventListener('pointerup', () => { setTimeout(() => { pointerDown = false; }, 0); }, true);
function renderAll() { if (pointerDown) return; renderHeader(); renderKpis(); renderFleet(); renderDecision(); renderLog(); renderCard(); renderPhone(); }
renderLog(true); renderAll();
setInterval(renderAll, 400);
setInterval(() => pointerDown || renderPage(), 1000);
requestAnimationFrame(frame);
