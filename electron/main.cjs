// BuyrWorld — Electron desktop wrapper.
// Serves the built dist/ over a private 127.0.0.1 HTTP server and loads it, so
// the game's absolute /assets/... paths (sprites, UI icons) resolve exactly as
// on the web — file:// would break them. Steamworks is wired but optional.
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const isDev = !!process.env.ELECTRON_START_URL;
const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.map': 'application/json', '.txt': 'text/plain',
};

let server = null;
// Minimal static file server for the packaged app shell (no dependencies).
function startServer(){
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (p === '/' || p === '') p = '/index.html';
        let file = path.join(DIST, path.normalize(p));
        if (!file.startsWith(DIST)) { res.statusCode = 403; return res.end('forbidden'); }
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
        const body = fs.readFileSync(file);
        res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(body);
      } catch (e) { res.statusCode = 500; res.end('server error'); }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}/`));
  });
}

// Optional Steamworks: install `steamworks.js` and drop the real appid in
// steam_appid.txt to enable the overlay + achievements. Absent = runs standalone.
let steam = null;
function initSteam(){
  try {
    const appidFile = path.join(process.resourcesPath || process.cwd(), 'steam_appid.txt');
    let appid = 480; // 480 = Spacewar, Valve's test appid (fine for local dev)
    if (fs.existsSync(appidFile)) appid = parseInt(fs.readFileSync(appidFile, 'utf8').trim(), 10) || 480;
    const sw = require('steamworks.js');
    steam = sw.init(appid);
    console.log('[steam] initialised (appid ' + appid + ')');
  } catch (e) {
    console.log('[steam] not available — running standalone');
  }
}

let win = null;
async function createWindow(){
  const url = process.env.ELECTRON_START_URL || await startServer();
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: '#12100c',
    title: 'BuyrWorld',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadURL(url);
  // External links open in the OS browser; keep everything else inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

// Slim menu: keeps F11 fullscreen + platform quit accelerators working while hidden.
Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'BuyrWorld', submenu: [
    { role: 'togglefullscreen' },
    ...(isDev ? [{ role: 'reload' }, { role: 'toggleDevTools' }] : []),
    { type: 'separator' },
    { role: 'quit' },
  ]},
]));

app.whenReady().then(() => {
  initSteam();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  try { if (server) server.close(); } catch (e) {}
  try { if (steam && steam.shutdown) steam.shutdown(); } catch (e) {}
});

ipcMain.handle('app:version', () => app.getVersion());
