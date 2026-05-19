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
    provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || "https://polygon-rpc.com", {
        chainId: 137,
        name: "polygon"
    });

    if (process.env.PRIVATE_KEY) {
        serverWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const treasuryAbi = [
            "function processPlayerClaim(address _playerWallet, uint256 _pvltgAmount) external",
            "function purchaseEnergyPack(address _playerWallet) external"
        ];
        // Using your target deployed address baseline fallback
        const treasuryAddress = process.env.TREASURY_ADDRESS || "0x3FdCE8aB325E03d527605dd2f01730cd981F594F";
        treasuryContract = new ethers.Contract(treasuryAddress, treasuryAbi, serverWallet);
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
        users[key] = { points: 0, energy: 20, pvltg: 0.0, lastEnergyDepleted: Date.now() };
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
    user.points += 2; 

    if (user.energy === 0) {
        user.lastEnergyDepleted = Date.now();
    }

    res.json({ points: user.points, energy: user.energy, pvltg: user.pvltg });
});

app.post("/buy-energy", async (req, res) => {
    try {
        const { wallet } = req.body;
        if (!wallet) return res.json({ error: "Wallet target parameter required" });
        
        const key = wallet.toLowerCase();
        const user = users[key];
        if (!user) return res.json({ error: "User not found" });
        if (!treasuryContract) return res.json({ error: "Treasury not loaded on server" });

        console.log(`Processing server-signed purchase of energy pack for ${key}...`);
        
        // Server wallet signs and triggers the on-chain collection execution safely
        const tx = await treasuryContract.purchaseEnergyPack(key);
        await tx.wait();

        user.energy = 20; // Resets game layout loop state back to max capacity
        user.lastEnergyDepleted = 0; 
        
        res.json({ success: true, energy: user.energy });
    } catch (err) {
        console.error("ENERGY PURCHASE TRANSACTION REVERTED:", err);
        res.json({ error: "Transaction reverted on chain. Energy pack addition canceled." });
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

    res.json({ success: true, pvltg: user.pvltg, points: user.points });
});

// --- MATCHED TO UI TRIGGER ROUTE: /withdraw-pvltg ---
app.post("/withdraw-pvltg", async (req, res) => {
    try {
        const { wallet } = req.body;
        if (!wallet) return res.json({ error: "Wallet parameter missing" });
        
        const key = wallet.toLowerCase();
        const user = users[key];
        if (!user) return res.json({ error: "User profile context uninitialized" });
        
        if (user.pvltg <= 0) {
            return res.json({ error: "No available $PVLTG tokens to claim." });
        }

        const rawBalance = user.pvltg;
        const amountInWei = ethers.utils.parseEther(rawBalance.toString());

        if (!treasuryContract) return res.json({ error: "Treasury connection offline" });

        console.log(`Executing server reward release to: ${key}...`);
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
