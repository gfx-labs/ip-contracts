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
    VoteDelegate,
    VoteDelegate__factory,
    MKRVotingVaultController,
    MKRVotingVaultController__factory,
    MKRVotingVault,
    MKRVotingVault__factory,
    VaultController__factory
} from "../../../../typechain-types";

let mkrVotingVaultController: MKRVotingVaultController;
let vaultAddress;
let vault: MKRVotingVault;
let MKRToken: IERC20;

const delegatee = "0x4C28d8402ac01E5d623e4A5438535369770Fe407";
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
        s.Carol = s.accounts[8];
    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank);
        await stealMoney(MKR_WHALE, s.Carol.address, MKR, ethers.utils.parseEther("10"));
    });
});

describe("MKRVotingVault Test", async() => {
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
    });

    it("should delegate held MKR", async () => {
        const amountDelegated = ethers.utils.parseEther("5");
        await mkrVotingVaultController.mintVault(s.CaroLVaultID);
        const addr = await mkrVotingVaultController.votingVaultAddress(s.CaroLVaultID);

        await MKRToken.connect(s.Carol).transfer(addr, await MKRToken.balanceOf(s.Carol.address));

        vault = MKRVotingVault__factory.connect(addr, s.Carol);

        const balanceBefore = await MKRToken.balanceOf(addr);
        await vault.delegateMKRLikeTo(delegatee, MKR, amountDelegated);
        await mineBlock();

        const balanceAfter = await MKRToken.balanceOf(addr);
        expect(balanceBefore.sub(amountDelegated)).to.be.equal(balanceAfter);

        const delegate: VoteDelegate = VoteDelegate__factory.connect(delegatee, s.Frank);
        const stake = await delegate.stake(addr);
        expect(stake).to.be.equal(amountDelegated);
    });

    it("should delegate to multiple", async () => {
        const delegateeTwo = "0xe2bfDa5e1f59325E4b8dF5feaA30e4aB6516bf28";
        const amountDelegated = ethers.utils.parseEther("5");
        const addr = await mkrVotingVaultController.votingVaultAddress(s.CaroLVaultID);

        await vault.delegateMKRLikeTo(delegateeTwo, MKR, amountDelegated);
        await mineBlock();

        const balanceAfter = await MKRToken.balanceOf(addr);
        expect(0).to.be.equal(balanceAfter);

        const delegate: VoteDelegate = VoteDelegate__factory.connect(delegatee, s.Frank);
        const stake = await delegate.stake(addr);
        expect(stake).to.be.equal(amountDelegated);

        const delegateTwo: VoteDelegate = VoteDelegate__factory.connect(delegateeTwo, s.Frank);
        const stakeTwo = await delegateTwo.stake(addr);
        expect(stakeTwo).to.be.equal(amountDelegated);
    });

    it("should undelegate stake", async () => {
        const amountDelegated = ethers.utils.parseEther("5");
        const addr = await mkrVotingVaultController.votingVaultAddress(s.CaroLVaultID);
        const balanceBefore = await MKRToken.balanceOf(addr);

        await vault.undelegateMKRLike(delegatee, amountDelegated);
        await mineBlock();

        const balanceAfter = await MKRToken.balanceOf(addr);
        expect(balanceBefore.add(amountDelegated)).to.be.equal(balanceAfter);

        const delegate: VoteDelegate = VoteDelegate__factory.connect(delegatee, s.Frank);
        const stake = await delegate.stake(addr);
        expect(stake).to.be.equal(0);
    });
});
