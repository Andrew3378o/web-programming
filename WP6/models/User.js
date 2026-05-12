const bcrypt = require('bcryptjs');

const SALT_ROUNDS    = parseInt(process.env.BCRYPT_ROUNDS) || 10;
const MAX_ATTEMPTS   = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_MINUTES = 30;

let users = [];
let nextId = 1;

const ROLES = ['electrician', 'dispatcher', 'city_admin'];

async function seedUsers() {
  const seed = [
    { email: 'admin@city.gov.ua',       password: 'Admin1234!',       name: 'Адмін Міста',        role: 'city_admin'  },
    { email: 'dispatcher@city.gov.ua',  password: 'Dispatch1234!',    name: 'Диспетчер Іваненко', role: 'dispatcher'  },
    { email: 'electrician@city.gov.ua', password: 'Electric1234!',    name: 'Електрик Петренко',  role: 'electrician' },
  ];
  for (const s of seed) {
    const hashed = await bcrypt.hash(s.password, SALT_ROUNDS);
    users.push({
      id:            nextId++,
      email:         s.email,
      password:      hashed,
      name:          s.name,
      role:          s.role,
      failedAttempts: 0,
      lockedUntil:   null,
      createdAt:     new Date().toISOString(),
    });
  }
}

seedUsers().catch(console.error);

function findById(id) {
  return users.find(u => u.id === id) || null;
}

function findByEmail(email) {
  return users.find(u => u.email === email.toLowerCase()) || null;
}

function findAll() {
  return users.map(safe);
}

async function create({ email, password, name, role }) {
  if (!ROLES.includes(role)) throw new Error('Невідома роль');
  if (findByEmail(email))   throw new Error('Користувач вже існує');

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = {
    id:            nextId++,
    email:         email.toLowerCase(),
    password:      hashed,
    name,
    role,
    failedAttempts: 0,
    lockedUntil:   null,
    createdAt:     new Date().toISOString(),
  };
  users.push(user);
  return safe(user);
}

function recordFailedLogin(email) {
  const user = findByEmail(email);
  if (!user) return;
  user.failedAttempts = (user.failedAttempts || 0) + 1;
  if (user.failedAttempts >= MAX_ATTEMPTS) {
    user.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
    console.warn(`[SECURITY] Account locked: ${email} (${user.failedAttempts} attempts)`);
  }
}

function resetFailedLogins(email) {
  const user = findByEmail(email);
  if (!user) return;
  user.failedAttempts = 0;
  user.lockedUntil   = null;
}

function safe(u) {
  const { password, ...rest } = u;
  return rest;
}

module.exports = { findById, findByEmail, findAll, create, recordFailedLogin, resetFailedLogins };
