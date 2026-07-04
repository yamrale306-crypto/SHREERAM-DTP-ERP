const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load passport and express-session
// NOTE: When running via pkg executable, requiring from the filesystem (dist/node_modules) can fail.
const passport = require('passport');
const session = require('express-session');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const invoiceRoutes = require('./routes/invoices');
const customerRoutes = require('./routes/customers');
const productRoutes = require('./routes/products');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const googleAuthRoutes = require('./routes/google-auth');
const { initializeDatabase } = require('./config/database');

const envCandidates = [];

if (process.env.ERP_ENV_PATH) {
  envCandidates.push(process.env.ERP_ENV_PATH);
}

envCandidates.push(path.resolve(__dirname, '../.env'));
envCandidates.push(path.resolve(process.cwd(), '.env'));

for (const envPath of envCandidates) {
  if (envPath && fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

if (!process.env.GOOGLE_CALLBACK_URL) {
  process.env.GOOGLE_CALLBACK_URL = `http://127.0.0.1:${process.env.PORT || 3000}/api/auth/google/callback`;
}

const { resolveDatabasePath } = require('./config/runtime');

function buildCorsOptions() {
  return {
    origin: true,
    credentials: true
  };
}

function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, '../public');
  const resolvedDbPath = resolveDatabasePath(process.env);

  if (!fs.existsSync(publicDir)) {
    throw new Error(`Frontend assets folder not found: ${publicDir}`);
  }

  process.env.DATABASE_PATH = resolvedDbPath;

  // Set EJS as the view engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(cors(buildCorsOptions()));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(publicDir));

  app.use(session({
    secret: process.env.JWT_SECRET || 'shreeram-dtp-erp-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax'
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  initializeDatabase();

  app.use('/api/auth', authRoutes);
  app.use('/api/auth', googleAuthRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/settings', settingsRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Shreeram DTP ERP API is running' });
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

function startServer(port = process.env.PORT || 3000) {
  const app = createApp();
  let currentPort = Number(port) || 3000;

  const listenOnPort = (selectedPort) => {
    const server = app.listen(selectedPort, '127.0.0.1', () => {
      currentPort = selectedPort;
      process.env.PORT = String(selectedPort);
      process.env.CORS_ORIGIN = `http://127.0.0.1:${selectedPort},http://localhost:${selectedPort}`;
      process.env.GOOGLE_CALLBACK_URL = `http://127.0.0.1:${selectedPort}/api/auth/google/callback`;
      console.log(`🚀 Server running on http://127.0.0.1:${selectedPort}`);
      console.log('📊 ERP System ready for Shreeram DTP & Offset');
      console.log(`🗄️ Database path: ${process.env.DATABASE_PATH}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${selectedPort} is busy, trying ${selectedPort + 1}`);
        server.close(() => listenOnPort(selectedPort + 1));
        return;
      }

      console.error('❌ Server startup failed:', error.message);
    });

    return server;
  };

  return listenOnPort(currentPort);
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer
};
