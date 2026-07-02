const { app, BrowserWindow, dialog } = require('electron');
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { getPreferredPort } = require('./backend/config/runtime');

let mainWindow;
let serverInstance;
let appUrl;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const contents = fs.readFileSync(filePath, 'utf8');

  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^['"]|['"]$/g, '');
  });

  return values;
}

function ensureRuntimeEnv() {
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');
  const logsDir = path.join(userDataPath, 'logs');
  const exportsDir = path.join(userDataPath, 'exports');
  const envPath = path.join(userDataPath, '.env');
  const databasePath = path.join(dataDir, 'erp.db');
  const projectEnvPath = path.resolve(__dirname, '.env');

  ensureDir(userDataPath);
  ensureDir(dataDir);
  ensureDir(logsDir);
  ensureDir(exportsDir);

  const existingEnv = parseEnvFile(envPath);
  const projectEnv = parseEnvFile(projectEnvPath);
  const jwtSecret = existingEnv.JWT_SECRET || projectEnv.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  const mergedEnv = {
    PORT: '3000',
    NODE_ENV: 'production',
    JWT_SECRET: jwtSecret,
    DATABASE_PATH: databasePath.replace(/\\/g, '/'),
    CORS_ORIGIN: 'http://127.0.0.1:3000,http://localhost:3000',
    GOOGLE_CALLBACK_URL: 'http://127.0.0.1:3000/api/auth/google/callback',
    ...existingEnv,
    ...projectEnv
  };

  const envContent = Object.entries(mergedEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(envPath, envContent, 'utf8');

  process.env.ERP_ENV_PATH = envPath;
  process.env.NODE_ENV = mergedEnv.NODE_ENV || 'production';
  process.env.PORT = mergedEnv.PORT || '3000';
  process.env.DATABASE_PATH = mergedEnv.DATABASE_PATH || databasePath;
  process.env.CORS_ORIGIN = mergedEnv.CORS_ORIGIN || 'http://127.0.0.1:3000,http://localhost:3000';
  process.env.JWT_SECRET = mergedEnv.JWT_SECRET || jwtSecret;
  process.env.GOOGLE_CLIENT_ID = mergedEnv.GOOGLE_CLIENT_ID || '';
  process.env.GOOGLE_CLIENT_SECRET = mergedEnv.GOOGLE_CLIENT_SECRET || '';
  process.env.GOOGLE_CALLBACK_URL = mergedEnv.GOOGLE_CALLBACK_URL || 'http://127.0.0.1:3000/api/auth/google/callback';

  return {
    envPath,
    databasePath,
    userDataPath,
    dataDir,
    logsDir,
    exportsDir
  };
}

function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`${url}/api/health`, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
          return;
        }

        res.resume();
        retry();
      });

      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Timed out waiting for the local server to start'));
        return;
      }

      setTimeout(check, 500);
    };

    check();
  });
}

function createWindow(url) {
  const iconPath = path.join(__dirname, 'public', 'favicon.ico');
  const windowOptions = {
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: 'Shreeram DTP & Offset - ERP System',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      experimentalFeatures: false,
      offscreen: false
    }
  };

  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  });

  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('force-color-profile', 'srgb');
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function bootstrapDesktopApp() {
  const runtime = ensureRuntimeEnv();
  const port = await getPreferredPort(3000);
  process.env.PORT = String(port);
  process.env.CORS_ORIGIN = `http://127.0.0.1:${port},http://localhost:${port}`;
  process.env.GOOGLE_CALLBACK_URL = `http://127.0.0.1:${port}/api/auth/google/callback`;
  appUrl = `http://127.0.0.1:${port}`;

  const { startServer } = require('./backend/server');
  serverInstance = startServer(port);
  await waitForServer(appUrl);
  createWindow(appUrl);
}

app.whenReady().then(async () => {
  try {
    await bootstrapDesktopApp();
  } catch (error) {
    console.error('Desktop bootstrap failed:', error);
    dialog.showErrorBox(
      'Shreeram ERP failed to start',
      `${error.message}\n\nPlease check your Google configuration, local app data permissions, and whether the default port is available.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0 && appUrl) {
    createWindow(appUrl);
  }
});
