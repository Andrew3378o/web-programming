function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Необхідна автентифікація' });
}

/**
 * Require the user to have one of the given roles.
 * @param {...string} roles
 */
function hasRole(...roles) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Необхідна автентифікація' });
    }
    if (roles.includes(req.user.role)) return next();
    res.status(403).json({ error: 'Недостатньо прав доступу' });
  };
}

function allowHours(fromHour, toHour) {
  return (req, res, next) => {
    const kyivHour = new Date().toLocaleString('uk-UA', {
      timeZone: 'Europe/Kyiv', hour: 'numeric', hour12: false,
    });
    const hour = parseInt(kyivHour, 10);
    if (hour >= fromHour && hour < toHour) return next();
    res.status(403).json({
      error: `Доступ дозволено лише з ${fromHour}:00 до ${toHour}:00 (Kyiv)`,
    });
  };
}

module.exports = { isAuthenticated, hasRole, allowHours };
