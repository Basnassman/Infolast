import { ethers, run } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main(): Promise<void> {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY غير موجود في .env");
  }

  // ─── العناوين النهائية ──────────────────────────────────────────────
  const timelockAddress = "0x4d6D868DeDf8a7C4b64b0AD3787bFb18B4E88D2C";
  const oracleAddress   = "0xB3F5f8734B56231D3555c2d06D73D1F47f2F9bba";
  const tokenAddress    = "0xfFD230D537d5C3EC22cEFb7F0C3a50fAde919f13";
  const vestingAddress  = "0x55a4471d3ADAdAf6EeAa0Ea63153337653193eaC";
  const airdropAddress  = "0x445B458bdA0Fd4a9CF035a83aD8DC55e49F79347";
  const saleAddress     = "0xF6629F2f1C844318aE181b3A79bAD2380967E1be";

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