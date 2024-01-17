import { expect } from "chai";
import { ethers, network } from "hardhat";
import { stealMoney } from "../../../../util/money";
import { s } from "../scope";
import { reset, mineBlock, resetCurrent } from "../../../../util/block";
import {
    CurveMaster__factory, IERC20__factory, OracleMaster__factory, ProxyAdmin__factory, USDI__factory, VotingVaultController__factory,
    VaultController__factory,
    InterestProtocolTokenDelegate__factory, IVOTE__factory, ITokenDelegate__factory
} from "../../../../typechain-types";
import { d } from "../../../../util/addresser"
require("chai").should();

// configurable variables
let usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";
let ens_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let weth_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        await resetCurrent()
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw;
    });
});

describe("Initial Setup - Upgrade IPT", () => {
    it("connect to signers", async () => {
        s.accounts = await ethers.getSigners();
        s.Frank = s.accounts[0];
        s.Eric = s.accounts[5];
        s.Andy = s.accounts[6];
        s.Bob = s.accounts[7];
        s.Carol = s.accounts[8];
        s.Dave = s.accounts[9];
        s.Gus = s.accounts[10];
    });
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank);

    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Curve = CurveMaster__factory.connect(d.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)
        s.IPT = InterestProtocolTokenDelegate__factory.connect(d.IPT, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)


        const vvc = "0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2"
        s.VotingVaultController = VotingVaultController__factory.connect(vvc, s.Frank)


    })
});
