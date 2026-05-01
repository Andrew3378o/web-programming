export class SmartLightingApi {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getJson(path) {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return res.json();
  }

  getStatus() {
    return this.getJson("/api/status");
  }

  getLamps() {
    return this.getJson("/api/lamps");
  }

  getSummary() {
    return this.getJson("/api/summary");
  }
}

export function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

