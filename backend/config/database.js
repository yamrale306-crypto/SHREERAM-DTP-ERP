const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { resolveDatabasePath } = require('./runtime');

let db = null;

function initializeDatabase() {
  if (db) {
    return db;
  }

  const dbPath = resolveDatabasePath(process.env);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
    } else {
      console.log(`✅ Connected to SQLite database at ${dbPath}`);
      createTables();
    }
  });

  return db;
}

function createTables() {
  const tables = [
    // Users table for authentication
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Customers table
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      city TEXT,
      address TEXT,
      gstin TEXT,
      customer_type TEXT DEFAULT 'Regular',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Invoices table
    `CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      date TEXT NOT NULL,
      due_date TEXT,
      type TEXT DEFAULT 'gst',
      subtotal REAL DEFAULT 0,
      gst_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      extra_charges REAL DEFAULT 0,
      total REAL NOT NULL,
      received REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid',
      payment_mode TEXT DEFAULT 'Cash',
      notes TEXT,
      terms TEXT,
      gstin TEXT,
      customer_address TEXT,
      items TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`,

    // Products table
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      hsn_sac TEXT,
      price REAL DEFAULT 0,
      gst_percentage REAL DEFAULT 18,
      stock_qty INTEGER DEFAULT 0,
      sold_qty INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Transactions table (Income/Expense)
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL,
      payment_mode TEXT DEFAULT 'Cash',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Purchase Orders table
    `CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      vendor TEXT NOT NULL,
      item TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Quotations table
    `CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT UNIQUE NOT NULL,
      customer TEXT NOT NULL,
      items TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      valid_till TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Jobs table
    `CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_number TEXT UNIQUE NOT NULL,
      customer TEXT NOT NULL,
      item TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      size TEXT,
      paper TEXT,
      amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      stage INTEGER DEFAULT 0,
      due_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Settings table
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  let completed = 0;
  tables.forEach((sql) => {
    db.run(sql, (err) => {
      if (err) {
        console.error('❌ Error creating table:', err.message);
      } else {
        completed++;
        if (completed === tables.length) {
          console.log('✅ All database tables created');
          migrateDatabase(() => {
            insertDefaultData();
          });
        }
      }
    });
  });
}

function runStatements(statements, done) {
  if (statements.length === 0) {
    done();
    return;
  }

  const [current, ...rest] = statements;
  db.run(current, (err) => {
    if (err) {
      console.error('❌ Database migration error:', err.message);
    }
    runStatements(rest, done);
  });
}

function migrateDatabase(done) {
  db.all('PRAGMA table_info(users)', (err, rows) => {
    if (err) {
      console.error('❌ Failed to inspect users table:', err.message);
      done();
      return;
    }

    const existingColumns = new Set(rows.map((row) => row.name));
    const statements = [];

    if (!existingColumns.has('email')) {
      statements.push('ALTER TABLE users ADD COLUMN email TEXT');
    }

    if (!existingColumns.has('google_id')) {
      statements.push('ALTER TABLE users ADD COLUMN google_id TEXT');
    }

    if (!existingColumns.has('profile_picture')) {
      statements.push('ALTER TABLE users ADD COLUMN profile_picture TEXT');
    }

    statements.push('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    statements.push('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');

    runStatements(statements, () => {
      console.log('✅ Database migrations completed');
      done();
    });
  });
}

function insertDefaultData() {
  // Insert default admin user (username: admin, password: admin123)
  const defaultPassword = require('bcryptjs').hashSync('admin123', 10);
  
  db.run(
    `INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
    ['admin', defaultPassword, 'admin'],
    (err) => {
      if (err) {
        console.error('❌ Error inserting default user:', err.message);
      } else {
        console.log('✅ Default admin user created (username: admin, password: admin123)');
      }
    }
  );

  // Insert default settings
  const defaultSettings = [
    ['co_name', 'SHREERAM DTP & OFFSET'],
    ['co_addr', 'Shop No.9, Purva Corner, Canal Road, Near Taware Bunglow, Baramati. 413102, Pune, Maharashtra, 413102'],
    ['co_phone', '9860305284'],
    ['co_email', 'shreeramdtp@gmail.com'],
    ['co_gstin', '27AISPN6907D1ZX'],
    ['co_pan', 'AISPN6907D'],
    ['co_est', '2006'],
    ['co_bank_name', 'Cosmos Co-operative Bank, Baramati'],
    ['co_bank_acc', '014100106057'],
    ['co_bank_ifsc', 'COSB0000014'],
    ['co_bank_branch', 'Baramati'],
    ['co_bank_holder', 'SHREERAM DTP & OFFSET']
  ];

  let settingsCompleted = 0;
  defaultSettings.forEach(([key, value]) => {
    db.run(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      [key, value],
      (err) => {
        if (err) {
          console.error(`❌ Error inserting setting ${key}:`, err.message);
        } else {
          settingsCompleted++;
          if (settingsCompleted === defaultSettings.length) {
            console.log('✅ Default settings inserted');
          }
        }
      }
    );
  });
}

function getDatabase() {
  return db;
}

module.exports = { initializeDatabase, getDatabase, resolveDatabasePath };
