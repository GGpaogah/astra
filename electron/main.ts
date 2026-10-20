import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Paths } from "./core/Paths.ts";
import { serviceManager } from "./core/ServiceManager.ts";
import { DummyService } from "./core/services/DummyService.ts";
import { registerServicesIpc } from "./ipc/services.ipc.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pastikan semua direktori kerja terpusat sudah ada
Paths.ensureDirs();

// Registrasi service (DummyService untuk uji Fase 2)
serviceManager.register(new DummyService());

// Registrasi handler IPC
registerServicesIpc();

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async (event) => {
  // Cegah proses yatim dengan menghentikan semua service sebelum keluar
  event.preventDefault();
  try {
    await serviceManager.stopAll();
  } catch (err) {
    console.error("Error stopping services on quit:", err);
  } finally {
    app.exit(0);
  }
});

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  serviceManager.setWebContents(win.webContents);

  win.on("closed", () => {
    serviceManager.setWebContents(null);
  });

  if (import.meta.env.DEV) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
});

// Ping IPC handler (tetap dipertahankan dari Fase 1)
ipcMain.handle("ping", () => "pong");
