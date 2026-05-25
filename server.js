require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

/* =========================
   CONFIG
========================= */

const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

/* =========================
   STATIC FILES
========================= */

app.use(express.static(path.join(__dirname)));

/* =========================
   MAIN ROUTE
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    );

});

/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (req, res) => {

    res.status(200).json({
        success: true,
        server: "pvlt-server",
        status: "online",
        chain: "Polygon Mainnet",
        chainId: 137
    });

});

/* =========================
   404 HANDLER
========================= */

app.use((req, res) => {

    res.status(404).json({
        success: false,
        error: "Route not found"
    });

});

/* =========================
   ERROR HANDLER
========================= */

app.use((err, req, res, next) => {

    console.error(err.stack);

    res.status(500).json({
        success: false,
        error: "Internal Server Error"
    });

});

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {

    console.log(`
=================================
🚀 PVLT SERVER RUNNING
=================================
Port: ${PORT}
URL : http://localhost:${PORT}
Mode: Production
=================================
    `);

});