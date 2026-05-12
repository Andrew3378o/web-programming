const express    = require('express');
const router     = express.Router();
const passport   = require('passport');
const rateLimit  = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User       = require('../models/User');
const { requestLogger } = require('../middleware/security');

router.use(requestLogger);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   
  max:      5,                 
  message:  { error: 'Забагато спроб входу. Спробуйте через 15 хвилин.' },
  keyGenerator: (req) => req.body.email || req.ip,
  standardHeaders: true,
  legacyHeaders:   false,
});

router.post('/register',
  body('email').isEmail().normalizeEmail()
    .withMessage('Введіть коректний email'),
  body('password')
    .isLength({ min: 8 })
    .matches(/[A-Z]/).withMessage('Пароль повинен містити велику літеру')
    .matches(/[0-9]/).withMessage('Пароль повинен містити цифру')
    .matches(/[^A-Za-z0-9]/).withMessage('Пароль повинен містити спецсимвол'),
  body('name').notEmpty().trim().escape()
    .withMessage("Ім'я є обов'язковим"),
  body('role').isIn(['electrician', 'dispatcher', 'city_admin'])
    .withMessage('Невідома роль'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password, name, role } = req.body;
      const user = await User.create({ email, password, name, role });
      res.status(201).json({
        message: 'Реєстрацію успішно виконано',
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (err) {
      if (err.message === 'Користувач вже існує') {
        return res.status(409).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/login',
  loginLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || 'Помилка автентифікації' });
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.json({
          message: 'Вхід успішний',
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
      });
    })(req, res, next);
  }
);

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err.message });
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Вихід успішний' });
    });
  });
});

router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({
      authenticated: true,
      user: { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role },
    });
  }
  res.json({ authenticated: false });
});

module.exports = router;
