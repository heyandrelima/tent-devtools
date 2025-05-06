import { app, BrowserWindow } from "electron";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  // Always use the development URL during development
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL("http://localhost:5173/");
  } else {
    win.loadFile(path.join(__dirname, "index.html"));
  }
};

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
