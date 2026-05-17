// ===============================
// PVLT FULL TELEGRAM + MINING SERVER
// Deploy on Render.com
// File: server.js
// ===============================

require("dotenv").config();

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ===============================
// TELEGRAM BOT
// ===============================

const bot = new TelegramBot(
process.env.BOT_TOKEN,
{ polling:true }
);

// ===============================
// MEMORY DATABASE
// Replace later with MongoDB
// ===============================

let users = {};

// ===============================
// CONFIG
// ===============================

const POINTS_PER_TOKEN = 10000;

const MIN_WITHDRAW = 100;
const MAX_WITHDRAW = 500;

const DAY = 86400000;

// ===============================
// HOME
// ===============================

app.get("/", (req,res)=>{

res.send("PVLT Mining Server Running");

});

// ===============================
// CONNECT WALLET API
// ===============================

app.post("/connect", (req,res)=>{

const { wallet } = req.body;

if(
!wallet ||
!wallet.startsWith("0x") ||
wallet.length !== 42
){

return res.json({
success:false,
message:"Invalid wallet"
});

}

if(!users[wallet]){

users[wallet] = {

points:0,
lastClaim:0

};

}

return res.json({

success:true,
points:users[wallet].points,
tokens:
(users[wallet].points / POINTS_PER_TOKEN).toFixed(4)

});

});

// ===============================
// MINE API
// ===============================

app.post("/mine", (req,res)=>{

const { wallet } = req.body;

if(!wallet || !users[wallet]){

return res.json({
success:false
});

}

/* ADD 1 POINT */
users[wallet].points += 1;

return res.json({

success:true,

points:users[wallet].points,

tokens:
(users[wallet].points / POINTS_PER_TOKEN).toFixed(4)

});

});

// ===============================
// CLAIM API
// ===============================

app.post("/claim", async (req,res)=>{

const { wallet } = req.body;

if(!wallet || !users[wallet]){

return res.json({
success:false,
message:"Wallet not found"
});

}

let user = users[wallet];

let now = Date.now();

/* 24H RULE */

if(now - user.lastClaim < DAY){

return res.json({

success:false,
message:"Wait 24h before next claim"

});

}

/* TOKEN CALCULATION */

let tokens =
user.points / POINTS_PER_TOKEN;

/* MINIMUM */

if(tokens < MIN_WITHDRAW){

return res.json({

success:false,
message:"Minimum 100 PVLT required"

});

}

/* MAXIMUM */

if(tokens > MAX_WITHDRAW){
tokens = MAX_WITHDRAW;
}

/* ===============================
REAL SMART CONTRACT TRANSFER HERE
=============================== */

/*

Example later:

await contract.claim(
wallet,
ethers.parseUnits(
tokens.toString(),
18
)
);

*/

/* RESET USER */

user.points = 0;
user.lastClaim = now;

return res.json({

success:true,

reward:tokens.toFixed(4),

message:
"PVLT claim successful"

});

});

// ===============================
// TELEGRAM BOT COMMANDS
// ===============================

bot.onText(/\/start/, (msg)=>{

bot.sendMessage(

msg.chat.id,

"🚀 PVLT MINING BOT ACTIVE\n\n" +

"Commands:\n" +

"/connect 0xYourWallet\n" +
"/balance\n" +
"/claim"

);

});

// ===============================
// CONNECT COMMAND
// ===============================

bot.onText(/\/connect (.+)/, (msg,match)=>{

const wallet = match[1];

if(
!wallet.startsWith("0x") ||
wallet.length !== 42
){

return bot.sendMessage(
msg.chat.id,
"Invalid BSC wallet"
);

}

if(!users[wallet]){

users[wallet] = {

points:0,
lastClaim:0

};

}

bot.sendMessage(

msg.chat.id,

"✅ Wallet Connected\n\n" +
wallet

);

});

// ===============================
// BALANCE COMMAND
// ===============================

bot.onText(/\/balance/, (msg)=>{

let found = false;

for(let wallet in users){

let u = users[wallet];

found = true;

bot.sendMessage(

msg.chat.id,

"💎 Wallet:\n" +
wallet +

"\n\n⚡ Points: " +
u.points +

"\n💰 Tokens: " +
(u.points / POINTS_PER_TOKEN).toFixed(4)

);

break;

}

if(!found){

bot.sendMessage(
msg.chat.id,
"No wallet connected"
);

}

});

// ===============================
// CLAIM COMMAND
// ===============================

bot.onText(/\/claim/, (msg)=>{

let foundWallet = null;

for(let wallet in users){

foundWallet = wallet;
break;

}

if(!foundWallet){

return bot.sendMessage(
msg.chat.id,
"No wallet connected"
);

}

let user = users[foundWallet];

let now = Date.now();

if(now - user.lastClaim < DAY){

return bot.sendMessage(
msg.chat.id,
"Wait 24h"
);

}

let tokens =
user.points / POINTS_PER_TOKEN;

if(tokens < MIN_WITHDRAW){

return bot.sendMessage(
msg.chat.id,
"Minimum 100 PVLT"
);

}

if(tokens > MAX_WITHDRAW){
tokens = MAX_WITHDRAW;
}

/* RESET */

user.points = 0;
user.lastClaim = now;

bot.sendMessage(

msg.chat.id,

"✅ CLAIM SUCCESS\n\n" +

"Reward: " +
tokens.toFixed(4) +
" PVLT"

);

});

// ===============================
// SERVER START
// ===============================

const PORT =
process.env.PORT || 3000;

app.listen(PORT, ()=>{

console.log(
"PVLT SERVER RUNNING ON PORT " +
PORT
);

});
