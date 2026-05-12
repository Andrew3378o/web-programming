const passport       = require('passport');
const LocalStrategy  = require('passport-local').Strategy;
const bcrypt         = require('bcryptjs');
const User           = require('../models/User');

passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  async (email, password, done) => {
    try {
      const user = User.findByEmail(email);
      if (!user) {
        return done(null, false, { message: 'Невірний email або пароль' });
      }

      if (user.lockedUntil && user.lockedUntil > Date.now()) {
        const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
        return done(null, false, { message: `Акаунт заблоковано. Спробуйте через ${mins} хв.` });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        User.recordFailedLogin(email);
        return done(null, false, { message: 'Невірний email або пароль' });
      }

      User.resetFailedLogins(email);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = User.findById(id);
  if (!user) return done(null, false);
  done(null, user);
});
