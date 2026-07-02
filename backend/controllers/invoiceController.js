const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

// ---- helpers -------------------------------------------------------------

/**
 * Adds N days to a date and returns a JS Date.
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Formats a Date as DD/MM/YYYY to match your existing invoice style.
 */
function formatDate(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Determines payment status from received amount vs grand total vs due date.
 * Returns { status_class, status_label } used directly by the EJS badge.
 */
function getPaymentStatus(grandTotal, receivedAmount, dueDate) {
  const balance = Math.round((grandTotal - receivedAmount) * 100) / 100;
  const today = new Date();
  const isOverdue = balance > 0 && new Date(dueDate) < today;

  if (balance <= 0) {
    return { status_class: 'paid', status_label: 'Paid' };
  }
  if (isOverdue) {
    return { status_class: 'overdue', status_label: 'Overdue' };
  }
  if (receivedAmount > 0) {
    return { status_class: 'partial', status_label: 'Partially Paid' };
  }
  return { status_class: 'unpaid', status_label: 'Unpaid' };
}

/**
 * Converts a number to Indian-style words for the "Amount in Words" line.
 * (Basic implementation — swap for the 'number-to-words' or
 * 'indian-currency-words' npm package if you want broader edge-case coverage.)
 */
function numberToWordsINR(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
    'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function two(n) {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
  }
  function three(n) {
    if (n >= 100) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '');
    return two(n);
  }

  num = Math.round(num);
  if (num === 0) return 'Zero Rupees';

  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const rest = num;

  let words = '';
  if (crore) words += three(crore) + ' Crore ';
  if (lakh) words += three(lakh) + ' Lakh ';
  if (thousand) words += three(thousand) + ' Thousand ';
  if (rest) words += three(rest);

  return words.trim() + ' Rupees';
}

// ---- route -----------------------------------------------------------

router.get('/:id/view', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const db = getDatabase();

    // Get invoice
    const invoiceRow = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!invoiceRow) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get invoice items
    const itemRows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get customer (buyer) details
    const buyerRow = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM customers WHERE id = ?', [invoiceRow.customer_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Get company settings
    const companyRow = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM settings WHERE key = ?', ['company'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Get bank details
    const bankRow = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM settings WHERE key = ?', ['bank'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const company = companyRow ? JSON.parse(companyRow.value) : {};
    const bank = bankRow ? JSON.parse(bankRow.value) : {};
    const buyer = buyerRow || {};

    // Payment terms: pull from settings or default to 30 days
    const paymentTermsDays = 30;
    const dueDate = addDays(invoiceRow.date, paymentTermsDays);

    // Build line items with computed tax/line totals
    const items = itemRows.map((row, idx) => {
      const lineAmount = (row.qty || 1) * (row.price || 0);
      const taxPct = row.tax_pct || 18;
      const taxAmount = Math.round(lineAmount * (taxPct / 100) * 100) / 100;
      return {
        sno: idx + 1,
        item_name: row.item_name || row.desc || 'Item',
        item_desc: row.item_desc || row.description || '',
        hsn: row.hsn || '',
        qty: row.qty || 1,
        unit: row.unit || 'NOS',
        rate: row.price || 0,
        tax_pct: taxPct,
        tax_amount: taxAmount,
        line_total: lineAmount + taxAmount,
      };
    });

    const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
    const totalTax = items.reduce((sum, i) => sum + i.tax_amount, 0);
    const grandTotal = items.reduce((sum, i) => sum + i.line_total, 0);
    const receivedAmount = invoiceRow.received || 0;
    const balanceDue = Math.round((grandTotal - receivedAmount) * 100) / 100;

    // Group by HSN for the CGST/SGST summary table
    const taxByHsn = {};
    items.forEach((i) => {
      if (!taxByHsn[i.hsn]) {
        taxByHsn[i.hsn] = {
          hsn: i.hsn,
          taxable_value: 0,
          cgst_rate: i.tax_pct / 2,
          sgst_rate: i.tax_pct / 2,
          cgst_amount: 0,
          sgst_amount: 0,
          total_tax: 0
        };
      }
      const taxable = i.qty * i.rate;
      taxByHsn[i.hsn].taxable_value += taxable;
      taxByHsn[i.hsn].cgst_amount += i.tax_amount / 2;
      taxByHsn[i.hsn].sgst_amount += i.tax_amount / 2;
      taxByHsn[i.hsn].total_tax += i.tax_amount;
    });

    const status = getPaymentStatus(grandTotal, receivedAmount, dueDate);

    res.render('invoices/tax-invoice', {
      company: {
        name: company.co_name || 'Shreeram DTP & Offset',
        address: company.co_addr || '',
        gstin: company.co_gstin || '',
        mobile: company.co_phone || '',
        pan: company.co_pan || '',
        email: company.co_email || '',
        logo_url: company.logo_url || '',
        signature_url: company.signature_url || '',
        tagline: company.tagline || 'Est. 2006',
        jurisdiction_city: company.jurisdiction_city || 'Mumbai',
      },
      bank: {
        account_name: bank.account_name || 'Shreeram DTP & Offset',
        ifsc: bank.ifsc || '',
        account_no: bank.account_no || '',
        name: bank.bank_name || '',
      },
      buyer: {
        name: invoiceRow.customer_name,
        address: invoiceRow.customer_address || buyer.address || '',
        gstin: invoiceRow.gstin || buyer.gstin || '',
        place_of_supply: 'Maharashtra',
        mobile: buyer.mobile || '',
        pan: buyer.pan || '',
      },
      ship: {
        name: invoiceRow.customer_name,
        address: invoiceRow.customer_address || buyer.address || '',
      },
      invoice: {
        invoice_no: invoiceRow.invoice_number,
        invoice_date_display: formatDate(invoiceRow.date),
        due_date_display: formatDate(dueDate),
        payment_terms_days: paymentTermsDays,
        amount_in_words: numberToWordsINR(grandTotal),
        copy_type: 'ORIGINAL FOR RECIPIENT',
        status_class: status.status_class,
        status_label: status.status_label,
      },
      items,
      totals: {
        total_qty: totalQty,
        total_tax: totalTax,
        grand_total: grandTotal,
        received_amount: receivedAmount,
        balance_due: balanceDue,
      },
      tax_rows: Object.values(taxByHsn),
    });
  } catch (err) {
    console.error('Error rendering invoice:', err);
    res.status(500).send('Could not generate invoice.');
  }
});

module.exports = router;