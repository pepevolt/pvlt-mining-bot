require("dotenv").config();
const express = require("express");
const cors = require("cors");
const ethers = require("ethers");

const app = express();

app.use(cors());
app.use(express.json());

const userProgressDatabase = {};

// Instantiating the Node provider context to handle automatic blockchain updates
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
            console.log(`Synchronization wallet running: ${adminWallet.address}`);
        } else {
            console.log("Missing configuration values. Admin updates are disabled.");
        }
    } catch(e) {
        console.error("Failed to boot blockchain admin update worker:", e);
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
    if (!address) {
        return res.status(400).json({ error: "Required address identification string missing parameter mapping." });
    }

    const standardMappingKey = address.toLowerCase();
    
    if (!userProgressDatabase[standardMappingKey]) {
        userProgressDatabase[standardMappingKey] = {
            energy: 1000,
            gPVLT: 0.0
        };
    }

    res.json(userProgressDatabase[standardMappingKey]);
});

app.post("/api/sync-progress", (req, res) => {
    const { walletAddress, currentGPVLT, currentEnergy } = req.body;
    
    if (!walletAddress) {
        return res.status(400).json({ error: "Invalid synchronization payload array: wallet location expected." });
    }

    const standardMappingKey = walletAddress.toLowerCase();

    userProgressDatabase[standardMappingKey] = {
        energy: parseInt(currentEnergy) || 0,
        gPVLT: parseFloat(currentGPVLT) || 0.0
    };

    res.json({ success: true, timestamp: Date.now() });
});

// Endpoint that signs users' free taps onto the blockchain right before a claim/convert
app.post("/api/blockchain-sync", async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Missing address identification payload." });

    if (!gameContractAdmin) {
        return res.status(500).json({ error: "Admin wallet engine is offline. Confirm PRIVATE_KEY is set in Render settings." });
    }

    try {
        const key = walletAddress.toLowerCase();
        const localRecord = userProgressDatabase[key] || { energy: 1000, gPVLT: 0.0 };

        // Query the chain to check what score the contract currently sees
        const contractScoreWei = await gameContractAdmin.gPVLT(walletAddress);
        const contractScore = parseFloat(ethers.utils.formatEther(contractScoreWei));

        // Sync points up if the player has accumulated server-side points
        if (localRecord.gPVLT > contractScore) {
            const tapDifference = Math.floor(localRecord.gPVLT - contractScore);
            console.log(`Writing ${tapDifference} missing database score elements for ${walletAddress}`);

            // Loop and invoke the server tx to sync points to the contract mapping record
            for(let i = 0; i < tapDifference; i++) {
                const tx = await gameContractAdmin.tap({ gasLimit: 120000 });
                await tx.wait();
            }
        }
        res.json({ success: true });
    } catch(err) {
        console.error("Blockchain execution failure:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/", (req, res) => {
    res.send("PVLT HYBRID SERVER RUNNING - CLICKS PERSISTENCE INTERFACES DEPLOYED OPERATIONAL");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SERVER STARTED ON PORT ${PORT}`);
});
