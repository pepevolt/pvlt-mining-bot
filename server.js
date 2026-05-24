require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

/* -----------------------------
   CONTRACT CONFIG
------------------------------ */

const CONFIG = {
  chainId: process.env.CHAIN_ID,

  projectId: process.env.REOWN_PROJECT_ID,

  contracts: {
    pvlt: process.env.PVLT_TOKEN,
    treasury: process.env.TREASURY_VOLT,
    game: process.env.PEPEVOLT_GAME
  }
};

/* -----------------------------
   API ROUTES
------------------------------ */

app.get("/api/config", (req, res) => {

  res.json({
    success: true,
    config: CONFIG
  });

});

app.get("/api/status", (req, res) => {

  res.json({
    success: true,
    message: "PepeVolt Server Running",
    timestamp: Date.now()
  });

});

/* -----------------------------
   INDEX.HTML
------------------------------ */

app.get("/", (req, res) => {

  res.sendFile(path.join(__dirname, "index.html"));

});

/* -----------------------------
   START SERVER
------------------------------ */

app.listen(PORT, () => {

  console.log(`
========================================
 PEPEVOLT TAP GAME SERVER STARTED
========================================

Server : http://localhost:${PORT}

PVLT TOKEN:
${process.env.PVLT_TOKEN}

TREASURY:
${process.env.TREASURY_VOLT}

GAME:
${process.env.PEPEVOLT_GAME}

========================================
  `);

});