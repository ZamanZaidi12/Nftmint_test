const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// ─── Constants ──────────────────────────────────────────────────────────────
const MINT_PRICE = ethers.parseEther("1"); // 1 MATIC
const BASE_URI   = "ipfs://QmTest/";
const MAX_SUPPLY = 5n;

// ─── Shared Fixture ─────────────────────────────────────────────────────────
async function deployFixture() {
  const [owner, alice, bob, carol] = await ethers.getSigners();

  const PolygonNFT = await ethers.getContractFactory("PolygonNFT");
  const nft = await PolygonNFT.deploy(owner.address, MINT_PRICE, BASE_URI);
  await nft.waitForDeployment();

  return { nft, owner, alice, bob, carol };
}

// ─── Test Suites ─────────────────────────────────────────────────────────────
describe("PolygonNFT", function () {

  // ── Deployment ─────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      expect(await nft.owner()).to.equal(owner.address);
    });

    it("should set name and symbol correctly", async function () {
      const { nft } = await loadFixture(deployFixture);
      expect(await nft.name()).to.equal("PolygonNFT");
      expect(await nft.symbol()).to.equal("PNFT");
    });

    it("should set the initial mint price", async function () {
      const { nft } = await loadFixture(deployFixture);
      expect(await nft.mintPrice()).to.equal(MINT_PRICE);
    });

    it("should set MAX_SUPPLY to 5", async function () {
      const { nft } = await loadFixture(deployFixture);
      expect(await nft.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("should start with zero minted tokens", async function () {
      const { nft } = await loadFixture(deployFixture);
      expect(await nft.totalMinted()).to.equal(0n);
    });

    it("should revert if deployed with zero address as owner", async function () {
      const PolygonNFT = await ethers.getContractFactory("PolygonNFT");
      await expect(
        PolygonNFT.deploy(ethers.ZeroAddress, MINT_PRICE, BASE_URI)
      ).to.be.revertedWithCustomError(
        await PolygonNFT.deploy(
          (await ethers.getSigners())[0].address, MINT_PRICE, BASE_URI
        ),
        "ZeroAddress"
      );
    });

    it("should revert if deployed with zero mint price", async function () {
      const PolygonNFT = await ethers.getContractFactory("PolygonNFT");
      const [owner] = await ethers.getSigners();
      await expect(
        PolygonNFT.deploy(owner.address, 0n, BASE_URI)
      ).to.be.revertedWithCustomError(
        { interface: (await PolygonNFT.deploy(owner.address, MINT_PRICE, BASE_URI)).interface },
        "ZeroPrice"
      );
    });
  });

  // ── Minting: Success ────────────────────────────────────────────────────────
  describe("Mint — success path", function () {
    it("should mint token ID 1 to the recipient", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });

      expect(await nft.ownerOf(1)).to.equal(alice.address);
    });

    it("should increment totalMinted after each mint", async function () {
      const { nft, alice, bob } = await loadFixture(deployFixture);

      await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });
      expect(await nft.totalMinted()).to.equal(1n);

      await nft.connect(bob).mint(bob.address, { value: MINT_PRICE });
      expect(await nft.totalMinted()).to.equal(2n);
    });

    it("should assign sequential token IDs (1, 2, 3...)", async function () {
      const { nft, alice, bob, carol } = await loadFixture(deployFixture);

      await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });
      await nft.connect(bob).mint(bob.address,  { value: MINT_PRICE });
      await nft.connect(carol).mint(carol.address, { value: MINT_PRICE });

      expect(await nft.ownerOf(1)).to.equal(alice.address);
      expect(await nft.ownerOf(2)).to.equal(bob.address);
      expect(await nft.ownerOf(3)).to.equal(carol.address);
    });

    it("should emit NFTMinted event with correct args", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      await expect(
        nft.connect(alice).mint(alice.address, { value: MINT_PRICE })
      )
        .to.emit(nft, "NFTMinted")
        .withArgs(alice.address, 1n, MINT_PRICE);
    });

    it("should allow minting to a different address than msg.sender", async function () {
      const { nft, alice, bob } = await loadFixture(deployFixture);

      // Alice pays but mints to Bob
      await nft.connect(alice).mint(bob.address, { value: MINT_PRICE });
      expect(await nft.ownerOf(1)).to.equal(bob.address);
    });

    it("should accept exact payment and not change contract balance incorrectly", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      const before = await ethers.provider.getBalance(await nft.getAddress());
      await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });
      const after = await ethers.provider.getBalance(await nft.getAddress());

      expect(after - before).to.equal(MINT_PRICE);
    });

    it("should refund overpayment to sender", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      const overpay     = MINT_PRICE + ethers.parseEther("0.5");
      const aliceBefore = await ethers.provider.getBalance(alice.address);

      const tx      = await nft.connect(alice).mint(alice.address, { value: overpay });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const aliceAfter = await ethers.provider.getBalance(alice.address);

      // Alice's net cost should be ~mintPrice + gas (overpayment refunded)
      const netCost = aliceBefore - aliceAfter - gasCost;
      expect(netCost).to.be.closeTo(MINT_PRICE, ethers.parseEther("0.01"));
    });

    it("should return correct tokenURI", async function () {
      const { nft, alice } = await loadFixture(deployFixture);
      await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });

      expect(await nft.tokenURI(1)).to.equal(`${BASE_URI}1.json`);
    });
  });

  // ── Supply Limit Enforcement ────────────────────────────────────────────────
  describe("Supply limit enforcement", function () {
    it("should allow minting exactly MAX_SUPPLY (5) tokens", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      for (let i = 0; i < 5; i++) {
        await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });
      }
      expect(await nft.totalMinted()).to.equal(5n);
    });

    it("should revert on the 6th mint with MaxSupplyReached", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      for (let i = 0; i < 5; i++) {
        await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });
      }

      await expect(
        nft.connect(alice).mint(alice.address, { value: MINT_PRICE })
      ).to.be.revertedWithCustomError(nft, "MaxSupplyReached");
    });

    it("should report remainingSupply = 0 after selling out", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      for (let i = 0; i < 5; i++) {
        await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });
      }
      expect(await nft.remainingSupply()).to.equal(0n);
    });

    it("should decrease remainingSupply with each mint", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      expect(await nft.remainingSupply()).to.equal(5n);
      await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });
      expect(await nft.remainingSupply()).to.equal(4n);
    });
  });

  // ── Payment Validation ──────────────────────────────────────────────────────
  describe("Payment validation", function () {
    it("should revert when no ETH is sent", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      await expect(
        nft.connect(alice).mint(alice.address, { value: 0 })
      ).to.be.revertedWithCustomError(nft, "InsufficientPayment");
    });

    it("should revert when payment is below mint price", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      const under = MINT_PRICE - 1n;
      await expect(
        nft.connect(alice).mint(alice.address, { value: under })
      ).to.be.revertedWithCustomError(nft, "InsufficientPayment");
    });

    it("should revert minting to zero address", async function () {
      const { nft, alice } = await loadFixture(deployFixture);

      await expect(
        nft.connect(alice).mint(ethers.ZeroAddress, { value: MINT_PRICE })
      ).to.be.revertedWithCustomError(nft, "ZeroAddress");
    });
  });

  // ── Owner-Only Permissions ──────────────────────────────────────────────────
  describe("Owner-only permissions", function () {

    describe("setMintPrice", function () {
      it("should allow owner to update mint price", async function () {
        const { nft, owner } = await loadFixture(deployFixture);
        const newPrice = ethers.parseEther("2");

        await nft.connect(owner).setMintPrice(newPrice);
        expect(await nft.mintPrice()).to.equal(newPrice);
      });

      it("should emit MintPriceUpdated event", async function () {
        const { nft, owner } = await loadFixture(deployFixture);
        const newPrice = ethers.parseEther("0.5");

        await expect(nft.connect(owner).setMintPrice(newPrice))
          .to.emit(nft, "MintPriceUpdated")
          .withArgs(MINT_PRICE, newPrice);
      });

      it("should revert if non-owner calls setMintPrice", async function () {
        const { nft, alice } = await loadFixture(deployFixture);
        await expect(
          nft.connect(alice).setMintPrice(ethers.parseEther("2"))
        ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
      });

      it("should revert if new price is zero", async function () {
        const { nft, owner } = await loadFixture(deployFixture);
        await expect(
          nft.connect(owner).setMintPrice(0n)
        ).to.be.revertedWithCustomError(nft, "ZeroPrice");
      });
    });

    describe("setBaseURI", function () {
      it("should allow owner to update base URI", async function () {
        const { nft, owner, alice } = await loadFixture(deployFixture);

        await nft.connect(owner).setBaseURI("ipfs://NewCID/");
        await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });

        expect(await nft.tokenURI(1)).to.equal("ipfs://NewCID/1.json");
      });

      it("should revert if non-owner calls setBaseURI", async function () {
        const { nft, alice } = await loadFixture(deployFixture);
        await expect(
          nft.connect(alice).setBaseURI("ipfs://Hacked/")
        ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
      });
    });

    describe("withdraw", function () {
      it("should allow owner to withdraw contract balance", async function () {
        const { nft, owner, alice } = await loadFixture(deployFixture);

        await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });

        const ownerBefore = await ethers.provider.getBalance(owner.address);
        const tx = await nft.connect(owner).withdraw();
        const receipt = await tx.wait();
        const gasCost = receipt.gasUsed * receipt.gasPrice;
        const ownerAfter = await ethers.provider.getBalance(owner.address);

        expect(ownerAfter - ownerBefore + gasCost).to.equal(MINT_PRICE);
      });

      it("should emit FundsWithdrawn event", async function () {
        const { nft, owner, alice } = await loadFixture(deployFixture);
        await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });

        await expect(nft.connect(owner).withdraw())
          .to.emit(nft, "FundsWithdrawn")
          .withArgs(owner.address, MINT_PRICE);
      });

      it("should revert if non-owner calls withdraw", async function () {
        const { nft, alice } = await loadFixture(deployFixture);
        await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });

        await expect(
          nft.connect(alice).withdraw()
        ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
      });

      it("should revert withdraw when balance is zero", async function () {
        const { nft, owner } = await loadFixture(deployFixture);
        await expect(
          nft.connect(owner).withdraw()
        ).to.be.revertedWith("No funds to withdraw");
      });

      it("should zero out contract balance after withdrawal", async function () {
        const { nft, owner, alice } = await loadFixture(deployFixture);
        await nft.connect(alice).mint(alice.address, { value: MINT_PRICE });
        await nft.connect(owner).withdraw();

        const balance = await ethers.provider.getBalance(await nft.getAddress());
        expect(balance).to.equal(0n);
      });
    });
  });
});
