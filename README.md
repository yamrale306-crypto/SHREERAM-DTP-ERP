# Shreeram DTP & Offset - ERP System

A comprehensive Enterprise Resource Planning (ERP) system for printing and DTP business management.

## Features

- **Dashboard**: Real-time business overview with key metrics
- **Customer Management**: Complete customer database with GST support
- **Billing & Invoices**: GST/Non-GST invoice creation and management
- **Inventory Management**: Product master with stock tracking
- **Accounting**: Income/expense tracking and cash book
- **Reports & Analytics**: GST summary, revenue trends, party-wise outstanding
- **Settings**: Company profile, GST details, bank information
- **Authentication**: Secure JWT-based login system
- **Dark/Light Theme**: Toggle between themes
- **Responsive Design**: Works on desktop, tablet, and mobile

## Tech Stack

### Backend
- Node.js + Express.js
- SQLite Database
- JWT Authentication
- bcrypt for password hashing

### Frontend
- Vanilla JavaScript (ES6+)
- Bootstrap 5.3.2
- Chart.js for analytics
- Axios for API calls

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup Steps

1. **Clone or download the project**
   ```bash
   cd SHREERAM DTP ERP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file and update the values:
   - Change `JWT_SECRET` to a secure random string
   - Update `CORS_ORIGIN` with your domain

4. **Initialize database**
   ```bash
   npm run init-db
   ```

5. **Start the application**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Open browser and go to: `http://localhost:3000`
   - Default login: `admin` / `admin123`

## Desktop app (Windows)

For the easiest setup, run the one-click launcher:

```powershell
START_ERP.bat
```

Or start it manually:

```powershell
npm install
npm run desktop:dev
```

To build a Windows Setup EXE:

```powershell
npm run desktop:build
```

The installer will be written to the electron-dist folder.

## Project Structure

```
SHREERAM DTP ERP/
├── backend/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── invoices.js          # Invoice management
│   │   ├── customers.js         # Customer management
│   │   ├── products.js          # Product/inventory management
│   │   ├── reports.js           # Reports and analytics
│   │   └── settings.js          # Company settings
│   ├── scripts/
│   │   └── init-db.js           # Database initialization script
│   └── server.js                # Express server entry point
├── public/
│   ├── index.html               # Main HTML file
│   └── js/
│       └── app.js               # Frontend JavaScript
├── data/
│   └── erp.db                   # SQLite database (auto-created)
├── package.json
├── .env.example
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user (admin only)
- `GET /api/auth/verify` - Verify token
- `POST /api/auth/change-password` - Change password

### Invoices
- `GET /api/invoices` - Get all invoices
- `GET /api/invoices/:id` - Get single invoice
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice
- `GET /api/invoices/stats/summary` - Get invoice statistics

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/stats/summary` - Get customer statistics

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/stats/summary` - Get product statistics

### Reports
- `GET /api/reports/revenue` - Revenue report
- `GET /api/reports/gst-summary` - GST summary report
- `GET /api/reports/product-sales` - Product-wise sales
- `GET /api/reports/party-outstanding` - Party-wise outstanding
- `GET /api/reports/monthly-trend` - Monthly revenue trend
- `GET /api/reports/dashboard-stats` - Dashboard statistics

### Settings
- `GET /api/settings` - Get all settings
- `GET /api/settings/:key` - Get single setting
- `PUT /api/settings/:key` - Update setting
- `POST /api/settings/bulk-update` - Update multiple settings
- `GET /api/settings/company/profile` - Get company profile
- `GET /api/settings/company/bank` - Get bank details

## Default Credentials

- **Username**: admin
- **Password**: admin123

⚠️ **Important**: Change the default password after first login!

## Deployment

### Using PM2 (Recommended for Production)

1. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

2. **Start application with PM2**
   ```bash
   pm2 start backend/server.js --name "shreeram-erp"
   ```

3. **Save PM2 configuration**
   ```bash
   pm2 save
   pm2 startup
   ```

4. **Monitor application**
   ```bash
   pm2 status
   pm2 logs shreeram-erp
   ```

### Using Docker

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t shreeram-erp .
docker run -p 3000:3000 shreeram-erp
```

### Using Nginx as Reverse Proxy

1. Install Nginx
2. Create config file `/etc/nginx/sites-available/erp`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. Enable site:
   ```bash
   ln -s /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx
   ```

## Security Considerations

1. **Change default credentials** immediately after installation
2. **Update JWT_SECRET** in `.env` to a strong random string
3. **Enable HTTPS** in production using Let's Encrypt
4. **Regular backups** of the `data/erp.db` file
5. **Restrict CORS** origins in production
6. **Keep dependencies updated**: `npm audit fix`

## Backup & Restore

### Backup
The database is stored in `data/erp.db`. Regularly backup this file.

### Restore
1. Stop the application
2. Replace `data/erp.db` with your backup file
3. Restart the application

## Troubleshooting

### Port already in use
```bash
# Change PORT in .env file
PORT=3001
```

### Database locked
- Ensure only one instance of the application is running
- Check file permissions on `data/` directory

### Login not working
- Clear browser localStorage
- Verify database was initialized: `npm run init-db`

## Development

### Running in Development Mode
```bash
npm run dev
```
This uses nodemon for auto-reload on code changes.

### Database Schema
The database schema is automatically created on first run. See `backend/config/database.js` for schema details.

## License

MIT License - Shreeram DTP & Offset

## Support

For issues or questions, contact: shreeramdtp@gmail.com