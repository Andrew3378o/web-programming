import { SmartLightingApi, getWsUrl } from "./api.js";
import { createConsumptionChart } from "./charts.js";
import { createLightingMap } from "./map.js";

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("uk-UA");
}

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

function statusBadgeText(status) {
  if (status === "ok") return "OK";
  if (status === "faulty") return "Несправний";
  return "Офлайн";
}

function statusPill(status) {
  const dotClass = status === "ok" ? "dot-ok" : status === "faulty" ? "dot-faulty" : "dot-offline";
  const text = statusBadgeText(status);
  return `<span class="status-pill"><span class="dot ${dotClass}"></span>${text}</span>`;
}

function applyFilters(lamps, { q, status }) {
  const query = (q || "").trim().toLowerCase();
  return lamps.filter((l) => {
    const matchQ =
      !query || l.id.toLowerCase().includes(query) || String(l.district).toLowerCase().includes(query);
    const matchStatus = status === "all" ? true : l.status === status;
    return matchQ && matchStatus;
  });
}

function renderTable(tbody, lamps) {
  if (!lamps.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary py-4">Немає записів</td></tr>`;
    return;
  }

  tbody.innerHTML = lamps
    .map((l) => {
      return `
        <tr>
          <td class="font-monospace">${l.id}</td>
          <td>${l.district}</td>
          <td>${statusPill(l.status)}</td>
          <td class="text-end">${l.brightness}</td>
          <td class="text-end">${l.lux}</td>
          <td class="text-end">${l.kw}</td>
          <td class="text-end">${fmtTime(l.lastSeen)}</td>
        </tr>
      `;
    })
    .join("");
}

function setConnBadge(state) {
  const badge = el("connBadge");
  badge.textContent = state.text;
  badge.className = `badge ${state.className}`;
}

function updateMetrics(summary) {
  el("mActive").textContent = summary.activeLamps;
  el("mTotal").textContent = summary.totalLamps;
  el("mFaulty").textContent = summary.faultyLamps;
  el("mOffline").textContent = summary.offlineLamps;
  el("mConsumption").textContent = summary.totalConsumptionKw.toFixed(3);
  el("mLux").textContent = summary.avgIlluminanceLux.toFixed(1);
  el("mSavings").textContent = summary.savingsPct.toFixed(1);
  el("mUpdated").textContent = fmtTime(summary.timestamp);
}

async function main() {
  const api = new SmartLightingApi({ baseUrl: window.location.origin });

  const wsUrl = getWsUrl();
  el("wsUrl").textContent = wsUrl;

  const { pushPoint } = createConsumptionChart(el("consumptionChart"));
  const mapUi = createLightingMap(el("map"));

  const tbody = el("lampsTbody");
  const filterInput = el("filterInput");
  const statusFilter = el("statusFilter");

  let lamps = [];
  let summary = null;

  function renderAll() {
    if (summary) updateMetrics(summary);
    const filtered = applyFilters(lamps, { q: filterInput.value, status: statusFilter.value });
    renderTable(tbody, filtered);
    mapUi.render(filtered);
  }

  function onUpdate(next) {
    if (next.summary) summary = next.summary;
    if (next.lamps) lamps = next.lamps;
    if (summary?.timestamp) {
      pushPoint({ label: fmtTime(summary.timestamp), value: summary.totalConsumptionKw });
    }
    renderAll();
  }

  setConnBadge({ text: "Завантаження…", className: "text-bg-secondary" });
  const [lampsRes, summaryRes] = await Promise.all([api.getLamps(), api.getSummary()]);
  lamps = lampsRes.lamps || [];
  summary = summaryRes;
  mapUi.fitToLamps(lamps);
  onUpdate({ lamps, summary });

  const socket = new WebSocket(wsUrl);
  socket.onopen = () => setConnBadge({ text: "WS Online", className: "text-bg-success" });
  socket.onerror = () => setConnBadge({ text: "WS Error", className: "text-bg-danger" });
  socket.onclose = () => setConnBadge({ text: "WS Offline", className: "text-bg-secondary" });

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "snapshot" || msg.type === "update") onUpdate(msg);
    } catch (e) {
      console.warn("Bad WS message", e);
    }
  };

  filterInput.addEventListener("input", renderAll);
  statusFilter.addEventListener("change", renderAll);
  el("btnFitMap").addEventListener("click", () => mapUi.fitToLamps(applyFilters(lamps, { q: "", status: "all" })));
  el("btnRefresh").addEventListener("click", async () => {
    try {
      const [lr, sr] = await Promise.all([api.getLamps(), api.getSummary()]);
      onUpdate({ lamps: lr.lamps || [], summary: sr });
    } catch (e) {
      console.error(e);
    }
  });
}

main().catch((e) => {
  console.error(e);
  setConnBadge({ text: "Помилка", className: "text-bg-danger" });
});

