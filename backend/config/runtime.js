const net = require('net');
const path = require('path');

function resolveDatabasePath(env = process.env) {
  if (env.DATABASE_PATH) {
    return path.resolve(env.DATABASE_PATH);
  }

  if (env.ERP_DATABASE_PATH) {
    return path.resolve(env.ERP_DATABASE_PATH);
  }

  return path.join(process.cwd(), 'data', 'erp.db');
}

function getPreferredPort(startPort = 3000) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();

      server.once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          if (port >= startPort + 20) {
            reject(new Error('No free local port available for the ERP backend'));
            return;
          }

          tryPort(port + 1);
          return;
        }

        reject(error);
      });

      server.once('listening', () => {
        server.close(() => resolve(port));
      });

      server.listen(port, '127.0.0.1');
    };

    tryPort(startPort);
  });
}

module.exports = {
  resolveDatabasePath,
  getPreferredPort
};
