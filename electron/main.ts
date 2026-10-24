import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Paths } from "./core/Paths.ts";
import { serviceManager } from "./core/ServiceManager.ts";
import { MariaDbService } from "./core/services/MariaDbService.ts";
import { ApacheService } from "./core/services/ApacheService.ts";
import { registerServicesIpc } from "./ipc/services.ipc.ts";
import { registerRuntimesIpc } from "./ipc/runtimes.ipc.ts";
import { registerTmpIpc } from "./ipc/tmp.ipc.ts";
import { registerCatalogIpc } from "./ipc/catalog.ipc.ts";
import { registerDownloadIpc } from "./ipc/download.ipc.ts";
import { TmpCleaner } from "./core/TmpCleaner.ts";
import { Settings } from "./core/Settings.ts";
import { downloadManager, startupCleanup } from "./core/download/DownloadManager.ts";
import { purgeStaleVerificationCache } from "./core/download/ResolverCache.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pastikan semua direktori kerja terpusat sudah ada
Paths.ensureDirs();

// Buat www/index.php default jika folder www masih kosong
const defaultIndexPath = path.join(Paths.www, 'index.php');
if (!fs.existsSync(defaultIndexPath)) {
  const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Astra Web Server</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
        .card { background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 500px; width: 100%; text-align: center; border: 1px solid #e2e8f0; }
        h1 { color: #2563eb; margin-top: 0; font-size: 1.8rem; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; background: #dbeafe; color: #1d4ed8; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; }
        p { margin: 0.5rem 0; font-size: 0.95rem; color: #64748b; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Astra Control Panel</h1>
        <div class="badge">Apache & MariaDB Running</div>
        <p>PHP Version: <strong><?php echo phpversion(); ?></strong></p>
        <p>Server Software: <strong><?php echo $_SERVER['SERVER_SOFTWARE']; ?></strong></p>
        <p style="margin-top: 1.5rem; font-size: 0.85rem;">Letakkan file web Anda di dalam folder <code>www/</code>.</p>
    </div>
</body>
</html>
`;
  try {
    fs.writeFileSync(defaultIndexPath, indexContent, 'utf-8');
  } catch (err) {
    console.error('Gagal membuat www/index.php default:', err);
  }
}

// Registrasi service (Urutan: MariaDb lalu Apache)
serviceManager.register(new MariaDbService());
serviceManager.register(new ApacheService());

// Registrasi handler IPC
registerServicesIpc();
registerRuntimesIpc();
registerTmpIpc();
registerCatalogIpc();
registerDownloadIpc();

// Startup cleanup: bersihkan folder __tmp_* dan __del_* sisa download yang gagal/dibatalkan
startupCleanup();

// Purge cache entri yang masih needsManualVerification (fix resolver langsung terasa)
try {
  purgeStaleVerificationCache();
} catch (err) {
  console.warn('[ResolverCache] Gagal purge stale verification cache:', err);
}

// Bersihkan tmp/ saat aplikasi start
try {
  const settings = Settings.get();
  const maxDays = settings.tmpSessionMaxAgeDays ?? 7;
  const cleanResult = TmpCleaner.clean(maxDays);
  if (cleanResult.totalFiles > 0) {
    console.log(
      `[TmpCleaner] Startup cleanup: ${cleanResult.totalFiles} file (${cleanResult.freedFormatted}) dihapus`
    );
  }
} catch (err) {
  console.warn('[TmpCleaner] Gagal membersihkan tmp/ saat startup:', err);
}

let isQuitting = false;

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async (event) => {
  if (isQuitting) {
    return;
  }

  // Cegah proses yatim dengan menunggu semua service dihentikan sebelum app keluar
  event.preventDefault();
  try {
    await serviceManager.stopAll();
  } catch (err) {
    console.error("Error stopping services on quit:", err);
  } finally {
    isQuitting = true;
    app.quit();
  }
});

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  serviceManager.setWebContents(win.webContents);
  downloadManager.setWebContents(win.webContents);

  win.on("closed", () => {
    serviceManager.setWebContents(null);
    downloadManager.setWebContents(null);
  });

  if (import.meta.env.DEV) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
});

// Ping IPC handler (tetap dipertahankan dari Fase 1)
ipcMain.handle("ping", () => "pong");
