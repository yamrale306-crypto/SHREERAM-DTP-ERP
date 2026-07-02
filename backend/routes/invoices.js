const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const invoiceController = require('../controllers/invoiceController');

// Use the controller route for invoice view
router.use('/:id/view', invoiceController);

// Get all invoices
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT i.*, c.name as customer_name 
     FROM invoices i 
     LEFT JOIN customers c ON i.customer_id = c.id 
     ORDER BY i.created_at DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Get single invoice
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    'SELECT * FROM invoices WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json(row);
    }
  );
});

// Create invoice
router.post('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const {
    invoice_number,
    customer_id,
    customer_name,
    date,
    due_date,
    type,
    subtotal,
    gst_amount,
    discount,
    extra_charges,
    total,
    received,
    status,
    payment_mode,
    notes,
    terms,
    gstin,
    customer_address,
    items
  } = req.body;

  if (!invoice_number || !customer_name || !date || !total) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  const balance = total - (received || 0);
  const finalStatus = status || (received >= total ? 'paid' : received > 0 ? 'partial' : 'unpaid');

  db.run(
    `INSERT INTO invoices (
      invoice_number, customer_id, customer_name, date, due_date, type,
      subtotal, gst_amount, discount, extra_charges, total, received, balance,
      status, payment_mode, notes, terms, gstin, customer_address, items
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoice_number, customer_id, customer_name, date, due_date, type,
      subtotal || 0, gst_amount || 0, discount || 0, extra_charges || 0,
      total, received || 0, balance, finalStatus, payment_mode || 'Cash',
      notes, terms, gstin, customer_address, JSON.stringify(items || [])
    ],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Invoice number already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.status(201).json({
        id: this.lastID,
        invoice_number,
        message: 'Invoice created successfully'
      });
    }
  );
});

// Update invoice
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const {
    customer_id,
    customer_name,
    date,
    due_date,
    type,
    subtotal,
    gst_amount,
    discount,
    extra_charges,
    total,
    received,
    status,
    payment_mode,
    notes,
    terms,
    gstin,
    customer_address,
    items
  } = req.body;

  const balance = total - (received || 0);

  db.run(
    `UPDATE invoices SET 
      customer_id = ?, customer_name = ?, date = ?, due_date = ?, type = ?,
      subtotal = ?, gst_amount = ?, discount = ?, extra_charges = ?, total = ?,
      received = ?, balance = ?, status = ?, payment_mode = ?, notes = ?, terms = ?,
      gstin = ?, customer_address = ?, items = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [
      customer_id, customer_name, date, due_date, type,
      subtotal || 0, gst_amount || 0, discount || 0, extra_charges || 0,
      total, received || 0, balance, status, payment_mode,
      notes, terms, gstin, customer_address, JSON.stringify(items || []),
      req.params.id
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json({ message: 'Invoice updated successfully' });
    }
  );
});

// Delete invoice
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.run(
    'DELETE FROM invoices WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json({ message: 'Invoice deleted successfully' });
    }
  );
});

// Get invoice statistics
router.get('/stats/summary', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const stats = {};
  
  db.get("SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as amount FROM invoices", (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    stats.total = row.total;
    stats.totalAmount = row.amount;
    
    db.get("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM invoices WHERE status = 'paid'", (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      stats.paid = row.count;
      stats.paidAmount = row.amount;
      
      db.get("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM invoices WHERE status = 'unpaid'", (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        stats.unpaid = row.count;
        stats.unpaidAmount = row.amount;
        
        db.get("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM invoices WHERE status = 'partial'", (err, row) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          stats.partial = row.count;
          stats.partialAmount = row.amount;
          
          res.json(stats);
        });
      });
    });
  });
});

module.exports = router;