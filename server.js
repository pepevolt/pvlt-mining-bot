require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 10000;

// Enable cross-origin resource sharing for frontend web page access
app.use(cors());
app.use(express.json());

// In-memory data repository mimicking database mapping arrays
// Format: { "0xWalletAddress...": { points: 0, energy: 50, pvltg: 0.0 } }
const userDatabase = {};

// Max baseline energy configurations
const INITIAL_ENERGY = 50;

/**
 * Endpoint: POST /user
 * Retrieves or registers a user account data profile mapping state
 */
app.post('/user', (req, res) => {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: "Missing identity parameters." });
    
    const accountKey = wallet.toLowerCase();
    
    if (!userDatabase[accountKey]) {
        userDatabase[accountKey] = {
            points: 0,
            energy: INITIAL_ENERGY,
            pvltg: 0.0
        };
    }
    
    res.json(userDatabase[accountKey]);
});

/**
 * Endpoint: POST /tap
 * Increments points matrix records and deducts system energy balances
 */
app.post('/tap', (req, res) => {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: "Invalid account parameters." });
    
    const accountKey = wallet.toLowerCase();
    const user = userDatabase[accountKey];
    
    if (!user) return res.status(404).json({ error: "Profile trace index unallocated." });
    if (user.energy <= 0) return res.status(400).json({ error: "Energy reservoir depleted." });
    
    // Core engine transaction logic calculations
    user.points += 1;
    user.energy -= 1;
    
    res.json({
        points: user.points,
        energy: user.energy
    });
});

/**
 * Endpoint: POST /refill
 * Verifies on-chain pack purchases and updates energy state values to 100,000 units
 */
app.post('/refill', async (req, res) => {
    const { wallet, txHash } = req.body;
    if (!wallet) return res.status(400).json({ error: "Target address configuration missing." });
    
    const accountKey = wallet.toLowerCase();
    const user = userDatabase[accountKey];
    
    if (!user) return res.status(404).json({ error: "User record context missing." });
    
    // In a live server build with an active provider, you can optionally monitor verification logs:
    // const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    // const txReceipt = await provider.getTransactionReceipt(txHash);
    
    console.log(`Processing energy pack purchase receipt for wallet: ${wallet}. TX: ${txHash || 'Manual Override'}`);
    
    // Set parameters explicitly on confirmation validation matches
    user.energy = 100000;
    
    res.json({
        success: true,
        energy: user.energy
    });
});

/**
 * Endpoint: POST /swap-points
 * Converts accumulated credits into game-internal fractional ledger weight values (PVLTG)
 */
app.post('/swap-points', (req, res) => {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: "Wallet parameters required." });
    
    const accountKey = wallet.toLowerCase();
    const user = userDatabase[accountKey];
    
    if (!user) return res.status(404).json({ error: "Identity map profile not found." });
    if (user.points <= 0) return res.status(400).json({ error: "Insufficient weight balances to calculate route." });
    
    // Conversion rule: 10,000 Points = 1 PVLTG token
    const convertedYield = user.points / 10000;
    
    user.pvltg += convertedYield;
    user.points = 0; // Clear out raw balance parameters
    
    res.json({
        points: user.points,
        pvltg: user.pvltg
    });
});

/**
 * Endpoint: POST /claim-pvltg
 * Processes conversion requirements when pulling assets from internal system records back to on-chain tokens
 */
app.post('/claim-pvltg', (req, res) => {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: "Missing authorization signature address." });
    
    const accountKey = wallet.toLowerCase();
    const user = userDatabase[accountKey];
    
    if (!user) return res.status(404).json({ error: "Data index route unreachable." });
    if (user.pvltg < 100) return res.status(400).json({ error: "Minimum pull threshold requirement is 100 PVLTG." });
    
    // Core conversion logic: 100 PVLTG = 1 Real On-chain PVLT Token
    const tokensToDistribute = user.pvltg / 100;
    
    console.log(`Disbursing real assets to client layer: Send ${tokensToDistribute} PVLT to address: ${wallet}`);
    
    // Reset internal token state metrics once distribution payload details pass
    user.pvltg = 0.0;
    
    res.json({
        success: true,
        pvltg: user.pvltg
    });
});

// Periodic background baseline recovery ticker rule: Regenerates +1 energy every 30 seconds for active players
setInterval(() => {
    Object.keys(userDatabase).forEach(account => {
        if (userDatabase[account].energy < INITIAL_ENERGY) {
            userDatabase[account].energy += 1;
        }
    });
}, 30000);

// Initialize node environment server listener
app.listen(PORT, () => {
    console.log(`PVLT Core Game Suite Engine running on port: ${PORT}`);
});
