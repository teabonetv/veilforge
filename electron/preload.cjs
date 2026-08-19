"use strict";
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("VeilforgeDesktop", { steam: false });
