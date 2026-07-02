const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

// Get all customers
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    'SELECT * FROM customers ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Get single customer
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    'SELECT * FROM customers WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      res.json(row);
    }
  );
});

// Create customer
router.post('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const {
    name,
    phone,
    email,
    city,
    address,
    gstin,
    customer_type,
    status
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  db.run(
    `INSERT INTO customers (name, phone, email, city, address, gstin, customer_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, phone, email, city, address, gstin, customer_type || 'Regular', status || 'active'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.status(201).json({
        id: this.lastID,
        name,
        message: 'Customer created successfully'
      });
    }
  );
});

// Update customer
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const {
    name,
    phone,
    email,
    city,
    address,
    gstin,
    customer_type,
    status
  } = req.body;

  db.run(
    `UPDATE customers SET 
      name = ?, phone = ?, email = ?, city = ?, address = ?, 
      gstin = ?, customer_type = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [name, phone, email, city, address, gstin, customer_type, status, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      res.json({ message: 'Customer updated successfully' });
    }
  );
});

// Delete customer
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.run(
    'DELETE FROM customers WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      res.json({ message: 'Customer deleted successfully' });
    }
  );
});

// Get customer statistics
router.get('/stats/summary', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const stats = {};
  
  db.get('SELECT COUNT(*) as total FROM customers', (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    stats.total = row.total;
    
    db.get("SELECT COUNT(*) as active FROM customers WHERE status = 'active'", (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      stats.active = row.active;
      
      // Get outstanding amount from invoices
      db.get(
        `SELECT COALESCE(SUM(i.total - i.received), 0) as outstanding 
         FROM invoices i 
         WHERE i.status != 'paid'`,
        (err, row) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          stats.outstanding = row.outstanding;
          
          // Get overdue count
          db.get(
            `SELECT COUNT(*) as overdue 
             FROM invoices 
             WHERE status != 'paid' AND due_date < date('now')`,
            (err, row) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              stats.overdue = row.overdue;
              res.json(stats);
            }
          );
        }
      );
    });
  });
});

module.exports = router;