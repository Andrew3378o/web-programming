const form        = document.getElementById('producerForm');
const messageDiv  = document.getElementById('message');
const listEl      = document.getElementById('producersList');

const powerInput  = document.getElementById('power');
const tariffInput = document.getElementById('tariff');
const hoursInput  = document.getElementById('hoursPerYear');
const previewGen  = document.getElementById('previewGen');
const previewInc  = document.getElementById('previewIncome');

const SOURCE_LABELS = {
  solar:  'Сонячна електростанція',
  wind:   'Вітрова електростанція',
  biogas: 'Біогазова установка',
  hydro:  'Мала гідроелектростанція'
};

function updatePreview() {
  const p = parseFloat(powerInput.value);
  const t = parseFloat(tariffInput.value);
  const h = parseFloat(hoursInput.value);
  if (p > 0 && t > 0 && h > 0) {
    const gen    = (p * h).toFixed(0);
    const income = (p * h * t).toFixed(2);
    previewGen.textContent = Number(gen).toLocaleString('uk-UA') + ' кВт·год';
    previewInc.textContent = Number(income).toLocaleString('uk-UA') + ' грн';
  } else {
    previewGen.textContent = '—';
    previewInc.textContent = '—';
  }
}

powerInput.addEventListener('input', updatePreview);
tariffInput.addEventListener('input', updatePreview);
hoursInput.addEventListener('input', updatePreview);

document.addEventListener('DOMContentLoaded', loadProducers);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  try {
    const response = await fetch('/api/producers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (result.success) {
      showMessage('success', result.message);
      form.reset();
      updatePreview();
      loadProducers();
    } else {
      showMessage('error', result.message);
    }
  } catch {
    showMessage('error', 'Помилка з\'єднання з сервером');
  }
});

async function loadProducers() {
  try {
    const response = await fetch('/api/producers');
    const data = await response.json();
    renderProducers(data);
  } catch {
    listEl.innerHTML = '<p class="empty-state">Не вдалося завантажити дані.</p>';
  }
}

function renderProducers(producers) {
  if (producers.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Немає зареєстрованих виробників.</p>';
    return;
  }

  listEl.innerHTML = producers.map(p => `
    <div class="producer-card">
      <h3>${p.ownerName}</h3>
      <p><span class="label">Тип ВДЕ:</span> ${SOURCE_LABELS[p.sourceType] || p.sourceType}</p>
      <p><span class="label">Адреса:</span> ${p.address}</p>
      <p><span class="label">Потужність:</span> ${p.power} кВт</p>
      <p><span class="label">Тариф:</span> ${p.tariff} грн/кВт·год</p>
      <p><span class="label">Годин виробітку на рік:</span> ${p.hoursPerYear}</p>
      <p><span class="label">Дата підключення:</span> ${p.connectionDate}</p>
      <div class="income-line">
        Річна генерація: ${Number(p.annualGeneration).toLocaleString('uk-UA')} кВт·год
        &nbsp;|&nbsp; Річний дохід: ${Number(p.annualIncome).toLocaleString('uk-UA')} грн
      </div>
      <div class="card-footer">
        <span class="card-date">Зареєстровано: ${new Date(p.registrationDate).toLocaleDateString('uk-UA')}</span>
        <button class="btn-delete" onclick="deleteProducer('${p.id}')">Видалити</button>
      </div>
    </div>
  `).join('');
}

async function deleteProducer(id) {
  if (!confirm('Видалити цього виробника з реєстру?')) return;

  try {
    const response = await fetch(`/api/producers/${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (result.success) {
      showMessage('success', result.message);
      loadProducers();
    } else {
      showMessage('error', 'Помилка видалення');
    }
  } catch {
    showMessage('error', 'Помилка з\'єднання з сервером');
  }
}

function showMessage(type, text) {
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = text;
  setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
}
