require("dotenv").config();
const express = require("express");
const cors = require("cors");
const ethers = require("ethers");

const app = reportMod = express();

app.use(cors());
app.use(express.json());

// Main database mapping record entries
const userProgressDatabase = {};

let adminWallet;
let gameContractAdmin;

const GAME_ABI = [
    "function tap() external",
    "function gPVLT(address) view returns(uint256)"
];

async function initAdminSyncEngine() {
    try {
        if (process.env.PRIVATE_KEY && process.env.GAME_CONTRACT) {
            const provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com");
            adminWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            gameContractAdmin = new ethers.Contract(process.env.GAME_CONTRACT, GAME_ABI, adminWallet);
            console.log(`Admin node processor running.`);
        }
    } catch(e) {
        console.error("Failed to boot blockchain sync agent:", e);
    }
}
initAdminSyncEngine();

app.get("/api/config", (req, res) => {
    res.json({
        pvlt: process.env.PVLT_CONTRACT,
        treasury: process.env.TREASURY_CONTRACT,
        game: process.env.GAME_CONTRACT
    });
});

app.get("/api/user-stats", (req, res) => {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Missing address query locator." });

    const standardMappingKey = address.toLowerCase();
    
    if (!userProgressDatabase[standardMappingKey]) {
        userProgressDatabase[standardMappingKey] = {
            energy: 1000,
            points: 0.0
        };
    }
    res.json(userProgressDatabase[standardMappingKey]);
});

app.post("/api/sync-progress", (req, res) => {
    const { walletAddress, currentPoints, currentEnergy } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Invalid tracking payload parameters." });

    const standardMappingKey = walletAddress.toLowerCase();

    userProgressDatabase[standardMappingKey] = {
        energy: parseInt(currentEnergy) || 0,
        points: parseFloat(currentPoints) || 0.0
    };
    res.json({ success: true });
});

// Converts accumulated Points to gPVLT on the contract ledger
app.post("/api/blockchain-sync", async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Missing target address payload." });

    if (!gameContractAdmin) return res.status(500).json({ error: "Central admin engine module offline." });

    try {
        const key = walletAddress.toLowerCase();
        const localRecord = userProgressDatabase[key] || { energy: 1000, points: 0.0 };

        const contractScoreWei = await gameContractAdmin.gPVLT(walletAddress);
        const contractScore = parseFloat(ethers.utils.formatEther(contractScoreWei));

        // Sync points gap to on-chain gPVLT ledger entries
        if (localRecord.points > contractScore) {
            const gapDifference = Math.floor(localRecord.points - contractScore);
            console.log(`Writing verification block: syncing ${gapDifference} items for ${walletAddress}`);

            for(let i = 0; i < gapDifference; i++) {
                const tx = await gameContractAdmin.tap({ gasLimit: 120000 });
                await tx.wait();
            }
        }
        res.json({ success: true });
    } catch(err) {
        console.error("Ledger synchronization failure:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVER DEPLOYED ON PORT ${PORT}`));
