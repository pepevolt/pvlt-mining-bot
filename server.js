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

/* ================= POLYGON ================= */

const provider =
new ethers.providers.JsonRpcProvider(
process.env.RPC_URL
);

const wallet =
new ethers.Wallet(
process.env.PRIVATE_KEY,
provider
);

/* ================= CONTRACTS ================= */

const pvltgAbi = [
"function mint(address to,uint256 amount) external"
];

const gameAbi = [
"function swapPVLTGtoPVLT(uint256 amount) external"
];

const pvltg =
new ethers.Contract(
process.env.PVLTG,
pvltgAbi,
wallet
);

const gameEngine =
new ethers.Contract(
process.env.ENGINE,
gameAbi,
wallet
);

/* ================= HEALTH ================= */

app.get("/",(req,res)=>{

res.send("PVLT SERVER RUNNING");

});

/* ================= CREATE USER ================= */

app.post("/user",(req,res)=>{

const { wallet } = req.body;

if(!wallet){

return res.json({
error:"Wallet required"
});
}

if(!users[wallet]){

users[wallet] = {

points:0,

energy:50,

pvltg:0,

lastRefill:Date.now()

};
}

res.json(users[wallet]);

});

/* ================= TAP ================= */

app.post("/tap",(req,res)=>{

const { wallet } = req.body;

const user = users[wallet];

if(!user){

return res.json({
error:"User not found"
});
}

/* ================= AUTO REFILL ================= */

const now = Date.now();

const diff =
Math.floor(
(now - user.lastRefill)
/
30000
);

/*
NO ENERGY CAP
PURCHASED ENERGY STAYS
*/

if(diff > 0){

user.energy += diff;

user.lastRefill = now;
}

/* ================= TAP ================= */

if(user.energy <= 0){

return res.json({
error:"No energy"
});
}

user.energy -= 1;

user.points += 1;

res.json({

points:user.points,

energy:user.energy,

pvltg:user.pvltg

});

});

/* ================= BUY ENERGY ================= */

app.post("/refill",(req,res)=>{

const { wallet, txHash } = req.body;

const user = users[wallet];

if(!user){

return res.json({
error:"User not found"
});
}

/* ================= TX REQUIRED ================= */

if(!txHash){

return res.json({
error:"Transaction hash missing"
});
}

/* ================= BUY PACK ================= */

/*
BUY ENERGY PACK
10000 ENERGY
*/

user.energy += 10000;

console.log(
"ENERGY PURCHASE:",
wallet,
txHash
);

/* ================= RESPONSE ================= */

res.json({

success:true,

energy:user.energy

});

});

/* ================= SWAP POINTS ================= */

app.post("/swap-points",(req,res)=>{

const { wallet } = req.body;

const user = users[wallet];

if(!user){

return res.json({
error:"User not found"
});
}

/* ================= RULE ================= */

if(user.points < 10){

return res.json({
error:"Need 10 points"
});
}

/* ================= CONVERT ================= */

const earned =
Math.floor(
user.points / 10
);

user.points = 0;

user.pvltg += earned;

res.json({

success:true,

pvltg:user.pvltg

});

});

/* ================= CLAIM PVLTG ================= */

app.post("/claim-pvltg",async(req,res)=>{

try{

const { wallet } = req.body;

const user = users[wallet];

if(!user){

return res.json({
error:"User not found"
});
}

/* ================= MINIMUM ================= */

if(user.pvltg < 1){

return res.json({
error:"Need minimum 1 PVLTG"
});
}

/* ================= MINT PVLTG ================= */

const amount =
ethers.utils.parseEther(
user.pvltg.toString()
);

const tx =
await pvltg.mint(
wallet,
amount
);

await tx.wait();

/* ================= RESET ================= */

user.pvltg = 0;

res.json({

success:true,

tx:tx.hash

});

}catch(err){

console.log(err);

res.json({
error:"Claim failed"
});
}

});

/* ================= START ================= */

app.listen(
process.env.PORT || 10000,
()=>{

console.log(
"PVLT SERVER RUNNING"
);

});
