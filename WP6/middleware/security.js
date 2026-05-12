const escapeHtml = require('escape-html');

const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|::1|localhost)/;

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = deepEscape(req.body);
  }
  next();
}

function deepEscape(obj) {
  if (typeof obj === 'string') return escapeHtml(obj);
  if (Array.isArray(obj))      return obj.map(deepEscape);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, deepEscape(v)])
    );
  }
  return obj;
}

function geoCheck(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '';
  if (PRIVATE_IP_RE.test(ip)) return next();
  console.warn(`[GEO] Public IP request: ${ip} — ${req.method} ${req.originalUrl}`);
  next();
}

function requestLogger(req, res, next) {
  const ts   = new Date().toISOString();
  const user = req.user ? `[${req.user.role}] ${req.user.email}` : 'anonymous';
  console.log(`[LOG] ${ts} | ${req.method} ${req.originalUrl} | ${user} | IP: ${req.ip}`);
  next();
}

module.exports = { sanitizeBody, geoCheck, requestLogger };
