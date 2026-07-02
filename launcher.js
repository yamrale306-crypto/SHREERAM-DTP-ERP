#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get the directory where the executable is running
const exeDir = path.dirname(process.execPath);

// Set up paths
const dataDir = path.join(exeDir, 'data');
const envPath = path.join(exeDir, '.env');
const nodeModulesDir = path.join(exeDir, 'node_modules');
const serverPath = process.pkg 
  ? path.join(__dirname, 'backend', 'server.js')
  : path.join(exeDir, 'backend', 'server.js');

// NOTE:
// Avoid filesystem-based require hacks when running via pkg EXE.
// pkg bundles dependencies internally; attempting to load from dist/node_modules
// can cause MODULE_NOT_FOUND errors.
// (Previously this block attempted to redirect requires for passport/express-session.)


// Create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create .env file if it doesn't exist
if (!fs.existsSync(envPath)) {
  const envContent = `PORT=3000
NODE_ENV=production
JWT_SECRET=shreeram-dtp-erp-secret-key-2024
DATABASE_PATH=./data/erp.db
`;
  fs.writeFileSync(envPath, envContent);
}

// Set environment variables
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = 'production';
// Ensure sqlite database path exists and is writable
process.env.DATABASE_PATH = path.join(dataDir, 'erp.db');
process.env.DATABASE_PATH = process.env.DATABASE_PATH.replace(/\\/g, '/');

// Open browser after server starts
function openBrowser() {
  setTimeout(() => {
    const url = 'http://localhost:3000';
    
    if (os.platform() === 'win32') {
      // Open in app mode (no address bar, looks like desktop app)
      const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
      const chromePathLocal = 'C:\\Program Files\\Local\\Google\\Chrome\\Application\\chrome.exe';
      
      // Try Chrome first, then Edge
      let browserCmd = null;
      if (fs.existsSync(chromePath)) {
        browserCmd = `"${chromePath}" --app=${url}`;
      } else if (fs.existsSync(edgePath)) {
        browserCmd = `"${edgePath}" --app=${url}`;
      } else if (fs.existsSync(chromePathLocal)) {
        browserCmd = `"${chromePathLocal}" --app=${url}`;
      }
      
      if (browserCmd) {
        spawn('cmd', ['/c', 'start', '', browserCmd], { 
          detached: true, 
          stdio: 'ignore',
          shell: true 
        }).unref();
      } else {
        // Fallback to default browser
        spawn('start', [url], { detached: true, stdio: 'ignore' }).unref();
      }
    } else if (os.platform() === 'darwin') {
      spawn('open', ['-a', 'Google Chrome', '--args', '--app=' + url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  }, 2000);
}

// Start the server
console.log('========================================');
console.log('  Shreeram DTP & Offset - ERP System');
console.log('========================================');
console.log('');
console.log('Starting server...');
console.log('Server will be available at: http://localhost:3000');
console.log('Default login: admin / admin123');
console.log('');
console.log('Press Ctrl+C to stop the server');
console.log('');

openBrowser();

// Import and start the server
require(serverPath);
