const { ethers } = require('ethers');

let PRIVATE_KEY = "";

// إزالة 0x إذا وجدت
if (PRIVATE_KEY.startsWith('0x')) {
    PRIVATE_KEY = PRIVATE_KEY.slice(2);
}

if (PRIVATE_KEY === "YOUR_PRIVATE_KEY_HERE" || PRIVATE_KEY.length !== 64) {
    console.log("ERROR: ضع المفتاح الخاص الصحيح (64 حرف بدون 0x)");
    process.exit(1);
}

const message = "Admin action at " + Date.now();
const wallet = new ethers.Wallet(PRIVATE_KEY);
const signature = wallet.signMessageSync(message);

console.log("x-wallet-address:", wallet.address);
console.log("x-message:", message);
console.log("x-signature:", signature);
console.log("\n--- CURL ---");
console.log(`curl -X POST https://infov-08oy.onrender.com/api/v1/admin/tasks \\
  -H "Content-Type: application/json" \\
  -H "x-wallet-address: ${wallet.address}" \\
  -H "x-message: ${message}" \\
  -H "x-signature: ${signature}" \\
  -d '{"title":"Test","points":100,"platform":"TELEGRAM","type":"SOCIAL","isActive":true,"maxSubmissions":1}'`);
