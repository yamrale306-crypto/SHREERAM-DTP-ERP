const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const { register } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

// List users for admin management
router.get('/', (req, res) => {
  const db = getDatabase();

  db.all(
    `SELECT id, username, email, role, google_id, created_at
     FROM users
     ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json(rows);
    }
  );
});

// Create user
router.post('/', async (req, res) => {
  const { username, password, role, email } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const created = await register(username, password, role || 'user');

    if (email) {
      const db = getDatabase();
      db.run(
        'UPDATE users SET email = ? WHERE id = ?',
        [email, created.id],
        (err) => {
          if (err) {
            return res.status(400).json({ error: 'User created, but email could not be saved' });
          }

          res.status(201).json({
            ...created,
            email,
            message: 'User created successfully'
          });
        }
      );
      return;
    }

    res.status(201).json({
      ...created,
      message: 'User created successfully'
    });
  } catch (error) {
    res.status(400).json(error);
  }
});

// Update user role
router.put('/:id/role', (req, res) => {
  const db = getDatabase();
  const userId = Number(req.params.id);
  const { role } = req.body;

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Valid role is required' });
  }

  if (req.user.id === userId && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin role' });
  }

  db.run(
    'UPDATE users SET role = ? WHERE id = ?',
    [role, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User role updated successfully' });
    }
  );
});

// Reset user password
router.post('/:id/reset-password', (req, res) => {
  const db = getDatabase();
  const userId = Number(req.params.id);
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'UPDATE users SET password = ? WHERE id = ?',
    [hashedPassword, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'Password reset successfully' });
    }
  );
});

module.exports = router;
