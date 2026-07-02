const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../config/database');

// Get revenue report
router.get('/revenue', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { period = 'month' } = req.query;
  
  let dateFilter = '';
  if (period === 'month') {
    dateFilter = "WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
  } else if (period === 'week') {
    dateFilter = "WHERE date >= date('now', '-7 days')";
  } else if (period === 'today') {
    dateFilter = "WHERE date = date('now')";
  }

  db.all(
    `SELECT 
      date,
      SUM(total) as revenue,
      COUNT(*) as invoice_count
     FROM invoices 
     ${dateFilter}
     GROUP BY date
     ORDER BY date DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Get GST summary report
router.get('/gst-summary', authenticateToken, (req, res) => {
  const db = getDatabase();
  const { period = 'month' } = req.query;
  
  let dateFilter = '';
  if (period === 'month') {
    dateFilter = "WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
  } else if (period === 'week') {
    dateFilter = "WHERE date >= date('now', '-7 days')";
  }

  db.all(
    `SELECT 
      invoice_number,
      customer_name,
      date,
      subtotal,
      gst_amount,
      total,
      status
     FROM invoices 
     ${dateFilter}
     AND type = 'gst'
     ORDER BY date DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const summary = {
        invoices: rows,
        totals: {
          taxable: rows.reduce((sum, inv) => sum + (inv.subtotal || 0), 0),
          cgst: rows.reduce((sum, inv) => sum + (inv.gst_amount || 0) / 2, 0),
          sgst: rows.reduce((sum, inv) => sum + (inv.gst_amount || 0) / 2, 0),
          total: rows.reduce((sum, inv) => sum + (inv.total || 0), 0)
        }
      };
      
      res.json(summary);
    }
  );
});

// Get product-wise sales report
router.get('/product-sales', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  // Parse items JSON and aggregate by product name
  db.all(
    `SELECT items FROM invoices WHERE items IS NOT NULL AND items != '[]'`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const productSales = {};
      
      rows.forEach(invoice => {
        try {
          const items = JSON.parse(invoice.items || '[]');
          items.forEach(item => {
            if (item.desc) {
              const key = item.desc.toLowerCase();
              if (!productSales[key]) {
                productSales[key] = {
                  name: item.desc,
                  revenue: 0,
                  quantity: 0
                };
              }
              productSales[key].revenue += (item.qty * item.price) || 0;
              productSales[key].quantity += (item.qty || 0);
            }
          });
        } catch (e) {
          // Skip invalid JSON
        }
      });

      const result = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);
      
      res.json(result);
    }
  );
});

// Get party-wise outstanding report
router.get('/party-outstanding', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT 
      customer_name,
      COUNT(*) as invoice_count,
      SUM(total) as total_billed,
      SUM(balance) as outstanding
     FROM invoices
     WHERE status != 'paid'
     GROUP BY customer_name
     ORDER BY outstanding DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Get monthly revenue trend
router.get('/monthly-trend', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT 
      strftime('%Y-%m', date) as month,
      SUM(total) as revenue,
      COUNT(*) as invoice_count
     FROM invoices
     GROUP BY strftime('%Y-%m', date)
     ORDER BY month DESC
     LIMIT 12`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows.reverse());
    }
  );
});

// Get dashboard statistics
router.get('/dashboard-stats', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  const stats = {};
  
  // Total invoices
  db.get("SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as amount FROM invoices", (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    stats.totalInvoices = row.total;
    stats.totalRevenue = row.amount;
    
    // Paid invoices
    db.get("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM invoices WHERE status = 'paid'", (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      stats.paidInvoices = row.count;
      stats.paidAmount = row.amount;
      
      // Unpaid invoices
      db.get("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM invoices WHERE status = 'unpaid'", (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        stats.unpaidInvoices = row.count;
        stats.unpaidAmount = row.amount;
        
        // Partial invoices
        db.get("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as amount FROM invoices WHERE status = 'partial'", (err, row) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          stats.partialInvoices = row.count;
          stats.partialAmount = row.amount;
          
          // Total customers
          db.get('SELECT COUNT(*) as total FROM customers', (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            stats.totalCustomers = row.total;
            
            // Total products
            db.get('SELECT COUNT(*) as total FROM products', (err, row) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              stats.totalProducts = row.total;
              
              res.json(stats);
            });
          });
        });
      });
    });
  });
});

module.exports = router;