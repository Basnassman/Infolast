import { ethers, run } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main(): Promise<void> {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY غير موجود في .env");
  }

  // ─── العناوين النهائية ──────────────────────────────────────────────
  const timelockAddress = "0x58bc68c09f0cD742Dc6c037283A9a4dc12C0cf7d";
  const oracleAddress   = "0x1bBb37E4B24BC0a361daB4617905A968FC4430b9";
  const tokenAddress    = "0x3a1523D2ba093446457c037928601D789749EeaF";
  const vestingAddress  = "0x14B214B4591d48bE94FB7F5D52e704A5113DfE11";
  const airdropAddress  = "0x474C3a1CbD03d58FAFCeAD88A93806A9b0617ed5";
  const saleAddress     = "0x0cc202dF8ACe32375cbCf02c6aC1896362cD60A4";

  const deployerAddress = "0x54FdC4531400dAA82C00B68c5c91dB327Abdf15c";
  const TREASURY_WALLET = deployerAddress;

  // ─── قراءة القيم المخزنة لـ Constructor Args ─────────────────────────
  const vesting = await ethers.getContractAt("Vesting", vestingAddress);
  const startTime = await vesting.startTime();

  const sale = await ethers.getContractAt("Sale", saleAddress);
  const saleCap = await sale.saleCap();
  const walletCap = await sale.walletCap();
  const minPurchase = await sale.minPurchase();
  const saleStart = await sale.saleStart();
  const saleEnd = await sale.saleEnd();

  // ─── تعريف وسائط النشر ──────────────────────────────────────────────
  const timelockArgs = [
    300,
    [deployerAddress],
    [deployerAddress],
    deployerAddress
  ];

  const oracleArgs = [deployerAddress];

  const TOKEN_NAME = "Token For";
  const TOKEN_SYMBOL = "For";
  const TREASURY_AMOUNT = ethers.parseEther("400000000");
  const VESTING_AMOUNT  = ethers.parseEther("300000000");
  const AIRDROP_AMOUNT  = ethers.parseEther("100000000");
  const SALE_AMOUNT     = ethers.parseEther("200000000");

  const tokenArgs = [
    TOKEN_NAME,
    TOKEN_SYMBOL,
    timelockAddress,
    TREASURY_WALLET,
    vestingAddress,
    airdropAddress,
    saleAddress,
    TREASURY_AMOUNT,
    VESTING_AMOUNT,
    AIRDROP_AMOUNT,
    SALE_AMOUNT
  ];

  const vestingArgs = [
    tokenAddress,
    TREASURY_WALLET,
    deployerAddress,
    startTime
  ];

  const airdropArgs = [
    tokenAddress,
    vestingAddress,
    TREASURY_WALLET,
    timelockAddress
  ];

  const saleArgs = [
    tokenAddress,
    vestingAddress,
    oracleAddress,
    TREASURY_WALLET,
    deployerAddress,
    saleCap,
    walletCap,
    minPurchase,
    saleStart,
    saleEnd
  ];

  // ─── التحقق من جميع العقود ──────────────────────────────────────────
  console.log("🔍 Verifying Timelock...");
  await run("verify:verify", {
    address: timelockAddress,
    constructorArguments: timelockArgs,
  });

  console.log("🔍 Verifying Oracle...");
  await run("verify:verify", {
    address: oracleAddress,
    constructorArguments: oracleArgs,
  });

  console.log("🔍 Verifying Token...");
  await run("verify:verify", {
    address: tokenAddress,
    constructorArguments: tokenArgs,
  });

  console.log("🔍 Verifying Vesting...");
  await run("verify:verify", {
    address: vestingAddress,
    constructorArguments: vestingArgs,
  });

  console.log("🔍 Verifying Airdrop...");
  await run("verify:verify", {
    address: airdropAddress,
    constructorArguments: airdropArgs,
  });

  console.log("🔍 Verifying Sale...");
  await run("verify:verify", {
    address: saleAddress,
    constructorArguments: saleArgs,
  });

  console.log("\n✅ جميع العقود تم توثيقها بنجاح!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});