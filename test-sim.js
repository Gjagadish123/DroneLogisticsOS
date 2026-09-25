// node test-sim.js — invariants for dispatch, battery, routing, airspace
const assert = require('assert');
const Sim = require('./sim.js');

// 1. routes never cross an active no-fly zone
{
  const S = Sim.create();
  const dxb = S.zones.find(z => z.id === 'NFZ-DXB');
  const a = { lat: 25.2700, lng: 55.3050 }, b = { lat: 25.2150, lng: 55.4230 };
  const path = [a, ...Sim.planRoute(S, a, b)];
  for (let i = 1; i < path.length; i++) for (let t = 0; t <= 1; t += 0.02) {
    const p = { lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t, lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t };
    assert(Sim.dist(p, dxb) >= dxb.r, 'route enters DXB zone');
  }
  assert(path.length > 2, 'expected a detour around DXB');
}

// 2. nearest pod wins; skipped when its drones lack battery
{
  const S = Sim.create();
  const m = Sim.MERCHANTS[0]; // Marina — nearest pod P-01
  S.drones.forEach(d => { d.battery = 100; });
  let o = Sim.addOrder(S, { merchant: m, drop: { name: 't', lat: 25.0880, lng: 55.1475 }, kg: 1 });
  Sim.dispatch(S);
  assert.strictEqual(o.podId, 'P-01');
  S.drones.filter(d => d.podId === 'P-01').forEach(d => { d.battery = 41; });
  o = Sim.addOrder(S, { merchant: m, drop: { name: 't', lat: 25.0700, lng: 55.1680 }, kg: 1 });
  Sim.dispatch(S);
  assert.notStrictEqual(o.podId, 'P-01');
  assert(o.trace.some(t => !t[0] && t[1].startsWith('P-01')), 'trace should explain skipping P-01');
}

// 3. drop-off inside restricted airspace → ground courier
{
  const S = Sim.create();
  const o = Sim.addOrder(S, { drop: { name: 'Al Qusais', lat: 25.2800, lng: 55.3800 } });
  assert.strictEqual(o.status, 'fallback');
}

// 4. low battery at pod → auto-routed to energy hub → swapped to 100%
{
  const S = Sim.create();
  S.nextOrder = 1e9;
  const d = S.drones[0];
  d.battery = 30;
  Sim.tick(S, 1);
  assert.strictEqual(d.status, 'to-hub');
  for (let i = 0; i < 1800 && d.battery < 100; i++) Sim.tick(S, 1);
  assert.strictEqual(d.battery, 100);
}

// 5. long run: no crashes, deliveries happen, batteries sane, nobody flies inside a zone
{
  const S = Sim.create({ seed: 3 });
  Sim.addZone(S, 25.1960, 55.2740, 900); // TFR over Downtown mid-run
  let hours = 0;
  for (let i = 0; i < 6 * 3600; i++) {
    Sim.tick(S, 1);
    if (i === 3600) Sim.setStorm(S, true);
    if (i === 4200) Sim.setStorm(S, false);
    if (i % 1800 === 0) Sim.injectFault(S);
    if (i % 60) continue;
    for (const d of S.drones) {
      assert(d.battery >= 0 && d.battery <= 100, `${d.id} battery ${d.battery}`);
      if (Sim.airborne(d) && d.status !== 'fault' && d.legs[0]?.kind === 'fly')
        for (const z of S.zones) if (z.active && z.kind !== 'tfr') assert(!Sim.inside(d, z), `${d.id} inside ${z.id}`);
    }
    hours = i / 3600;
  }
  const st = S.stats;
  assert(!st.depleted, `${st.depleted} drones ran flat`);
  assert(st.delivered > 200, `only ${st.delivered} delivered`);
  assert(S.hub.swaps > 20, 'hub never used');
  console.log(`ok — ${hours.toFixed(0)}h sim: ${st.delivered} delivered, ${S.hub.swaps} swaps, on-time ${(100 * st.onTime / st.delivered).toFixed(0)}%, avg ${(st.totalMin / st.delivered).toFixed(1)} min, ${st.sep} separations, ${st.ta} TAs, ${st.fallback} fallback, queued ${S.orders.filter(o => o.status === 'queued').length}`);
}
