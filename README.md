# Drone Logistics OS (client demo)

A live Super Admin command center for autonomous drone delivery in Dubai. It runs a real simulation:
9 drone pods, 1 battery-swap Energy Hub, 36 drones, live orders, no-fly zones and manned air traffic.

## Run it

- Windows: double-click `start-demo.bat`. It opens http://localhost:8765.
- Any OS: `python -m http.server 8765` in this folder, then open http://localhost:8765
- Needs internet for the map tiles and the CDN libraries. Use Chrome, full screen (F11), 1366 px wide or larger.
- `node test-sim.js` runs the engine self-check: a 6-hour stress run with a sandstorm, faults and a TFR.

Keys: `Space` pauses or resumes. `Esc` clears the selection. The sun/moon button (top right) switches light and dark mode, and the browser remembers the choice.

## 6-minute demo script

1. **The overview (30 s).** "This is Dubai live. Nine SkyPods, one Energy Hub in Meydan, 36 drones." Point at the KPI strip, the red no-fly cylinders over DXB and Zabeel, and the airliner descending on the DXB glide path.
2. **Auto-dispatch (60 s).** Click **Customer app**, choose Pharmacy, then **Request drone**. The Dispatch Engine card on the right shows the nearest-pod decision: which pods it skipped and why (no drone, payload, battery), which drone it picked, and the energy plan. The camera then follows the drone, with a live feed and telemetry.
3. **Battery automation (60 s).** In the drone card, click **Simulate low battery**. The system either finishes the delivery and then goes to the hub, or diverts at once and re-dispatches the parcel. Then open **Pods & Energy** to show the robotic swap bays, the pack inventory and fleet rebalancing.
4. **Airspace (60 s).** Click **Declare TFR** and click on Downtown. Routes are re-planned live, and the pod inside the zone is suspended. Open **Airspace** to show the altitude layers (90 m eastbound, 120 m westbound), separation events and helicopter traffic advisories.
5. **Resilience (60 s).** Click **Inject fault**: the drone makes an emergency landing and its order is re-dispatched automatically. Click **Sandstorm**: operations are suspended, every drone returns to a pod and orders are held. Click **Clear weather** to resume.
6. **Close (30 s).** Show **Analytics**. Then click **Cinematic** and leave the 3D skyline tour running while you talk commercials.

## What is real vs simulated (be upfront if asked)

- Real: the dispatch algorithm, energy-feasibility checks, geofence routing, separation logic and swap queue. These are the product's core logic and run in `sim.js`.
- Simulated: the drones, telemetry, orders and ADS-B traffic. The history before load is synthetic. The camera feed is AI-generated footage.
- Production integrations still to build: the drone autopilot SDK (PX4/ArduPilot/DJI), the GCAA/DCAA UTM and Remote-ID feeds, real ADS-B, a merchant/order API and the pod hardware controller.

## Talking point for the quote

The client's spec has a single Energy Hub. That caps range: drones at far pods (Marina, Al Warqa) spend more time flying back and forth to the hub. The engine already guarantees no drone runs flat. Phase 2 upsell: add swap stations at the edge pods to lift throughput.
