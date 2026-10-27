const { app, BrowserWindow, dialog, Menu, Notification, Tray, nativeImage } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
// Same birthday math as the UI (Node 22+ can require() an ES module).
const { getBirthdayAge, localDateKey, upcomingBirthdays } = require('./src/birthdays.mjs');

let backendProcess;
let mainWindow;
let tray;
let birthdayPollTimer;

const API_BASE_URL = 'http://127.0.0.1:8000';
// Per-launch secret: the backend rejects /api/ calls without it, so other local web pages can't touch the data.
const API_TOKEN = crypto.randomBytes(32).toString('hex');
const api = axios.create({ baseURL: API_BASE_URL, headers: { 'X-FamilyTree-Token': API_TOKEN } });
const BIRTHDAY_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BIRTHDAY_STATE_FILE = 'birthday-notifications.json';

function getBirthdayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <rect width="64" height="64" rx="14" fill="#ffffff"/>
      <circle cx="32" cy="34" r="16" fill="#6ea163"/>
      <path d="M22 40h20v8H22z" fill="#4f8b48"/>
      <path d="M20 28c4-6 20-6 24 0" stroke="#f59e0b" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M31 12c2 3 2 6 0 9" stroke="#2f5f34" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M39 14c2 3 2 6 0 9" stroke="#2f5f34" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M23 14c2 3 2 6 0 9" stroke="#2f5f34" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>
  `;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function getBirthdayStatePath() {
  return path.join(app.getPath('userData'), BIRTHDAY_STATE_FILE);
}

function readBirthdayState() {
  try {
    const statePath = getBirthdayStatePath();
    if (!fs.existsSync(statePath)) {
      return { notifiedDate: null };
    }
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    console.error('Failed to read birthday state:', error);
    return { notifiedDate: null };
  }
}

function writeBirthdayState(state) {
  try {
    fs.writeFileSync(getBirthdayStatePath(), JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to write birthday state:', error);
  }
}

function buildBirthdaySnapshot(people) {
  const today = new Date();
  const upcoming30 = upcomingBirthdays(people, 30, today);
  return {
    todayKey: localDateKey(today),
    todayBirthdays: upcoming30.filter((entry) => entry.daysUntil === 0).map((entry) => entry.person),
    upcoming7: upcoming30.filter((entry) => entry.daysUntil > 0 && entry.daysUntil <= 7),
    upcoming30: upcoming30.filter((entry) => entry.daysUntil > 0),
  };
}

function buildBirthdaySummary(snapshot) {
  const parts = [];
  if (snapshot.todayBirthdays.length > 0) {
    parts.push(`${snapshot.todayBirthdays.length} birthday${snapshot.todayBirthdays.length === 1 ? '' : 's'} today`);
  }
  if (snapshot.upcoming7.length > 0) {
    parts.push(`${snapshot.upcoming7.length} in the next 7 days`);
  }
  if (snapshot.upcoming30.length > 0) {
    parts.push(`${snapshot.upcoming30.length} in the next 30 days`);
  }
  return parts.join(' · ');
}

function updateTrayMenu(snapshot) {
  if (!tray) return;

  const todayItems = snapshot.todayBirthdays.map((person) => {
    const age = getBirthdayAge(person);
    return `${person.first_name} ${person.last_name}${age ? ` (${age})` : ''}`.trim();
  });

  const nextItems = snapshot.upcoming7.slice(0, 6).map(({ person, daysUntil }) => {
    return `${person.first_name} ${person.last_name} in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
  });

  const menuTemplate = [
    { label: 'Open FamilyTree', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: snapshot.todayBirthdays.length > 0 ? `Today: ${snapshot.todayBirthdays.length}` : 'Today: none',
      enabled: false,
    },
    ...todayItems.length > 0
      ? todayItems.map((label) => ({ label, enabled: false }))
      : [{ label: 'No birthdays today', enabled: false }],
    { type: 'separator' },
    {
      label: snapshot.upcoming7.length > 0 ? `Next 7 days: ${snapshot.upcoming7.length}` : 'Next 7 days: none',
      enabled: false,
    },
    ...nextItems.length > 0
      ? nextItems.map((label) => ({ label, enabled: false }))
      : [{ label: 'No upcoming birthdays', enabled: false }],
    { type: 'separator' },
    { label: 'Refresh birthday reminders', click: () => refreshBirthdayTrayState({ notify: false }) },
    { label: 'Quit', click: () => quitApplication() },
  ];

  tray.setToolTip(snapshot.todayBirthdays.length > 0
    ? `FamilyTree - ${snapshot.todayBirthdays.length} birthday${snapshot.todayBirthdays.length === 1 ? '' : 's'} today`
    : 'FamilyTree');
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}

function notifyBirthdaySnapshot(snapshot) {
  if (!Notification.isSupported()) return;
  const state = readBirthdayState();
  if (state.notifiedDate === snapshot.todayKey) return;

  if (snapshot.todayBirthdays.length === 0 && snapshot.upcoming7.length === 0 && snapshot.upcoming30.length === 0) {
    return;
  }

  const title = snapshot.todayBirthdays.length > 0 ? 'Birthday reminders' : 'Upcoming birthdays';
  const body = buildBirthdaySummary(snapshot);
  const notification = new Notification({ title, body, silent: false });
  notification.show();

  writeBirthdayState({ notifiedDate: snapshot.todayKey });
}

function createTray() {
  if (tray) return tray;

  tray = new Tray(getBirthdayIcon());
  tray.setToolTip('FamilyTree');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open FamilyTree', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Loading birthday reminders...', enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => quitApplication() },
  ]));
  tray.on('double-click', () => showMainWindow());
  tray.on('click', () => showMainWindow());
  return tray;
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function quitApplication() {
  app.quit();
}

// The backend is a PyInstaller onefile exe: a bootloader with the real Python server as its child.
// Killing only the bootloader would leave the server holding port 8000, so kill the whole tree.
function stopBackend() {
  if (!backendProcess || backendProcess.exitCode !== null) return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(backendProcess.pid), '/T', '/F'], () => {});
  } else {
    backendProcess.kill();
  }
  backendProcess = null;
}

function shutdown() {
  if (birthdayPollTimer) clearInterval(birthdayPollTimer);
  stopBackend();
  if (tray) tray.destroy();
  tray = null;
}

async function fetchPeopleWithRetries(retries = 15, retryDelayMs = 1000) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await api.get('/api/people/', { timeout: 4000 });
      return response.data || [];
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw lastError;
}

async function refreshBirthdayTrayState({ notify = false } = {}) {
  try {
    const people = await fetchPeopleWithRetries();
    const snapshot = buildBirthdaySnapshot(people);
    updateTrayMenu(snapshot);
    if (notify) notifyBirthdaySnapshot(snapshot);
  } catch (error) {
    console.error('Failed to refresh birthday tray state:', error);
    writeBackendLog(`BIRTHDAY_REFRESH_ERROR: ${error.message}`);
  }
}

function writeBackendLog(message) {
  try {
    const logPath = path.join(app.getPath('userData'), 'backend.log');
    const time = new Date().toISOString();
    fs.appendFileSync(logPath, `[${time}] ${message}\n`);
  } catch (error) {
    console.error('Failed to write backend log:', error);
  }
}

function findPortableUsbDataDir() {
  const markerFiles = ['familytree.key', 'FAMILYTREE.KEY'];

  for (let code = 68; code <= 90; code += 1) {
    const driveLetter = String.fromCharCode(code);
    const root = `${driveLetter}:\\`;

    const hasMarker = markerFiles.some((marker) => fs.existsSync(path.join(root, marker)));
    if (!hasMarker) continue;

    const dataDir = path.join(root, 'FamilyTreeData');
    fs.mkdirSync(dataDir, { recursive: true });
    return dataDir;
  }

  return null;
}

function createWindow() {
  // Default webPreferences (no Node in the renderer): the UI only talks HTTP to the backend.
  mainWindow = new BrowserWindow({ width: 1200, height: 800 });

  // The raw index.html points at /src/main.jsx, which only resolves under Vite, so always load the build.
  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'), { query: { token: API_TOKEN } });
  if (!app.isPackaged) mainWindow.webContents.openDevTools();
}

// A second launch would start a second backend fighting for port 8000; focus the first window instead.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  app.setAppUserModelId('com.familytree.app');

  // 1. Determine the correct path
  let backendExePath;

  if (app.isPackaged) {
    // In production, the .exe is moved to the 'resources' folder
    backendExePath = path.join(process.resourcesPath, 'familytree_backend.exe');
  } else {
    // In development, look in your dist folder
    backendExePath = path.join(__dirname, '../dist/familytree_backend.exe');
  }

  console.log('Starting backend at:', backendExePath);
  writeBackendLog(`Starting backend at: ${backendExePath}`);

  if (!fs.existsSync(backendExePath)) {
    const message = `Backend executable not found at: ${backendExePath}`;
    writeBackendLog(message);
    dialog.showErrorBox('FamilyTree Backend Error', message);
    createWindow();
    return;
  }

  const backendEnv = { ...process.env, FAMILYTREE_API_TOKEN: API_TOKEN };
  const portableDataDir = findPortableUsbDataDir();

  if (portableDataDir) {
    backendEnv.FAMILYTREE_DATA_DIR = portableDataDir;
    console.log('Portable data mode enabled:', portableDataDir);
    writeBackendLog(`Portable data mode enabled: ${portableDataDir}`);
  } else {
    console.log('Portable data key not found. Using local data directory.');
    writeBackendLog('Portable data key not found. Using local data directory.');
  }

  backendProcess = spawn(backendExePath, [], { shell: false, env: backendEnv });

  backendProcess.stdout.on('data', (data) => {
    const text = data.toString();
    console.log(`Backend: ${text}`);
    writeBackendLog(`STDOUT: ${text.trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    const text = data.toString();
    console.error(`Backend error: ${text}`);
    writeBackendLog(`STDERR: ${text.trim()}`);
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
    writeBackendLog(`PROCESS_ERROR: ${err.message}`);
  });

  backendProcess.on('exit', (code, signal) => {
    writeBackendLog(`PROCESS_EXIT: code=${code} signal=${signal}`);
  });

  createTray();
  createWindow();

  await refreshBirthdayTrayState({ notify: true });
  birthdayPollTimer = setInterval(() => {
    refreshBirthdayTrayState({ notify: true });
  }, BIRTHDAY_REFRESH_INTERVAL_MS);
});

app.on('window-all-closed', () => {
  shutdown();
  app.quit();
});

app.on('before-quit', shutdown);