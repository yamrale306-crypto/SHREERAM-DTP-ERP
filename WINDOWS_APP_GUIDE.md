# Windows Desktop Application Guide

## What changed

The project now starts as a real Electron desktop application on Windows rather than relying on the older browser-style launcher path.

## Run in development

The simplest option is to double-click:

```powershell
START_ERP.bat
```

If you prefer to start it manually:

1. Install dependencies
   ```powershell
   npm install
   ```
2. Start the desktop app
   ```powershell
   npm run desktop:dev
   ```

The app will:
- launch a desktop window with the ERP UI
- start the local backend automatically
- store SQLite data in the Windows user data folder
- create the database and logs directories on first run

## Build the Windows installer

Run:

```powershell
npm run desktop:build
```

The installer will be generated in the electron-dist folder as a Setup EXE.

## Runtime notes

- The SQLite database is created under the Electron user data directory, not inside the packaged app files.
- The backend listens on a free localhost port and falls back automatically if the default port is busy.
- Google sign-in remains optional and requires valid OAuth credentials in the environment.
- The default admin login remains:
  - username: admin
  - password: admin123

## Google OAuth setup for desktop

Set these values in the app environment or in the generated user-data .env file:

```text
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://127.0.0.1:3000/api/auth/google/callback
```

The callback URL must match exactly in Google Cloud Console.
