const express = require('express');
const router = express.Router();
const { login, register, authenticateToken } = require('../middleware/auth');

// Login route
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  login(username, password)
    .then(data => {
      res.json(data);
    })
    .catch(err => {
      res.status(401).json(err);
    });
});

// Register route (for creating new users)
router.post('/register', authenticateToken, (req, res) => {
  // Only admin can create new users
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can create users' });
  }

  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  register(username, password, role)
    .then(data => {
      res.status(201).json(data);
    })
    .catch(err => {
      res.status(400).json(err);
    });
});

// Verify token route
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Change password
router.post('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  const db = require('../config/database').getDatabase();
  
  db.get(
    'SELECT * FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const bcrypt = require('bcryptjs');
      const passwordMatch = bcrypt.compareSync(currentPassword, user.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      
      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, req.user.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update password' });
          }
          res.json({ message: 'Password changed successfully' });
        }
      );
    }
  );
});

module.exports = router;