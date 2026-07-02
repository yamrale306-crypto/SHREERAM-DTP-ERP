const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

// Get all settings
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    'SELECT * FROM settings',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Convert to key-value object
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = row.value;
      });
      
      res.json(settings);
    }
  );
});

// Get single setting
router.get('/:key', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    'SELECT * FROM settings WHERE key = ?',
    [req.params.key],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Setting not found' });
      }
      res.json(row);
    }
  );
});

// Get Google OAuth configuration
router.get('/google/oauth', authenticateToken, (req, res) => {
  const db = getDatabase();

  db.all(
    "SELECT key, value FROM settings WHERE key IN ('google_client_id', 'google_client_secret', 'google_callback_url')",
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const config = {};
      rows.forEach(row => {
        config[row.key] = row.value;
      });

      res.json(config);
    }
  );
});

// Save Google OAuth configuration
router.post('/google/oauth', authenticateToken, requireAdmin, (req, res) => {
  const { clientId, clientSecret, callbackUrl } = req.body || {};
  const db = getDatabase();

  if (!clientId && !clientSecret && !callbackUrl) {
    return res.status(400).json({ error: 'At least one Google OAuth field is required' });
  }

  const updates = [];
  if (clientId !== undefined) {
    updates.push(['google_client_id', clientId]);
  }
  if (clientSecret !== undefined) {
    updates.push(['google_client_secret', clientSecret]);
  }
  if (callbackUrl !== undefined) {
    updates.push(['google_callback_url', callbackUrl]);
  }

  let completed = 0;
  updates.forEach(([key, value]) => {
    db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
      [key, value, value],
      (err) => {
        if (err) {
          console.error(`Error updating Google OAuth setting ${key}:`, err);
        }
        completed++;
        if (completed === updates.length) {
          res.json({ message: 'Google OAuth settings updated successfully' });
        }
      }
    );
  });
});

// Update setting
router.put('/:key', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();
  const { value } = req.body;
  
  if (!value && value !== '') {
    return res.status(400).json({ error: 'Value is required' });
  }

  db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
    [req.params.key, value, value],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Setting updated successfully' });
    }
  );
});

// Update multiple settings
router.post('/bulk-update', authenticateToken, requireAdmin, (req, res) => {
  const db = getDatabase();
  const settings = req.body.settings;
  
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object required' });
  }

  let completed = 0;
  const total = Object.keys(settings).length;
  
  if (total === 0) {
    return res.json({ message: 'No settings to update' });
  }

  Object.entries(settings).forEach(([key, value]) => {
    db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
      [key, value, value],
      (err) => {
        if (err) {
          console.error(`Error updating setting ${key}:`, err);
        }
        completed++;
        if (completed === total) {
          res.json({ message: 'Settings updated successfully' });
        }
      }
    );
  });
});

// Get company profile
router.get('/company/profile', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    "SELECT key, value FROM settings WHERE key IN ('co_name', 'co_addr', 'co_phone', 'co_email', 'co_est', 'co_gstin', 'co_pan')",
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const profile = {};
      rows.forEach(row => {
        profile[row.key] = row.value;
      });
      
      res.json(profile);
    }
  );
});

// Get bank details
router.get('/company/bank', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    "SELECT key, value FROM settings WHERE key IN ('co_bank_name', 'co_bank_acc', 'co_bank_ifsc', 'co_bank_branch', 'co_bank_holder')",
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const bank = {};
      rows.forEach(row => {
        bank[row.key] = row.value;
      });
      
      res.json(bank);
    }
  );
});

module.exports = router;
