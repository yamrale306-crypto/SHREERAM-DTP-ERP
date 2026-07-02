const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'shreeram-dtp-erp-secret-key-2024';

function loadEnvFromDisk() {
  const candidates = [
    process.env.ERP_ENV_PATH,
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), '.env')
  ];

  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) {
      continue;
    }

    const parsed = dotenv.parse(fs.readFileSync(candidate, 'utf8'));
    Object.entries(parsed).forEach(([key, value]) => {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });

    break;
  }
}

function getGoogleConfig() {
  loadEnvFromDisk();

  const db = getDatabase();
  let clientId = process.env.GOOGLE_CLIENT_ID || '';
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  let callbackUrl = process.env.GOOGLE_CALLBACK_URL || `http://127.0.0.1:${process.env.PORT || 3000}/api/auth/google/callback`;

  try {
    const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('google_client_id', 'google_client_secret', 'google_callback_url')").all();
    rows.forEach((row) => {
      if (row.key === 'google_client_id') clientId = row.value || clientId;
      if (row.key === 'google_client_secret') clientSecret = row.value || clientSecret;
      if (row.key === 'google_callback_url') callbackUrl = row.value || callbackUrl;
    });
  } catch (error) {
    // Ignore database lookup issues and fall back to env values.
  }

  return {
    clientId,
    clientSecret,
    callbackUrl
  };
}

function buildGoogleUser(profile) {
  const email = profile.emails?.[0]?.value || null;
  const displayName = profile.displayName || 'Google User';
  const baseUsername = (displayName || email || 'googleuser').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const username = `${baseUsername}_${Math.random().toString(36).slice(2, 7)}`;
  const randomPassword = bcrypt.hashSync(Math.random().toString(36), 10);

  return {
    username,
    email,
    password: randomPassword,
    google_id: profile.id,
    profile_picture: profile.photos?.[0]?.value || '',
    role: 'user'
  };
}

function registerGoogleStrategy() {
  const { clientId, clientSecret, callbackUrl } = getGoogleConfig();

  if (!clientId || !clientSecret) {
    return false;
  }

  passport.use(new GoogleStrategy({
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: callbackUrl
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const db = getDatabase();
        const email = profile.emails?.[0]?.value || null;

        db.get(
          'SELECT * FROM users WHERE google_id = ? OR email = ?',
          [profile.id, email],
          (err, existingUser) => {
            if (err) {
              return done(err, null);
            }

            if (existingUser) {
              db.run(
                'UPDATE users SET google_id = ?, profile_picture = ?, email = ? WHERE id = ?',
                [profile.id, profile.photos?.[0]?.value || '', email, existingUser.id],
                (err) => {
                  if (err) {
                    return done(err, null);
                  }
                  return done(null, { ...existingUser, email, profile_picture: profile.photos?.[0]?.value || '' });
                }
              );
              return;
            }

            const newUser = buildGoogleUser(profile);
            db.run(
              `INSERT INTO users (username, email, password, google_id, profile_picture, role)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                newUser.username,
                newUser.email,
                newUser.password,
                newUser.google_id,
                newUser.profile_picture,
                newUser.role
              ],
              function(err) {
                if (err) {
                  return done(err, null);
                }

                db.get(
                  'SELECT * FROM users WHERE id = ?',
                  [this.lastID],
                  (err, createdUser) => {
                    if (err) {
                      return done(err, null);
                    }
                    return done(null, createdUser);
                  }
                );
              }
            );
          }
        );
      } catch (error) {
        return done(error, null);
      }
    }
  ));

  return true;
}

registerGoogleStrategy();

// Google Login Route
router.get('/google', (req, res, next) => {
  const { clientId, clientSecret } = getGoogleConfig();

  if (!clientId || !clientSecret) {
    const wantsJson = req.headers.accept?.includes('application/json') || req.xhr || req.query.format === 'json';

    if (wantsJson) {
      return res.status(503).json({
        configured: false,
        message: 'Google login is not configured for this installation. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.'
      });
    }

    return res.redirect('/?error=google_not_configured');
  }

  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Google Callback Route
router.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/?error=google_auth_failed' }),
  (req, res) => {
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: req.user.id, 
        username: req.user.username, 
        email: req.user.email,
        role: req.user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Redirect to frontend with token
    res.redirect(`/?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      profile_picture: req.user.profile_picture
    }))}`);
  }
);

// Get Google Auth URL
router.get('/google/url', (req, res) => {
  const { clientId, clientSecret, callbackUrl } = getGoogleConfig();

  if (!clientId || !clientSecret) {
    return res.json({ configured: false, url: null, callbackUrl });
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&response_type=code` +
    `&scope=profile email`;
  
  res.json({ configured: true, url: googleAuthUrl, callbackUrl });
});

module.exports = router;
