import { s } from "../scope";
import { d } from "../DeploymentInfo";
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

describe("MKRVotingVaultController Test", async() => {
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

    it("should register underlying", async () => {
        await mkrVotingVaultController.registerUnderlying(MKR, token.address);
    });

    it("should revert if invalid vault", async () => {
        await expect(mkrVotingVaultController.retrieveUnderlying(ethers.utils.parseEther("1"), "0x4C28d8402ac01E5d623e4A5438535369770Fe407", token.address)).to.be.revertedWith("OnlyCappedToken()");
    });
});
