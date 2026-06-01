const { ethers } = require('ethers');

const PRIVATE_KEY = "5233a5794699933900eb816dcae84c17d087db5c2683cebba28261d1eb4dbb55";

if (PRIVATE_KEY === "5233a5794699933900eb816dcae84c17d087db5c2683cebba28261d1eb4dbb55") {
    console.log("ERROR: Set your private key");
    process.exit(1);
}

const message = "Admin action at " + Date.now();
const wallet = new ethers.Wallet(PRIVATE_KEY);
const signature = wallet.signMessageSync(message);

console.log("node -e \"");
console.log("const {ethers} = require('ethers');");
console.log("const wallet = new ethers.Wallet('" + PRIVATE_KEY + "');");
console.log("const msg = '" + message + "';");
console.log("const sig = wallet.signMessageSync(msg);");
console.log("fetch('https://infov-08oy.onrender.com/api/v1/admin/tasks', {");
console.log("  method: 'POST',");
console.log("  headers: {");
console.log("    'Content-Type': 'application/json',");
console.log("    'x-wallet-address': wallet.address,");
console.log("    'x-message': msg,");
console.log("    'x-signature': sig,");
console.log("  },");
console.log("  body: JSON.stringify({title:'Test',points:100,platform:'TELEGRAM',type:'SOCIAL',url:'',isActive:true,maxSubmissions:1})");
console.log("}).then(r=>r.json()).then(d=>console.log(d));");
console.log("\"");
