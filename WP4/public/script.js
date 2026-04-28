'use strict';

const API = '/api/protection-devices';

const TYPE_LABELS = {
  overcurrent:   'Струмовий (МСЗ)',
  differential:  'Диференційний',
  distance:      'Дистанційний'
};

const STATUS_LABELS = {
  armed:     'Збройований',
  triggered: 'Спрацював',
  blocked:   'Заблокований'
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('protectionType').addEventListener('change', onTypeChange);
  loadDevices();
});

function onTypeChange() {
  const type = document.getElementById('protectionType').value;
  const block = document.getElementById('settingsBlock');
  document.querySelectorAll('.settings-variant').forEach(el => el.classList.add('hidden'));
  if (type) {
    block.classList.remove('hidden');
    document.getElementById(`settings-${type}`)?.classList.remove('hidden');
  } else {
    block.classList.add('hidden');
  }
}

function collectSettings(type) {
  const g = id => {
    const v = document.getElementById(id)?.value;
    return v === '' || v == null ? undefined : Number(v);
  };
  const gb = id => document.getElementById(id)?.checked;

  if (type === 'overcurrent') return {
    currentThreshold: g('s_currentThreshold'),
    timeDelay: g('s_timeDelay'),
    voltage: g('s_voltage')
  };
  if (type === 'differential') return {
    differentialCurrent: g('s_differentialCurrent'),
    breakingCurrent: g('s_breakingCurrent'),
    harmonicRestraint: gb('s_harmonicRestraint') ?? true
  };
  if (type === 'distance') return {
    zone1reach: g('s_zone1reach'),
    zone2reach: g('s_zone2reach'),
    zone1time: g('s_zone1time'),
    zone2time: g('s_zone2time')
  };
  return {};
}

async function submitDevice() {
  const name = document.getElementById('name').value.trim();
  const protectionType = document.getElementById('protectionType').value;
  const msgEl = document.getElementById('formMessage');

  if (!name || !protectionType) {
    showMsg(msgEl, 'Заповніть обов\'язкові поля: назву та тип захисту', 'err');
    return;
  }

  const payload = { name, protectionType, settings: collectSettings(protectionType) };

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showMsg(msgEl, `Пристрій "${data.data.name}" зареєстровано (ID: ${data.data.id})`, 'ok');
      resetForm();
      loadDevices();
    } else {
      showMsg(msgEl, `${data.message}`, 'err');
    }
  } catch {
    showMsg(msgEl, 'Помилка мережі', 'err');
  }
}

function resetForm() {
  document.getElementById('name').value = '';
  document.getElementById('protectionType').value = '';
  document.querySelectorAll('.settings-variant input').forEach(el => el.value = '');
  document.getElementById('settingsBlock').classList.add('hidden');
  document.querySelectorAll('.settings-variant').forEach(el => el.classList.add('hidden'));
}

async function loadDevices() {
  const status = document.getElementById('filterStatus').value;
  const protectionType = document.getElementById('filterType').value;
  const search = document.getElementById('filterSearch').value.trim();

  let url = API;
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (protectionType) params.append('protectionType', protectionType);
  if (search) params.append('search', search);
  if ([...params].length) url += '?' + params.toString();

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      renderDevices(data.data);
      updateHeaderStats(data.data);
      document.getElementById('countBadge').textContent = data.count;
    }
  } catch {
    document.getElementById('devicesContainer').innerHTML =
      '<p class="empty-msg">Не вдалося завантажити дані</p>';
  }
}

function renderDevices(devices) {
  const container = document.getElementById('devicesContainer');
  if (!devices.length) {
    container.innerHTML = '<p class="empty-msg">Пристроїв не знайдено</p>';
    return;
  }

  container.innerHTML = devices.map(d => `
    <div class="device-card ${d.status}" id="card-${d.id}">
      <div class="card-head">
        <div>
          <div class="card-name">${escHtml(d.name)}</div>
          <div class="card-sub">ID: ${d.id} · ${TYPE_LABELS[d.protectionType] ?? d.protectionType}</div>
        </div>
        <span class="status-badge ${d.status}">${STATUS_LABELS[d.status] ?? d.status}</span>
      </div>

      <div class="card-grid">
        <div class="card-field">
          <span class="lbl">Останнє спрацювання</span>
          <span class="val">${d.lastOperation ? fmtDate(d.lastOperation) : '—'}</span>
        </div>
        <div class="card-field">
          <span class="lbl">Час спрацювання</span>
          <span class="val">${d.operationTime != null ? d.operationTime + ' мс' : '—'}</span>
        </div>
        <div class="card-field">
          <span class="lbl">Тип пошкодження</span>
          <span class="val">${escHtml(d.faultType ?? '—')}</span>
        </div>
        <div class="card-field">
          <span class="lbl">Подій у журналі</span>
          <span class="val">${d.eventLog.length}</span>
        </div>
        <div class="card-field">
          <span class="lbl">Уставок</span>
          <span class="val">${Object.keys(d.settings).length}</span>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn btn-sm btn-info" onclick="showEvents(${d.id})">Журнал</button>
        <button class="btn btn-sm btn-success" onclick="testDevice(${d.id})">Тест</button>
        <button class="btn btn-sm btn-warn" onclick="toggleBlock(${d.id}, '${d.status}')">
          ${d.status === 'blocked' ? 'Розблокувати' : 'Блокувати'}
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteDevice(${d.id})">Видалити</button>
      </div>
    </div>
  `).join('');
}

function updateHeaderStats(devices) {
  const chips = document.querySelectorAll('.stat-chip');
  const armed     = devices.filter(d => d.status === 'armed').length;
  const triggered = devices.filter(d => d.status === 'triggered').length;
  const blocked   = devices.filter(d => d.status === 'blocked').length;
  chips[0].textContent = `${armed} збройованих`;
  chips[1].textContent = `${triggered} спрацювань`;
  chips[2].textContent = `${blocked} заблокованих`;
}

async function showEvents(id) {
  try {
    const res = await fetch(`${API}/${id}/events`);
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('modalTitle').textContent = `Журнал: ${data.deviceName}`;
    document.getElementById('modalBody').innerHTML = data.events.length
      ? [...data.events].reverse().map(e => `
          <div class="event-row">
            <div class="event-time">${fmtDate(e.time)}</div>
            <div class="event-name">${escHtml(e.event)}</div>
            <div class="event-result">${escHtml(e.result)}${e.testTime ? ' · ' + e.testTime : ''}</div>
          </div>
        `).join('')
      : '<p class="empty-msg">Журнал порожній</p>';

    document.getElementById('eventsModal').classList.remove('hidden');
  } catch {
    alert('Помилка завантаження журналу');
  }
}

function closeModal() {
  document.getElementById('eventsModal').classList.add('hidden');
}

async function testDevice(id) {
  try {
    const res = await fetch(`${API}/${id}/test`, { method: 'POST' });
    const data = await res.json();
    const icon = data.testPassed ? '✅' : '❌';
    alert(`${icon} ${data.result}\nПристрій: ${data.device}\nЧас спрацювання: ${data.testTime} мс`);
    loadDevices();
  } catch {
    alert('Помилка тестування');
  }
}

async function toggleBlock(id, currentStatus) {
  const newStatus = currentStatus === 'blocked' ? 'armed' : 'blocked';
  const label = newStatus === 'blocked' ? 'заблокувати' : 'розблокувати';
  if (!confirm(`Дійсно ${label} пристрій #${id}?`)) return;

  try {
    const res = await fetch(`${API}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) loadDevices();
    else alert('Помилка: ' + data.message);
  } catch {
    alert('Помилка мережі');
  }
}

async function deleteDevice(id) {
  if (!confirm(`Видалити пристрій #${id} з реєстру?`)) return;
  try {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) loadDevices();
    else alert('Помилка: ' + data.message);
  } catch {
    alert('Помилка мережі');
  }
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
  setTimeout(() => { el.className = 'form-message hidden'; }, 5000);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

document.addEventListener('click', e => {
  if (e.target.id === 'eventsModal') closeModal();
});
