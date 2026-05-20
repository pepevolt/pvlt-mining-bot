const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// send config to frontend securely
app.get("/config", (req, res) => {
  res.json({
    token: process.env.TOKEN_CONTRACT,
    treasury: process.env.TREASURY_CONTRACT,
    engine: process.env.ENGINE_CONTRACT,
    reown: process.env.REOWN_PROJECT_ID
  });
});

// FIX: root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// FIX: fallback route (Render requirement)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("PEPEVOLT running on port", PORT);
});