import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Domain model (Variant 14: Smart Lighting) ----
// Lamp statuses:
// - ok: working
// - faulty: not working
// - offline: no telemetry
// Brightness 0..100 (%)
const kyivCenter = { lat: 50.4501, lng: 30.5234 };

function makeInitialLamps() {
  const districts = [
    "Шевченківський",
    "Печерський",
    "Солом'янський",
    "Оболонський",
    "Дніпровський",
    "Подільський"
  ];

  const lamps = [];
  for (let i = 1; i <= 30; i += 1) {
    const lat = kyivCenter.lat + randBetween(-0.06, 0.06);
    const lng = kyivCenter.lng + randBetween(-0.09, 0.09);

    const status = Math.random() < 0.06 ? "faulty" : Math.random() < 0.04 ? "offline" : "ok";
    const brightness = status === "ok" ? randBetween(35, 95) : status === "faulty" ? 0 : randBetween(0, 20);

    // Simple power model: 0.03..0.12 kW per lamp depending on brightness
    const ratedKw = randBetween(0.06, 0.12);
    const kw = status === "ok" ? ratedKw * (brightness / 100) : status === "offline" ? ratedKw * 0.05 : 0;

    lamps.push({
      id: `L-${String(i).padStart(3, "0")}`,
      district: pick(districts),
      lat,
      lng,
      status,
      brightness: Math.round(brightness),
      lux: Math.round(status === "ok" ? randBetween(12, 42) * (brightness / 100) : randBetween(0, 5)),
      kw: Number(kw.toFixed(3)),
      lastSeen: Date.now()
    });
  }
  return lamps;
}

let lamps = makeInitialLamps();
let serverStartTs = Date.now();

function recomputeSummary(now = Date.now()) {
  const active = lamps.filter((l) => l.status === "ok").length;
  const faulty = lamps.filter((l) => l.status === "faulty").length;
  const offline = lamps.filter((l) => l.status === "offline").length;
  const totalKw = lamps.reduce((acc, l) => acc + l.kw, 0);
  const avgLux = lamps.length ? lamps.reduce((acc, l) => acc + l.lux, 0) / lamps.length : 0;

  // Pretend baseline (no dimming) is 0.1kW per lamp for savings estimate
  const baselineKw = lamps.length * 0.1;
  const savingsPct = baselineKw > 0 ? clamp(((baselineKw - totalKw) / baselineKw) * 100, 0, 80) : 0;

  return {
    timestamp: now,
    activeLamps: active,
    totalLamps: lamps.length,
    faultyLamps: faulty,
    offlineLamps: offline,
    totalConsumptionKw: Number(totalKw.toFixed(3)),
    avgIlluminanceLux: Number(avgLux.toFixed(1)),
    savingsPct: Number(savingsPct.toFixed(1))
  };
}

function mutateLamps() {
  const now = Date.now();

  lamps = lamps.map((l) => {
    // Occasionally flip connectivity / failures.
    const roll = Math.random();
    let status = l.status;
    if (roll < 0.005) status = "faulty";
    else if (roll < 0.01) status = "offline";
    else if (roll < 0.03) status = "ok";

    let brightness = l.brightness;
    if (status === "ok") {
      // Simulate adaptive dimming (evening mode)
      brightness = clamp(brightness + randBetween(-8, 8), 25, 100);
    } else if (status === "offline") {
      brightness = clamp(brightness + randBetween(-5, 5), 0, 25);
    } else {
      brightness = 0;
    }

    const ratedKw = clamp(l.kw / Math.max(l.brightness, 5) * 100, 0.06, 0.12) || randBetween(0.06, 0.12);
    const kw = status === "ok" ? ratedKw * (brightness / 100) : status === "offline" ? ratedKw * 0.05 : 0;
    const lux = Math.round(status === "ok" ? randBetween(12, 42) * (brightness / 100) : randBetween(0, 5));

    return {
      ...l,
      status,
      brightness: Math.round(brightness),
      lux,
      kw: Number(kw.toFixed(3)),
      lastSeen: now
    };
  });
}

// ---- REST API ----
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    uptimeSec: Math.floor((Date.now() - serverStartTs) / 1000),
    lastUpdate: Date.now()
  });
});

app.get("/api/lamps", (req, res) => {
  res.json({ timestamp: Date.now(), lamps });
});

app.get("/api/summary", (req, res) => {
  res.json(recomputeSummary());
});

app.post("/api/lamps/:id/brightness", (req, res) => {
  const { id } = req.params;
  const level = Number(req.body?.brightness);
  if (!Number.isFinite(level)) {
    res.status(400).json({ error: "brightness must be a number" });
    return;
  }
  const brightness = Math.round(clamp(level, 0, 100));

  let found = false;
  lamps = lamps.map((l) => {
    if (l.id !== id) return l;
    found = true;
    const status = l.status === "faulty" ? "faulty" : "ok";
    const ratedKw = randBetween(0.06, 0.12);
    const kw = status === "ok" ? ratedKw * (brightness / 100) : 0;
    return {
      ...l,
      status,
      brightness,
      kw: Number(kw.toFixed(3)),
      lux: Math.round(randBetween(12, 42) * (brightness / 100)),
      lastSeen: Date.now()
    };
  });

  if (!found) {
    res.status(404).json({ error: "lamp not found" });
    return;
  }

  res.json({ ok: true, id, brightness });
});

const server = app.listen(PORT, () => {
  console.log(`Smart Lighting server: http://localhost:${PORT}`);
});

// ---- WebSocket (same port, path /ws) ----
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello", timestamp: Date.now() }));
  ws.send(JSON.stringify({ type: "snapshot", timestamp: Date.now(), lamps, summary: recomputeSummary() }));
});

setInterval(() => {
  mutateLamps();
  broadcast({
    type: "update",
    timestamp: Date.now(),
    summary: recomputeSummary(),
    lamps
  });
}, 2000);

