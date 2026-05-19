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

const abi = [
"function mint(address to,uint256 amount) external"
];

const gameContract =
new ethers.Contract(
process.env.PVLTG,
abi,
wallet
);

/* ================= USER ================= */

app.post("/user",(req,res)=>{

const { wallet } = req.body;

if(!users[wallet]){

users[wallet] = {
points:0,
energy:50,
pvltg:0,
lastClaim:0
};
}

res.json(users[wallet]);
});

/* ================= TAP ================= */

app.post("/tap",(req,res)=>{

const { wallet } = req.body;

const user = users[wallet];

if(!user)
return res.json({
error:"User not found"
});

if(user.energy <= 0)
return res.json({
error:"No energy"
});

user.energy -= 1;

user.points += 1;

res.json(user);
});

/* ================= REFILL ================= */

app.post("/refill",(req,res)=>{

const { wallet } = req.body;

const user = users[wallet];

if(!user)
return res.json({
error:"User not found"
});

user.energy += 50;

res.json(user);
});

/* ================= POINTS → PVLTG ================= */

app.post("/swap-points",(req,res)=>{

const { wallet } = req.body;

const user = users[wallet];

if(user.points < 10000){

return res.json({
error:"Need 10000 points"
});
}

const earned =
Math.floor(user.points / 10000);

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

if(user.pvltg < 1){

return res.json({
error:"No PVLTG"
});
}

const amount =
ethers.utils.parseEther(
user.pvltg.toString()
);

const tx =
await gameContract.mint(
wallet,
amount
);

await tx.wait();

user.pvltg = 0;

res.json({
success:true,
tx:tx.hash
});

}catch(err){

console.log(err);

res.json({
error:"Mint failed"
});
}
});

/* ================= START ================= */

app.listen(
process.env.PORT || 10000,
()=>{
console.log("PVLT SERVER RUNNING");
});