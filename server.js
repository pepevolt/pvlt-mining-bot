import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* ================= STORAGE ================= */

const users = {};

/* ================= POLYGON SETUP ================= */

let provider;
let wallet;
let pvltg;
let gameEngine;

try {
    const rpcUrl = process.env.RPC_URL || "https://polygon-rpc.com";
    const privateKey = process.env.PRIVATE_KEY;
    const pvltgAddress = process.env.PVLTG;
    const engineAddress = process.env.ENGINE;

    provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
        chainId: 137,
        name: "polygon"
    });

    if (privateKey) {
        wallet = new ethers.Wallet(privateKey, provider);

        const pvltgAbi = [
            "function mint(address to,uint256 amount) external"
        ];

        const gameAbi = [
            "function swapPVLTGtoPVLT(uint256 amount) external",
            "function swapPVLTGtoPVLT(address user, uint256 amount) external"
        ];

        if (pvltgAddress) {
            pvltg = new ethers.Contract(pvltgAddress, pvltgAbi, wallet);
        }
        if (engineAddress) {
            gameEngine = new ethers.Contract(engineAddress, gameAbi, wallet);
        }
    } else {
        console.warn("WARNING: PRIVATE_KEY environment variable is not set.");
    }
} catch (error) {
    console.error("Initialization Error during app startup:", error.message);
}

/* ================= HEALTH ================= */

app.get("/", (req, res) => {
    res.send("PVLT SERVER RUNNING");
});

/* ================= CREATE USER ================= */

app.post("/user", (req, res) => {
    const { wallet: userWallet } = req.body;

    if (!userWallet) {
        return res.json({
            error: "Wallet required"
        });
    }

    const addressKey = userWallet.toLowerCase();

    if (!users[addressKey]) {
        users[addressKey] = {
            points: 0,
            energy: 50,
            pvltg: 0,
            lastRefill: Date.now()
        };
    }

    res.json(users[addressKey]);
});

/* ================= TAP ================= */

app.post("/tap", (req, res) => {
    const { wallet: userWallet } = req.body;
    if (!userWallet) return res.json({ error: "Wallet required" });

    const addressKey = userWallet.toLowerCase();
    const user = users[addressKey];

    if (!user) {
        return res.json({
            error: "User not found"
        });
    }

    /* ================= AUTO REFILL ================= */

    const now = Date.now();
    const diff = Math.floor((now - user.lastRefill) / 30000);

    /*
    NO ENERGY CAP
    PURCHASED ENERGY STAYS
    */

    if (diff > 0) {
        user.energy += diff;
        user.lastRefill = now;
    }

    /* ================= TAP EXECUTION ================= */

    if (user.energy <= 0) {
        return res.json({
            error: "No energy"
        });
    }

    user.energy -= 1;
    user.points += 1;

    res.json({
        points: user.points,
        energy: user.energy,
        pvltg: user.pvltg
    });
});

/* ================= BUY ENERGY ================= */

app.post("/refill", (req, res) => {
    const { wallet: userWallet, txHash } = req.body;
    if (!userWallet) return res.json({ error: "Wallet required" });

    const addressKey = userWallet.toLowerCase();
    const user = users[addressKey];

    if (!user) {
        return res.json({
            error: "User not found"
        });
    }

    /* ================= TX REQUIRED ================= */

    if (!txHash) {
        return res.json({
            error: "Transaction hash missing"
        });
    }

    /* ================= BUY PACK ================= */

    /*
    BUY ENERGY PACK
    10000 ENERGY
    */

    user.energy += 10000;

    console.log("ENERGY PURCHASE:", addressKey, txHash);

    /* ================= RESPONSE ================= */

    res.json({
        success: true,
        energy: user.energy
    });
});

/* ================= SWAP POINTS ================= */

app.post("/swap-points", (req, res) => {
    const { wallet: userWallet } = req.body;
    if (!userWallet) return res.json({ error: "Wallet required" });

    const addressKey = userWallet.toLowerCase();
    const user = users[addressKey];

    if (!user) {
        return res.json({
            error: "User not found"
        });
    }

    /* ================= RULE ================= */

    if (user.points < 10) {
        return res.json({
            error: "Need 10 points"
        });
    }

    /* ================= CONVERT ================= */

    const earned = Math.floor(user.points / 10);
    user.points = 0;
    user.pvltg += earned;

    res.json({
        success: true,
        pvltg: user.pvltg
    });
});

/* ================= CLAIM PVLTG ================= */

app.post("/claim-pvltg", async (req, res) => {
    try {
        const { wallet: userWallet } = req.body;
        if (!userWallet) return res.json({ error: "Wallet required" });

        const addressKey = userWallet.toLowerCase();
        const user = users[addressKey];

        if (!user) {
            return res.json({
                error: "User not found"
            });
        }

        /* ================= MINIMUM REQUIREMENT ================= */

        // Swapping criteria from game client rules: Requires 10 PVLTG minimum to claim
        if (user.pvltg < 10) {
            return res.json({
                error: "Need minimum 10 PVLTG"
            });
        }

        if (!gameEngine) {
            return res.json({
                error: "Server contract configuration is missing."
            });
        }

        // Calculation: 10 PVLTG = 1 PVLT payload
        const pvltAmountToPayout = user.pvltg / 10;
        const amountInWei = ethers.utils.parseEther(pvltAmountToPayout.toString());

        console.log(`Processing swap for ${addressKey}. Converting ${user.pvltg} PVLTG into ${pvltAmountToPayout} PVLT.`);

        /* ================= SWAP TRANSACTION ================= */
        
        let tx;
        try {
            // Tries executing with custom contract layouts passing target destination
            tx = await gameEngine.swapPVLTGtoPVLT(addressKey, amountInWei);
        } catch (e) {
            // Fallback strategy if your contract layout relies strictly on msg.sender context
            tx = await gameEngine.swapPVLTGtoPVLT(amountInWei);
        }
        
        // Wait for blockchain confirmation
        await tx.wait();

        /* ================= RESET ================= */

        user.pvltg = 0;

        res.json({
            success: true,
            tx: tx.hash
        });

    } catch (err) {
        console.error("CRITICAL ERROR DURING SWAP TRANSACTION:", err);
        res.json({
            error: "Claim failed on-chain: " + (err.reason || err.message || "Unknown error")
        });
    }
});

/* ================= START ================= */

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`PVLT SERVER RUNNING ON PORT ${PORT}`);
});
