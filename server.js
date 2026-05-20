const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

// Load the environment variables from your .env file
dotenv.config();

const app = express();

// Required runtime port handling configuration for Render deployments
const PORT = process.env.PORT || 3000;

// Serve all static assets (like index.html) directly from the public folder
app.use(express.static(path.join(__dirname, "public")));

// API Endpoint to send your contract configuration details to the front-end
app.get("/config", (req, res) => {
  res.json({
    token: process.env.TOKEN_CONTRACT,
    treasury: process.env.TREASURY_CONTRACT,
    engine: process.env.ENGINE_CONTRACT,
    projectId: process.env.REOWN_PROJECT_ID
  });
});

// Root route: Serves your main UI game page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Fallback wildcard route: redirects any accidental bad links back to your game
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start the server listener
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server successfully booted up and running on port ${PORT}`);
});
