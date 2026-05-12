const express  = require('express');
const router   = express.Router();
const { body, validationResult } = require('express-validator');
const { isAuthenticated, hasRole } = require('../middleware/auth');
const { sanitizeBody, geoCheck, requestLogger } = require('../middleware/security');

router.use(requestLogger);
router.use(geoCheck);
router.use(sanitizeBody);

const zones = [
  { id: 1, name: 'Хрещатик — центр',       district: 'Шевченківський', lights: 42, activeLights: 40, brightness: 80, status: 'active'  },
  { id: 2, name: 'Оболонський проспект',    district: 'Оболонський',    lights: 36, activeLights: 35, brightness: 70, status: 'active'  },
  { id: 3, name: 'Площа Перемоги',          district: 'Шевченківський', lights: 28, activeLights: 22, brightness: 60, status: 'partial' },
  { id: 4, name: 'Печерська набережна',     district: 'Печерський',     lights: 50, activeLights: 50, brightness: 90, status: 'active'  },
  { id: 5, name: 'Солом\'янська площа',     district: 'Солом\'янський', lights: 20, activeLights: 0,  brightness:  0, status: 'offline' },
];

const maintenanceReports = [];
let reportId = 1;

router.get('/lighting/zones', isAuthenticated, (req, res) => {
  res.json({
    zones,
    summary: {
      totalZones:   zones.length,
      activeZones:  zones.filter(z => z.status === 'active').length,
      offlineZones: zones.filter(z => z.status === 'offline').length,
      avgBrightness: Math.round(zones.reduce((s, z) => s + z.brightness, 0) / zones.length),
    },
  });
});

router.post('/lighting/dimming',
  hasRole('dispatcher', 'city_admin'),
  body('zoneId').isInt({ min: 1 }).withMessage('Невірний ID зони'),
  body('brightness').isInt({ min: 0, max: 100 }).withMessage('Яскравість: 0–100'),

  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { zoneId, brightness } = req.body;
    const zone = zones.find(z => z.id === Number(zoneId));
    if (!zone) return res.status(404).json({ error: 'Зону не знайдено' });

    zone.brightness = brightness;
    zone.status = brightness === 0 ? 'offline' : brightness < 50 ? 'partial' : 'active';

    console.log(`[DIMMING] Zone ${zone.name} → ${brightness}% by ${req.user.email}`);

    res.json({
      message:    `Яскравість зони "${zone.name}" встановлено на ${brightness}%`,
      zone,
      changedBy:  req.user.email,
      changedAt:  new Date().toISOString(),
    });
  }
);

router.post('/maintenance/report',
  hasRole('electrician'),
  body('zoneId').isInt({ min: 1 }).withMessage('Невірний ID зони'),
  body('description').notEmpty().trim().escape()
    .withMessage('Опис несправності є обов\'язковим'),
  body('severity').isIn(['low', 'medium', 'high'])
    .withMessage('Рівень серйозності: low | medium | high'),

  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { zoneId, description, severity } = req.body;
    const zone = zones.find(z => z.id === Number(zoneId));
    if (!zone) return res.status(404).json({ error: 'Зону не знайдено' });

    const report = {
      id:          reportId++,
      zoneId:      Number(zoneId),
      zoneName:    zone.name,
      description,
      severity,
      reportedBy:  req.user.email,
      reportedAt:  new Date().toISOString(),
      status:      'open',
    };
    maintenanceReports.push(report);

    res.status(201).json({ message: 'Звіт про технічне обслуговування створено', report });
  }
);

router.get('/budget/forecast', hasRole('city_admin'), (req, res) => {
  const totalLights   = zones.reduce((s, z) => s + z.lights, 0);
  const activeLights  = zones.reduce((s, z) => s + z.activeLights, 0);
  const avgBrightness = zones.reduce((s, z) => s + z.brightness, 0) / zones.length;

  const kWhPerHour  = activeLights * 0.15 * (avgBrightness / 100);
  const nightHours  = 10; 
  const tariff      = 4.32;
  const dailyCost   = kWhPerHour * nightHours * tariff;
  const monthlyCost = dailyCost * 30;
  const yearlyCost  = dailyCost * 365;

  res.json({
    forecast: {
      totalLights,
      activeLights,
      avgBrightnessPercent: Math.round(avgBrightness),
      energyKWhPerNight:    Math.round(kWhPerHour * nightHours),
      costPerDayUAH:        Math.round(dailyCost),
      costPerMonthUAH:      Math.round(monthlyCost),
      costPerYearUAH:       Math.round(yearlyCost),
      tariffUAHperKWh:      tariff,
    },
    maintenanceReports: maintenanceReports.filter(r => r.status === 'open').length,
    generatedAt: new Date().toISOString(),
  });
});

router.get('/users', hasRole('city_admin'), (req, res) => {
  const User = require('../models/User');
  res.json({ users: User.findAll() });
});

router.get('/maintenance/reports',
  hasRole('dispatcher', 'city_admin'),
  (req, res) => {
    res.json({ reports: maintenanceReports });
  }
);

module.exports = router;
