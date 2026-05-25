import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

/* ================= APP ================= */

const app = express();

app.use(cors());

app.use(express.json());

/* ================= MEMORY STORAGE ================= */

const users = {};

/* ================= ROOT ================= */

app.get("/",(req,res)=>{

res.send("PVLT SERVER RUNNING");

});

/* ================= CREATE / LOAD USER ================= */

app.post("/user",(req,res)=>{

try{

const { wallet } = req.body;

if(!wallet){

return res.json({
error:"Wallet required"
});
}

/* ================= CREATE ================= */

if(!users[wallet]){

users[wallet] = {

points:0,

energy:50,

pvltg:0,

lastRefill:Date.now()

};
}

/* ================= RETURN ================= */

res.json(users[wallet]);

}catch(err){

console.log(err);

res.json({
error:"Server error"
});
}
});

/* ================= TAP ================= */

app.post("/tap",(req,res)=>{

try{

const { wallet } = req.body;

if(!wallet){

return res.json({
error:"Wallet required"
});
}

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
/ 30000
);

if(diff > 0){

user.energy =
Math.min(
50,
user.energy + diff
);

user.lastRefill = now;
}

/* ================= CHECK ENERGY ================= */

if(user.energy <= 0){

return res.json({
error:"No energy left"
});
}

/* ================= TAP ================= */

user.energy -= 1;

user.points += 1;

/* ================= RETURN ================= */

res.json({

success:true,

points:user.points,

energy:user.energy,

pvltg:user.pvltg

});

}catch(err){

console.log(err);

res.json({
error:"Tap failed"
});
}
});

/* ================= REFILL ================= */

app.post("/refill",(req,res)=>{

try{

const { wallet } = req.body;

if(!wallet){

return res.json({
error:"Wallet required"
});
}

const user = users[wallet];

if(!user){

return res.json({
error:"User not found"
});
}

/* ================= ADD ENERGY ================= */

user.energy += 1000;

/* ================= LIMIT ================= */

if(user.energy > 5000){

user.energy = 5000;
}

/* ================= RETURN ================= */

res.json({

success:true,

energy:user.energy

});

}catch(err){

console.log(err);

res.json({
error:"Refill failed"
});
}
});

/* ================= SWAP POINTS ================= */

app.post("/swap-points",(req,res)=>{

try{

const { wallet } = req.body;

if(!wallet){

return res.json({
error:"Wallet required"
});
}

const user = users[wallet];

if(!user){

return res.json({
error:"User not found"
});
}

/* ================= RULE ================= */

if(user.points < 10000){

return res.json({
error:"Need minimum 10000 points"
});
}

/* ================= CONVERT ================= */

const earned =
Math.floor(
user.points / 10000
);

/* ================= RESET ================= */

user.points = 0;

/* ================= ADD PVLTG ================= */

user.pvltg += earned;

/* ================= RETURN ================= */

res.json({

success:true,

points:user.points,

pvltg:user.pvltg

});

}catch(err){

console.log(err);

res.json({
error:"Swap failed"
});
}
});

/* ================= CLAIM ================= */

app.post("/claim-pvltg",(req,res)=>{

try{

const { wallet } = req.body;

if(!wallet){

return res.json({
error:"Wallet required"
});
}

const user = users[wallet];

if(!user){

return res.json({
error:"User not found"
});
}

/* ================= RULE ================= */

if(user.pvltg < 100){

return res.json({
error:"Need minimum 100 PVLTG"
});
}

/* ================= RESET ================= */

user.pvltg = 0;

/* ================= RETURN ================= */

res.json({

success:true,

message:"PVLT claimed successfully"

});

}catch(err){

console.log(err);

res.json({
error:"Claim failed"
});
}
});

/* ================= START ================= */

const PORT =
process.env.PORT || 10000;

app.listen(PORT,()=>{

console.log(
"PVLT SERVER RUNNING ON PORT",
PORT
);

});