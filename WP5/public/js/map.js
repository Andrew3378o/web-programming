function markerColor(status) {
  if (status === "ok") return "#198754";
  if (status === "faulty") return "#dc3545";
  return "#6c757d";
}

function makeCircleMarker(lat, lng, status) {
  return L.circleMarker([lat, lng], {
    radius: 7,
    color: markerColor(status),
    fillColor: markerColor(status),
    fillOpacity: 0.85,
    weight: 2
  });
}

export function createLightingMap(mapDiv) {
  const map = L.map(mapDiv, { zoomControl: true }).setView([50.4501, 30.5234], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  const layer = L.layerGroup().addTo(map);
  const markersById = new Map();

  function render(lamps) {
    const nextIds = new Set(lamps.map((l) => l.id));
    for (const [id, m] of markersById.entries()) {
      if (!nextIds.has(id)) {
        layer.removeLayer(m);
        markersById.delete(id);
      }
    }

    for (const l of lamps) {
      let marker = markersById.get(l.id);
      const popup = `
        <div style="min-width:220px">
          <div><b>${l.id}</b> — ${l.district}</div>
          <div>Статус: <b>${l.status}</b></div>
          <div>Яскравість: <b>${l.brightness}%</b></div>
          <div>Освітленість: <b>${l.lux} лк</b></div>
          <div>Споживання: <b>${l.kw} кВт</b></div>
        </div>
      `;

      if (!marker) {
        marker = makeCircleMarker(l.lat, l.lng, l.status).addTo(layer);
        markersById.set(l.id, marker);
      } else {
        marker.setStyle({ color: markerColor(l.status), fillColor: markerColor(l.status) });
        marker.setLatLng([l.lat, l.lng]);
      }
      marker.bindPopup(popup);
    }
  }

  function fitToLamps(lamps) {
    if (!lamps?.length) return;
    const bounds = L.latLngBounds(lamps.map((l) => [l.lat, l.lng]));
    map.fitBounds(bounds.pad(0.2));
  }

  return { map, render, fitToLamps };
}

