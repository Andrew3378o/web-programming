export function createConsumptionChart(canvas) {
  const ctx = canvas.getContext("2d");
  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Споживання (кВт)",
          data: [],
          borderColor: "rgb(13, 110, 253)",
          backgroundColor: "rgba(13, 110, 253, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { title: { display: true, text: "Час" } },
        y: { beginAtZero: true, title: { display: true, text: "кВт" } }
      }
    }
  });

  function pushPoint({ label, value, maxPoints = 30 }) {
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(value);
    while (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update();
  }

  return { chart, pushPoint };
}

