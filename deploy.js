const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("─────────────────────────────────────────");
  console.log("  PolygonNFT — Deployment Script");
  console.log("─────────────────────────────────────────");

  const [deployer] = await ethers.getSigners();
  console.log(`\n🔑 Deployer address : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Deployer balance : ${ethers.formatEther(balance)} MATIC\n`);

  // ── Deployment parameters
  const MINT_PRICE = ethers.parseEther("1");            // 1 MATIC
  const BASE_URI   = process.env.BASE_URI ||
                     "ipfs://QmYourCIDHere/";           // Replace with real IPFS CID

  console.log(`📌 Mint price : ${ethers.formatEther(MINT_PRICE)} MATIC`);
  console.log(`📌 Base URI   : ${BASE_URI}`);

  
  console.log("\n⏳ Deploying contract...");
  const PolygonNFT = await ethers.getContractFactory("PolygonNFT");
  const nft = await PolygonNFT.deploy(
    deployer.address,   
    MINT_PRICE,         
    BASE_URI            
  );

  await nft.waitForDeployment();
  const contractAddress = await nft.getAddress();

  console.log(`\n✅ PolygonNFT deployed!`);
  console.log(`📄 Contract address : ${contractAddress}`);
  console.log(`🌐 Explorer link    : https://mumbai.polygonscan.com/address/${contractAddress}`);


  if (
    hre.network.name !== "hardhat" &&
    hre.network.name !== "localhost" &&
    process.env.POLYGONSCAN_API_KEY
  ) {
    console.log("\n⏳ Waiting 10 blocks before verification...");
    await nft.deploymentTransaction().wait(10);

    console.log("🔍 Verifying on Polygonscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [deployer.address, MINT_PRICE, BASE_URI],
      });
      console.log("✅ Contract verified on Polygonscan!");
    } catch (err) {
      console.warn("⚠️  Verification failed:", err.message);
    }
  }

  // ── Write deployment info to file 
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress,
    deployer: deployer.address,
    mintPrice: ethers.formatEther(MINT_PRICE),
    baseURI: BASE_URI,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n📁 Deployment info saved to deployment.json");
  console.log("─────────────────────────────────────────\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Deployment failed:", err);
    process.exit(1);
  });
