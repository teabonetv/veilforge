"use strict";

const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

const STEAM_APP_ID = process.env.STEAM_APP_ID || "";

function trySteam() {
  if (!STEAM_APP_ID) return;
  try {
    // Optional: npm i steamworks.js and set STEAM_APP_ID to your real App ID.
    const steamworks = require("steamworks.js");
    steamworks.init(+STEAM_APP_ID);
  } catch (err) {
    console.warn("Steamworks not loaded:", err.message);
  }
}

function gameIndex() {
  const packed = path.join(__dirname, "..", "www", "index.html");
  const live = path.join(__dirname, "..", "index.html");
  const fs = require("fs");
  if (fs.existsSync(packed)) return packed;
  return live;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0c0714",
    title: "Veilforge",
    icon: path.join(__dirname, "..", "branding", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(gameIndex());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

const template = [
  {
    label: "Veilforge",
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "quit" }
    ]
  },
  {
    label: "View",
    submenu: [
      { role: "togglefullscreen" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "toggleDevTools" }
    ]
  }
];

app.whenReady().then(() => {
  trySteam();
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
