const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

// Get all products
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    'SELECT * FROM products ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Get single product
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    'SELECT * FROM products WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(row);
    }
  );
});

// Create product
router.post('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const {
    name,
    hsn_sac,
    price,
    gst_percentage,
    stock_qty,
    sold_qty
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  db.run(
    `INSERT INTO products (name, hsn_sac, price, gst_percentage, stock_qty, sold_qty)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, hsn_sac, price || 0, gst_percentage || 18, stock_qty || 0, sold_qty || 0],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Product already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.status(201).json({
        id: this.lastID,
        name,
        message: 'Product created successfully'
      });
    }
  );
});

// Update product
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const {
    name,
    hsn_sac,
    price,
    gst_percentage,
    stock_qty,
    sold_qty
  } = req.body;

  db.run(
    `UPDATE products SET 
      name = ?, hsn_sac = ?, price = ?, gst_percentage = ?, 
      stock_qty = ?, sold_qty = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [name, hsn_sac, price, gst_percentage, stock_qty, sold_qty, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ message: 'Product updated successfully' });
    }
  );
});

// Delete product
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.run(
    'DELETE FROM products WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ message: 'Product deleted successfully' });
    }
  );
});

// Get product statistics
router.get('/stats/summary', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const stats = {};
  
  db.get('SELECT COUNT(*) as total, COALESCE(SUM(stock_qty), 0) as total_stock, COALESCE(SUM(stock_qty * price), 0) as stock_value FROM products', (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    stats.total = row.total;
    stats.totalStock = row.total_stock;
    stats.stockValue = row.stock_value;
    
    db.get("SELECT COUNT(*) as low_stock FROM products WHERE stock_qty <= 5", (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      stats.lowStock = row.low_stock;
      
      res.json(stats);
    });
  });
});

module.exports = router;