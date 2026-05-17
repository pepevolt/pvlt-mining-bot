const { Telegraf } = require('telegraf');
const http = require('http');

// 1. Initialize Telegram Bot safely
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("CRITICAL ERROR: BOT_TOKEN environment variable is missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
let users = {};

bot.start((ctx) => {
  const id = ctx.chat.id;
  users[id] = users[id] || { wallet: null, balance: 0 };
  ctx.reply("🚀 PVLT BOT IS LIVE 24/7\n\nCommands:\n/wallet <address>\n/mine <points>\n/balance");
});

bot.command('wallet', (ctx) => {
  const id = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = text.split(" ").slice(1).join(" ");
  if (!args) return ctx.reply("⚠️ Usage: /wallet <address>");
  
  users[id] = users[id] || { wallet: null, balance: 0 };
  users[id].wallet = args;
  ctx.reply("✅ Wallet saved:\n" + args);
});

bot.command('mine', (ctx) => {
  const id = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = text.split(" ").slice(1)[0];
  const points = parseInt(args);
  if (isNaN(points)) return ctx.reply("⚠️ Usage: /mine <points>");
  
  users[id] = users[id] || { wallet: null, balance: 0 };
  users[id].balance = (users[id].balance || 0) + points;
  ctx.reply("⛏ Added: " + points + " points");
});

bot.command('balance', (ctx) => {
  const id = ctx.chat.id;
  let u = users[id] || { wallet: null, balance: 0 };
  ctx.reply(`📊 Balance:\nPoints: ${u.balance}\nWallet: ${u.wallet || "not set"}`);
});

// Start the bot engine
bot.launch()
  .then(() => console.log("Telegram Bot engine successfully mounted!"))
  .catch((err) => console.error("Bot launch failed:", err));

// 2. Simple HTTP Server to keep Render Happy
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot Status: Online and Active\n');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Render Web Service listening on port ${PORT}`);
});

// Safe Shuts
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
