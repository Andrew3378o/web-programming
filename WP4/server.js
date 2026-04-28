const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'devices.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.url}`);
  next();
});

function readDevices() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeDevices(devices) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2), 'utf8');
}

if (!fs.existsSync(DATA_FILE)) {
  const initial = [
    {
      id: 1,
      name: 'РЗА-101 Лінія Л-1',
      protectionType: 'overcurrent',
      settings: { currentThreshold: 450, timeDelay: 0.5, voltage: 10 },
      status: 'armed',
      lastOperation: '2025-03-15T08:22:00Z',
      faultType: 'phase-to-ground',
      operationTime: 52,
      eventLog: [
        { time: '2025-03-15T08:22:00Z', event: 'Спрацювання МСЗ', result: 'Відключення' },
        { time: '2025-01-10T14:05:00Z', event: 'Самодіагностика', result: 'Норма' }
      ]
    },
    {
      id: 2,
      name: 'РЗА-202 Трансформатор Т-2',
      protectionType: 'differential',
      settings: { differentialCurrent: 0.3, breakingCurrent: 5, harmonicRestraint: true },
      status: 'armed',
      lastOperation: '2024-11-20T03:11:00Z',
      faultType: 'inter-turn',
      operationTime: 28,
      eventLog: [
        { time: '2024-11-20T03:11:00Z', event: 'Диференційний захист', result: 'Відключення' }
      ]
    },
    {
      id: 3,
      name: 'РЗА-303 Лінія 110 кВ',
      protectionType: 'distance',
      settings: { zone1reach: 80, zone2reach: 120, zone3reach: 200, zone1time: 0, zone2time: 0.4 },
      status: 'blocked',
      lastOperation: null,
      faultType: null,
      operationTime: null,
      eventLog: [
        { time: '2025-04-01T09:00:00Z', event: 'Блокування', result: 'Оперативне блокування' }
      ]
    }
  ];
  writeDevices(initial);
}

app.get('/api/protection-devices', (req, res) => {
  try {
    let devices = readDevices();
    const { status, protectionType, search } = req.query;

    if (status) devices = devices.filter(d => d.status === status);
    if (protectionType) devices = devices.filter(d => d.protectionType === protectionType);
    if (search) {
      const q = search.toLowerCase();
      devices = devices.filter(d => d.name.toLowerCase().includes(q));
    }

    res.json({ success: true, count: devices.length, data: devices });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Помилка сервера', error: err.message });
  }
});

app.get('/api/protection-devices/:id', (req, res) => {
  try {
    const devices = readDevices();
    const device = devices.find(d => d.id === parseInt(req.params.id));
    if (!device) return res.status(404).json({ success: false, message: 'Пристрій не знайдено' });
    res.json({ success: true, data: device });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/protection-devices/:id/events', (req, res) => {
  try {
    const devices = readDevices();
    const device = devices.find(d => d.id === parseInt(req.params.id));
    if (!device) return res.status(404).json({ success: false, message: 'Пристрій не знайдено' });
    res.json({
      success: true,
      deviceName: device.name,
      totalEvents: device.eventLog.length,
      events: device.eventLog
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/protection-devices', (req, res) => {
  try {
    const { name, protectionType, settings } = req.body;
    if (!name || !protectionType) {
      return res.status(400).json({
        success: false,
        message: 'Відсутні обов\'язкові поля',
        required: ['name', 'protectionType']
      });
    }
    const validTypes = ['overcurrent', 'differential', 'distance'];
    if (!validTypes.includes(protectionType)) {
      return res.status(400).json({
        success: false,
        message: `Невірний тип захисту. Допустимі: ${validTypes.join(', ')}`
      });
    }

    const devices = readDevices();
    const newDevice = {
      id: devices.length > 0 ? Math.max(...devices.map(d => d.id)) + 1 : 1,
      name,
      protectionType,
      settings: settings || {},
      status: 'armed',
      lastOperation: null,
      faultType: null,
      operationTime: null,
      eventLog: [{ time: new Date().toISOString(), event: 'Реєстрація в системі', result: 'Успішно' }]
    };
    devices.push(newDevice);
    writeDevices(devices);
    res.status(201).json({ success: true, message: 'Пристрій зареєстровано', data: newDevice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/protection-devices/:id/settings', (req, res) => {
  try {
    const devices = readDevices();
    const index = devices.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Пристрій не знайдено' });

    devices[index].settings = { ...devices[index].settings, ...req.body };
    devices[index].eventLog.push({
      time: new Date().toISOString(),
      event: 'Зміна уставок',
      result: 'Оновлено'
    });
    writeDevices(devices);
    res.json({ success: true, message: 'Уставки оновлено', data: devices[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/protection-devices/:id', (req, res) => {
  try {
    const devices = readDevices();
    const index = devices.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Пристрій не знайдено' });

    const { status } = req.body;
    if (status) {
      const validStatuses = ['armed', 'blocked', 'triggered'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `Недопустимий статус. Допустимі: ${validStatuses.join(', ')}` });
      }
    }
    devices[index] = { ...devices[index], ...req.body, id: devices[index].id, eventLog: devices[index].eventLog };
    devices[index].eventLog.push({ time: new Date().toISOString(), event: 'Оновлення параметрів', result: 'Успішно' });
    writeDevices(devices);
    res.json({ success: true, message: 'Параметри оновлено', data: devices[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/protection-devices/:id/test', (req, res) => {
  try {
    const devices = readDevices();
    const index = devices.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Пристрій не знайдено' });

    const testPassed = Math.random() > 0.15; 
    const testTime = Math.floor(Math.random() * 30) + 10;
    const result = testPassed ? 'Тест пройдено успішно' : 'Відмова під час тесту';
    devices[index].eventLog.push({
      time: new Date().toISOString(),
      event: 'Тестування пристрою',
      result,
      testTime: `${testTime} мс`
    });
    writeDevices(devices);
    res.json({
      success: true,
      testPassed,
      testTime,
      result,
      device: devices[index].name
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/protection-devices/:id', (req, res) => {
  try {
    const devices = readDevices();
    const index = devices.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Пристрій не знайдено' });

    const deleted = devices.splice(index, 1)[0];
    writeDevices(devices);
    res.json({ success: true, message: 'Пристрій видалено', data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`   REST API сервер РЗА запущено: http://localhost:${PORT}`);
  console.log('   Доступні endpoints:');
  console.log('   GET    /api/protection-devices');
  console.log('   GET    /api/protection-devices/:id');
  console.log('   GET    /api/protection-devices/:id/events');
  console.log('   POST   /api/protection-devices');
  console.log('   PUT    /api/protection-devices/:id/settings');
  console.log('   PATCH  /api/protection-devices/:id');
  console.log('   POST   /api/protection-devices/:id/test');
  console.log('   DELETE /api/protection-devices/:id');
});
