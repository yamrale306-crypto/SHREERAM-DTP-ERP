const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'shreeram-dtp-erp-secret-key-2024';
const JWT_EXPIRY = '7d';

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

// Login function
function login(username, password) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.get(
      'SELECT * FROM users WHERE username = ?',
      [username],
      (err, user) => {
        if (err) {
          return reject({ error: 'Database error' });
        }
        
        if (!user) {
          return reject({ error: 'Invalid username or password' });
        }

        const passwordMatch = bcrypt.compareSync(password, user.password);
        
        if (!passwordMatch) {
          return reject({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );

        resolve({
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        });
      }
    );
  });
}

// Register function (for creating new users)
function register(username, password, role = 'user') {
  return new Promise((resolve, reject) => {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const db = getDatabase();
    
    db.run(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return reject({ error: 'Username already exists' });
          }
          return reject({ error: 'Database error' });
        }
        
        resolve({
          id: this.lastID,
          username,
          role
        });
      }
    );
  });
}

module.exports = {
  authenticateToken,
  requireAdmin,
  login,
  register,
  JWT_SECRET
};
