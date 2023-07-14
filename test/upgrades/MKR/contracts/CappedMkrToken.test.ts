import { s } from "../scope";
import { a, c, d } from "../../../../util/addresser"
import { ethers, network } from "hardhat";
import { stealMoney } from "../../../../util/money";
import { expect } from "chai";
import { mineBlock, reset } from "../../../../util/block";
import {
    IERC20,
    IERC20__factory,
    IVault__factory,
    MKRVotingVaultController,
    MKRVotingVaultController__factory,
    CappedMkrToken,
    CappedMkrToken__factory,
    VaultController__factory
} from "../../../../typechain-types";

let mkrVotingVaultController: MKRVotingVaultController;
let vaultAddress;
let MKRToken: IERC20;
let token: CappedMkrToken;

const MKR = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";
const MKR_WHALE = "0xe9aaa7a9ddc0877626c1779abc29993ad89a6c1f";

describe("Initial Settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(17403274)).to.not.throw;
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not.throw;
    });
});

describe("Initial Setup", () => {
    it("connect to signers", async () => {
        s.accounts = await ethers.getSigners();
        s.Frank = s.accounts[0];
        s.Eric = s.accounts[5];
        s.Andy = s.accounts[6];
        s.Bob = s.accounts[7];
        s.Carol = s.accounts[8];
    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank);
        await stealMoney(MKR_WHALE, s.Carol.address, MKR, ethers.utils.parseEther("10"));
    });
});

describe("CappedMkrToken Test", async() => {
    before(async () => {
        await expect(s.VaultController.connect(s.Carol).mintVault()).to.not.reverted;
        await mineBlock();
        s.CaroLVaultID = await s.VaultController.vaultsMinted();
        vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID);
        s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
        expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
        MKRToken = IERC20__factory.connect(MKR, s.Frank);

        mkrVotingVaultController = await new MKRVotingVaultController__factory(s.Frank).deploy();
        await mkrVotingVaultController.deployed();
        await mkrVotingVaultController.initialize(d.VaultController);

        token = await new CappedMkrToken__factory(s.Frank).deploy();
        await token.deployed();
        await token.initialize("Maker", "MKR", MKR, d.VaultController, mkrVotingVaultController.address);
    });

    it("should return false for transferFrom", async () => {
        const result = await token.transferFrom(s.Frank.address, s.Carol.address, ethers.utils.parseEther("1"));
        expect(result).to.be.equal(false);
    });

    it("should return 0 for cap as not yet set", async () => {
        expect(await token.getCap()).to.be.equal(0);
    });

    it("should correctly set cap", async () => {
        const cap = ethers.utils.parseEther("5");
        await token.setCap(cap);
        await mineBlock();
        expect(await token.getCap()).to.be.equal(cap);
    });

    it("should revert if deposit zero", async () => {
        await expect(token.deposit(0, s.CaroLVaultID)).to.be.revertedWith("CannotDepositZero()");
    });

    it("should revert if deposit to invalid vault id", async () => {
        await expect(token.deposit(100, 100000)).to.be.revertedWith("InvalidMKRVotingVault()");
    });

    it("should revert cap reached", async () => {
        await mkrVotingVaultController.mintVault(s.CaroLVaultID);
        await expect(token.deposit(ethers.utils.parseEther("6"), s.CaroLVaultID)).to.be.revertedWith("CapReached()");
    });

    it("should revert insufficientAllowance", async () => {
        await expect(token.deposit(ethers.utils.parseEther("3"), s.CaroLVaultID)).to.be.revertedWith("InsufficientAllowance()");
    });

    it("should deposit successfully", async () => {
        await MKRToken.connect(s.Carol).approve(token.address, ethers.utils.parseEther("1"));
        await expect(token.connect(s.Carol).deposit(ethers.utils.parseEther("1"), s.CaroLVaultID)).to.not.be.reverted;
    });
});
