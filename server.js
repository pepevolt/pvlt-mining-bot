require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 10000;

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || origin === 'null' || origin.startsWith('https://pepevolt.github.io')) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by Security Policy (CORS)'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

const usersDB = {};

// Hardcoded contract addresses for safety
const PVLT_TOKEN_ADDRESS = "0xf4c400280f0d6aF9340fCD491F0cb5A7b51f70F1";
const GAME_TREASURY_ADDRESS = "0x1dC8375d5D8C3fbCBaD85417ce66E9740D6b05e7";

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL || 'https://polygon-rpc.com');
const walletSigner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const treasuryContract = new ethers.Contract(
    GAME_TREASURY_ADDRESS,
    ["function claimRewards(address player, uint256 amount) external"],
    walletSigner
);

app.get('/', (req, res) => {
    res.status(200).json({ status: "online", network: "Polygon Mainnet Core" });
});

app.post('/user', (req, res) => {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: "Missing identity parameters" });
    const normalizedWallet = wallet.toLowerCase();
    
    if (!usersDB[normalizedWallet]) {
        usersDB[normalizedWallet] = {
            wallet: normalizedWallet,
            points: 0,
            energy: 50,
            pvltg: 0.0,
            lastRefill: Date.now()
        };
    }

    const user = usersDB[normalizedWallet];
    const now = Date.now();
    const intervals = Math.floor((now - user.lastRefill) / 30000);

    if (intervals > 0 && user.energy < 50) {
        user.energy = Math.min(50, user.energy + intervals);
        user.lastRefill = now;
    }
    res.json(user);
});

app.post('/tap', (req, res) => {
    const { wallet } = req.body;
    const normalizedWallet = wallet.toLowerCase();
    const user = usersDB[normalizedWallet];

    if (!user || user.energy <= 0) return res.status(400).json({ error: "Insufficient energy" });

    user.energy -= 1;
    user.points += 1;
    res.json({ points: user.points, energy: user.energy });
});

app.post('/swap-points', (req, res) => {
    const { wallet } = req.body;
    const normalizedWallet = wallet.toLowerCase();
    const user = usersDB[normalizedWallet];

    if (!user || user.points < 10000) return res.status(400).json({ error: "Minimum conversion requires 10,000 Points" });

    const pvltgGained = Math.floor(user.points / 10000);
    user.points = user.points % 10000;
    user.pvltg += pvltgGained;

    res.json({ points: user.points, pvltg: user.pvltg });
});

app.post('/refill', async (req, res) => {
    const { wallet, txHash } = req.body;
    const normalizedWallet = wallet.toLowerCase();
    const user = usersDB[normalizedWallet];

    try {
        const tx = await provider.getTransaction(txHash);
        const receipt = await tx.wait();
        if (receipt.status !== 1) return res.status(400).json({ error: "Transaction reverted onchain" });

        user.energy += 100000;
        res.json({ success: true, energy: user.energy });
    } catch (err) {
        res.status(500).json({ error: "Verification processing failed" });
    }
});

app.post('/claim-pvltg', async (req, res) => {
    const { wallet } = req.body;
    const normalizedWallet = wallet.toLowerCase();
    const user = usersDB[normalizedWallet];

    if (!user || user.pvltg < 100) return res.status(400).json({ error: "Minimum milestone requires 100 PVLTG" });
    const claimAmount = user.pvltg;

    try {
        const tokenPayoutValue = claimAmount / 100;
        const finalWeiPayout = ethers.utils.parseUnits(tokenPayoutValue.toString(), 18);

        // Core execution: transfers reward tokens directly from the treasury to the user's connected wallet address
        const tx = await treasuryContract.claimRewards(user.wallet, finalWeiPayout);
        await tx.wait();

        user.pvltg = 0;
        res.json({ success: true, pvltg: user.pvltg });
    } catch (err) {
        console.error("Payout processing exception:", err);
        res.status(500).json({ error: "Treasury lacks reward tokens or transaction failed." });
    }
});

app.listen(PORT, () => {
    console.log(`Server executing securely on port instance: ${PORT}`);
});
