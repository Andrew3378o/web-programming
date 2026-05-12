require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const passport   = require('passport');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

require('../config/passport'); 

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
    },
  },
}));

app.use(cors({
  origin:      process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'city-lighting-secret-key-2025',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   false,  
    httpOnly: true,    
    maxAge:   1000 * 60 * 60 * 8, 
    sameSite: 'lax',  
  },
}));

app.use(passport.initialize());
app.use(passport.session());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { error: 'Забагато запитів. Спробуйте пізніше.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use(globalLimiter);

app.use(express.static(path.join(__dirname, '../public')));

app.use('/auth', require('../routes/auth'));
app.use('/api',  require('../routes/api'));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});
