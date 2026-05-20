import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const users = {};

/* ================= PROVIDER ================= */

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

/* ⚠️ NEVER expose this wallet */
const adminWallet = new ethers.Wallet(
  process.env.PRIVATE_KEY || "",
  provider
);

/* ================= CONTRACTS ================= */

const pvltAbi = [
  "function mint(address to,uint256 amount) external"
];

const engineAbi = [
  "function swapPVLTGtoPVLT(uint256 amount) external"
];

const pvltToken = new ethers.Contract(
  process.env.PVLT_TOKEN,
  pvltAbi,
  adminWallet
);

const engineContract = new ethers.Contract(
  process.env.ENGINE_CONTRACT,
  engineAbi,
  adminWallet
);

/* ================= ROUTES ================= */

app.get("/", (req, res) => {
  res.send("PVLT SERVER RUNNING");
});

/* ================= USER ================= */

app.post("/user", (req, res) => {
  const { wallet } = req.body;

  if (!wallet) return res.json({ error: "Wallet required" });

  if (!users[wallet]) {
    users[wallet] = {
      points: 0,
      energy: 50,
      pvltg: 0,
      lastRefill: Date.now()
    };
  }

  res.json(users[wallet]);
});

/* ================= TAP ================= */

app.post("/tap", (req, res) => {
  const { wallet } = req.body;
  const user = users[wallet];

  if (!user) return res.json({ error: "User not found" });

  const now = Date.now();
  const diff = Math.floor((now - user.lastRefill) / 30000);

  if (diff > 0) {
    user.energy += diff;
    user.lastRefill = now;
  }

  if (user.energy <= 0) {
    return res.json({ error: "No energy" });
  }

  user.energy -= 1;
  user.points += 1;

  res.json(user);
});

/* ================= REFILL ================= */

app.post("/refill", (req, res) => {
  const { wallet, txHash } = req.body;
  const user = users[wallet];

  if (!user) return res.json({ error: "User not found" });
  if (!txHash) return res.json({ error: "Missing txHash" });

  user.energy += 10000;

  res.json({
    success: true,
    energy: user.energy
  });
});

/* ================= SWAP ================= */

app.post("/swap-points", (req, res) => {
  const { wallet } = req.body;
  const user = users[wallet];

  if (!user) return res.json({ error: "User not found" });

  if (user.points < 10) {
    return res.json({ error: "Need 10 points" });
  }

  const earned = Math.floor(user.points / 10);

  user.points = 0;
  user.pvltg += earned;

  res.json({
    success: true,
    pvltg: user.pvltg
  });
});

/* ================= CLAIM (MINT) ================= */

app.post("/claim-pvltg", async (req, res) => {
  try {
    const { wallet } = req.body;
    const user = users[wallet];

    if (!user) return res.json({ error: "User not found" });

    if (user.pvltg < 1) {
      return res.json({ error: "Need 1 PVLTG minimum" });
    }

    const amount = ethers.utils.parseEther(user.pvltg.toString());

    const tx = await pvltToken.mint(wallet, amount);
    await tx.wait();

    user.pvltg = 0;

    res.json({
      success: true,
      tx: tx.hash
    });

  } catch (err) {
    console.log(err);
    res.json({ error: "Claim failed" });
  }
});

/* ================= START ================= */

app.listen(process.env.PORT || 3000, () => {
  console.log("PVLT SERVER RUNNING");
});