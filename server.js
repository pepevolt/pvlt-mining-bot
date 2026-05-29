require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors({ origin: 'https://pepevolt.github.io' })); // Restrict to your frontend
app.use(express.json());

// In-memory storage (use Redis/Postgres for production)
const userProgress = new Map(); // address -> { taps, lastTapTime, claimed }

const SIGNER_PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const REWARD_AMOUNT = ethers.parseEther("10"); // 10 PVLT per full taps

// Helper: Anti-cheat validation
function validateTap(address, timestamp, lastTap) {
    const now = Date.now();
    // Rule 1: Min 100ms between taps
    if (now - lastTap.lastTapTime < 100) return false;
    // Rule 2: Max 10 taps per second
    const oneSecAgo = now - 1000;
    let tapsInLastSec = 0;
    if (lastTap.timestamps) {
        tapsInLastSec = lastTap.timestamps.filter(t => t > oneSecAgo).length;
    }
    if (tapsInLastSec >= 10) return false;
    return true;
}

// Endpoint: Get user progress
app.get('/progress/:address', (req, res) => {
    const address = req.params.address;
    if (!userProgress.has(address)) {
        userProgress.set(address, { taps: 0, claimed: false, lastTapTime: 0, timestamps: [] });
    }
    res.json({ taps: userProgress.get(address).taps });
});

// Endpoint: Register a tap with anti-cheat
app.post('/tap', (req, res) => {
    const { address, timestamp } = req.body;
    if (!address) return res.status(400).json({ error: 'Invalid address' });
    
    if (!userProgress.has(address)) {
        userProgress.set(address, { taps: 0, claimed: false, lastTapTime: 0, timestamps: [] });
    }
    
    const user = userProgress.get(address);
    if (user.claimed) return res.status(400).json({ error: 'Already claimed reward' });
    if (user.taps >= 50) return res.status(400).json({ error: 'Max taps reached' });
    
    if (!validateTap(address, timestamp, user)) {
        return res.status(403).json({ error: 'Cheating detected! Tap invalid.' });
    }
    
    user.taps++;
    user.lastTapTime = timestamp;
    user.timestamps.push(timestamp);
    if (user.timestamps.length > 10) user.timestamps.shift();
    userProgress.set(address, user);
    
    res.json({ taps: user.taps, canClaim: user.taps >= 50 });
});

// Endpoint: Generate claim voucher (server-signs the reward)
app.post('/claim', async (req, res) => {
    const { address } = req.body;
    if (!userProgress.has(address)) {
        return res.status(400).json({ error: 'No taps found' });
    }
    
    const user = userProgress.get(address);
    if (user.claimed) return res.status(400).json({ error: 'Already claimed' });
    if (user.taps < 50) return res.status(400).json({ error: `Only ${user.taps}/50 taps` });
    
    // Mark as claimed to prevent double claims
    user.claimed = true;
    userProgress.set(address, user);
    
    // Create signed voucher
    const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);
    const message = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256'],
        [address, REWARD_AMOUNT, Math.floor(Date.now() / 1000)]
    );
    const signature = await signer.signMessage(ethers.getBytes(message));
    
    // In real contract, you'd verify this signature
    res.json({ 
        amount: REWARD_AMOUNT.toString(),
        signature: signature,
        voucher: message
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));