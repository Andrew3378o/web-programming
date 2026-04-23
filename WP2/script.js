const params = [
  { id: 'param0', dotId: 'dot0', min: 0,  max: 15,  normal: [2, 10],  dec: 1 },
  { id: 'param1', dotId: 'dot1', min: 0,  max: 8,   normal: [1, 7],   dec: 1 },
  { id: 'param2', dotId: 'dot2', min: 0,  max: 100, normal: [40, 90], dec: 0 },
  { id: 'param3', dotId: 'dot3', min: 18, max: 26,  normal: [20, 24], dec: 1 },
];

let autoInterval = null;
let isAutoEnabled = false;

let energyChart;
const maxDataPoints = 10;
const chartLabels = [];
const consumptionData = [];
const generationData = [];

function initChart() {
  const ctx = document.getElementById('energyChart').getContext('2d');
  Chart.defaults.color = '#bbb';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

  energyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: 'Споживання (кВт)',
          data: consumptionData,
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Генерація (кВт)',
          data: generationData,
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      scales: {
        y: { min: 0, max: 16 }
      }
    }
  });
}

function updateChart(consumption, generation, timeStr) {
  if (chartLabels.length >= maxDataPoints) {
    chartLabels.shift();
    consumptionData.shift();
    generationData.shift();
  }
  chartLabels.push(timeStr);
  consumptionData.push(consumption);
  generationData.push(generation);

  if (energyChart) energyChart.update();
}

function getRandom(min, max, dec) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

function getStatus(val, param) {
  if (val >= param.normal[0] && val <= param.normal[1]) return 'normal';
  if (val >= param.min       && val <= param.max)       return 'warning';
  return 'danger';
}

function updateBalance(consumption, generation) {
  const balance  = parseFloat((generation - consumption).toFixed(1));
  const balVal   = document.getElementById('balanceVal');
  const balLabel = document.getElementById('balanceLabel');

  balVal.textContent = (balance >= 0 ? '+' : '') + balance + ' кВт';
  balVal.className   = 'balance-value ' +
    (balance >= 0 ? 'balance-positive' : 'balance-negative');
  balLabel.textContent = balance >= 0
    ? 'Надлишок – передача в мережу'
    : 'Дефіцит – споживання з батареї/мережі';
}

function updateSavings(generation) {
  const TARIFF    = 4.32;
  const SUN_HOURS = 8;
  const savings   = Math.round(generation * SUN_HOURS * TARIFF);
  document.getElementById('savingsVal').textContent = savings + ' грн/день';
}

function updateAC(temp) {
  const acEl     = document.getElementById('acStatus');
  const acReason = document.getElementById('acReason');

  if (temp > 23) {
    acEl.textContent     = 'УВІМКНЕНО';
    acEl.className       = 'ac-status ac-on';
    acReason.textContent = 'Охолодження: ' + temp + '°C > 23°C';
  } else if (temp < 20) {
    acEl.textContent     = 'ОБІГРІВ';
    acEl.className       = 'ac-status ac-on';
    acReason.textContent = 'Обігрів: ' + temp + '°C < 20°C';
  } else {
    acEl.textContent     = 'ВИМКНЕНО';
    acEl.className       = 'ac-status ac-off';
    acReason.textContent = 'Температура ' + temp + '°C в нормі';
  }
}

function updateAll() {
  const timeStr = new Date().toLocaleTimeString('uk-UA');

  const values = params.map(param => {
    const val = getRandom(param.min, param.max, param.dec);
    document.getElementById(param.id).textContent = val;
    document.getElementById(param.dotId).className =
      'status-dot status-' + getStatus(val, param);
    return val;
  });

  updateBalance(values[0], values[1]);
  updateSavings(values[1]);
  updateAC(values[3]);
  updateChart(values[0], values[1], timeStr);

  document.getElementById('lastUpdate').textContent = timeStr;
}

function toggleAuto() {
  const btn    = document.getElementById('autoUpdateBtn');
  const status = document.getElementById('autoStatus');

  if (!isAutoEnabled) {
    autoInterval  = setInterval(updateAll, 3000);
    isAutoEnabled = true;
    btn.textContent    = 'Зупинити';
    btn.className      = 'btn btn-danger';
    status.textContent = 'Увімкнено (3 сек)';
  } else {
    clearInterval(autoInterval);
    isAutoEnabled = false;
    btn.textContent    = 'Автооновлення';
    btn.className      = 'btn btn-success';
    status.textContent = 'Вимкнено';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initChart();
  updateAll();
  document.getElementById('updateBtn').addEventListener('click', updateAll);
  document.getElementById('autoUpdateBtn').addEventListener('click', toggleAuto);
});