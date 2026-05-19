import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const users = {}; 

let provider;
let serverWallet;
let treasuryContract;

try {
    const rpc = process.env.RPC_URL ? process.env.RPC_URL.trim() : "";
    const pkey = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.trim() : "";
    const treasuryHex = process.env.TREASURY_ADDRESS ? process.env.TREASURY_ADDRESS.trim() : "";

    provider = new ethers.providers.JsonRpcProvider(rpc, {
        chainId: 137,
        name: "polygon"
    });

    if (pkey) {
        serverWallet = new ethers.Wallet(pkey, provider);
        const treasuryAbi = [
            "function processPlayerClaim(address _playerWallet, uint256 _pvltgAmount) external",
            "function purchaseEnergyPack(address _playerWallet) external"
        ];
        if (treasuryHex) {
            treasuryContract = new ethers.Contract(treasuryHex, treasuryAbi, serverWallet);
        }
    }
} catch (error) {
    console.error("Boot configuration mismatch runtime log:", error.message);
}

function updateEnergyRefill(user) {
    const now = Date.now();
    if (user.energy === 0) {
        const elapsedSeconds = Math.floor((now - user.lastEnergyDepleted) / 1000);
        if (elapsedSeconds > 0) {
            const addedEnergy = Math.min(elapsedSeconds, 20);
            user.energy = addedEnergy;
        }
    }
    return user;
}

app.post("/user", (req, res) => {
    const { wallet } = req.body;
    if (!wallet) return res.json({ error: "Wallet required" });
    const key = wallet.toLowerCase();
    
    if (!users[key]) {
        users[key] = { points: 265, energy: 9787, pvltg: 0.0, lastEnergyDepleted: Date.now() };
    }
    users[key] = updateEnergyRefill(users[key]);
    res.json(users[key]);
});

app.post("/tap", (req, res) => {
    const { wallet } = req.body;
    const key = wallet.toLowerCase();
    let user = users[key];
    if (!user) return res.json({ error: "User session uninitialized" });

    user = updateEnergyRefill(user);

    if (user.energy <= 0) {
        if (!user.lastEnergyDepleted || user.lastEnergyDepleted === 0) {
            user.lastEnergyDepleted = Date.now();
        }
        return res.json({ error: "Energy depleted. Wait for auto-refill or buy instant energy!", energy: 0, points: user.points });
    }

    user.energy -= 1;
    user.points += 2; // 1 Tap = 2 Points

    if (user.energy === 0) {
        user.lastEnergyDepleted = Date.now();
    }

    res.json({ points: user.points, energy: user.energy, pvltg: user.pvltg });
});

app.post("/buy-energy", async (req, res) => {
    try {
        const { wallet } = req.body;
        const key = wallet.toLowerCase();
        const user = users[key];
        if (!user) return res.json({ error: "User not found" });
        if (!treasuryContract) return res.json({ error: "Treasury not loaded on server" });

        console.log(`Processing on-chain purchase of energy for ${key}...`);
        
        const tx = await treasuryContract.purchaseEnergyPack(key);
        await tx.wait();

        user.energy += 10000; 
        user.lastEnergyDepleted = 0; 
        
        res.json({ success: true, energy: user.energy });
    } catch (err) {
        console.error("ENERGY PURCHASE TRANSACTION REVERTED:", err);
        res.json({ error: "Transaction declined on Polygonscan. Balance modification rejected." });
    }
});

app.post("/swap-points", (req, res) => {
    const { wallet } = req.body;
    const key = wallet.toLowerCase();
    const user = users[key];
    if (!user) return res.json({ error: "Profile missing" });

    if (user.points < 2000) return res.json({ error: "Minimum 2,000 points required to swap" });

    const multiplier = Math.floor(user.points / 2000);
    user.points = user.points % 2000;
    user.pvltg += (multiplier * 4); 

    res.json({ success: true, pvltg: user.pvltg, remainingPoints: user.points });
});

app.post("/withdraw-pvltg", async (req, res) => {
    try {
        const { wallet } = req.body;
        const key = wallet.toLowerCase();
        const user = users[key];

        if (!user) return res.json({ error: "User profile context uninitialized" });
        
        const expectedPayout = user.pvltg / 500;
        
        if (expectedPayout < 10) return res.json({ error: "Withdrawal quantity below minimum required threshold of 10 PVLT" });
        if (expectedPayout > 1000) return res.json({ error: "Withdrawal quantity exceeds maximum allowed threshold of 1000 PVLT" });

        if (!treasuryContract) return res.json({ error: "Treasury contract connection not initialized" });

        const amountInWei = ethers.utils.parseEther(user.pvltg.toString());

        console.log(`Executing transaction via backend master vault for wallet: ${key}`);
        const tx = await treasuryContract.processPlayerClaim(key, amountInWei);
        await tx.wait();

        user.pvltg = 0;
        res.json({ success: true, tx: tx.hash });

    } catch (err) {
        console.error("WITHDRAW ROUTE FAILURE:", err);
        res.json({ error: "Withdrawal aborted: " + (err.reason || err.message) });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`Production middleware online on port ${PORT}`); });
