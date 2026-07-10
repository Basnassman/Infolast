import { ethers, run } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main(): Promise<void> {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY غير موجود في .env");
  }

  // ─── العناوين النهائية ──────────────────────────────────────────────
  const timelockAddress = "0xF69f3b16f360A547e8960f211A6818f4d7C33b89";
  const oracleAddress   = "0x13425A5F4A68eC0D660EC4Ea5E21d42BA8e686Db";
  const tokenAddress    = "0x32e64b5f40139f36D46dfbEa20Ef7A7C1EA76721";
  const vestingAddress  = "0x8597F2723335E61Cd1CC1C21c962Ff393685Ca98";
  const airdropAddress  = "0x10C50DC51d14089D80866803A15Dce112B17f799";
  const saleAddress     = "0x864C2350945bd4E9F7097F76CED2B10fD0cD2D99";

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