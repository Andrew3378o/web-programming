const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data', 'producers.json');

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeData(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

app.get('/api/producers', (req, res) => {
  res.json(readData());
});

app.post('/api/producers', (req, res) => {
  try {
    const power = parseFloat(req.body.power);
    const tariff = parseFloat(req.body.tariff);
    const hoursPerYear = parseFloat(req.body.hoursPerYear);

    const annualGeneration = parseFloat((power * hoursPerYear).toFixed(2));
    const annualIncome = parseFloat((annualGeneration * tariff).toFixed(2));

    const entry = {
      id: Date.now().toString(),
      ownerName: req.body.ownerName,
      sourceType: req.body.sourceType,
      address: req.body.address,
      power,
      tariff,
      hoursPerYear,
      annualGeneration,
      annualIncome,
      connectionDate: req.body.connectionDate,
      registrationDate: new Date().toISOString()
    };

    const data = readData();
    data.push(entry);

    if (writeData(data)) {
      res.status(201).json({ success: true, message: 'Виробника успішно зареєстровано', data: entry });
    } else {
      throw new Error('Помилка запису даних');
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Помилка реєстрації', error: error.message });
  }
});

app.delete('/api/producers/:id', (req, res) => {
  try {
    const data = readData();
    const filtered = data.filter(p => p.id !== req.params.id);
    if (writeData(filtered)) {
      res.json({ success: true, message: 'Запис видалено' });
    } else {
      throw new Error('Помилка запису даних');
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Помилка видалення' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});
