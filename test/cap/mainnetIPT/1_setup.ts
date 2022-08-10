import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { d } from "../DeploymentInfo";

import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import {InterestProtocolTokenDelegate__factory, IERC20__factory, IVOTE__factory, VaultController__factory, USDI__factory, OracleMaster__factory, CurveMaster__factory, ProxyAdmin__factory, VotingVaultController__factory, CappedGovToken__factory, VotingVault__factory, IVault__factory } from "../../../typechain-types";
//import { assert } from "console";

require("chai").should();
//*
// Initial Balances:
// Andy: 100,000,000 usdc ($100) 6dec
// Bob: 10,000,000,000,000,000,000 weth (10 weth) 18dec
// Carol: 100,000,000,000,000,000,000 (100 comp), 18dec
// Dave: 10,000,000,000 usdc ($10,000) 6dec
//
// andy is a usdc holder. he wishes to deposit USDC to hold USDI
// bob is an eth holder. He wishes to deposit his eth and borrow USDI
// carol is a comp holder. she wishes to deposit her comp and then vote
// dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob
// configurable variables
let usdc_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
let wbtc_minter = "0xf977814e90da44bfa03b6295a0616a897441acec"
let uni_minter = "0xf977814e90da44bfa03b6295a0616a897441acec"
let dydx_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let ens_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let aave_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let tribe_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";


if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(15316435)).to.not.throw;//14940917
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [false])).to.not
            .throw;
    });
});

describe("Token Setup", () => {
    it("connect to signers", async () => {
        let accounts = await ethers.getSigners();
        s.Frank = accounts[0];
        s.Eric = accounts[5];
        s.Andy = accounts[6];
        s.Bob = accounts[7];
        s.Carol = accounts[8];
        s.Dave = accounts[9];
        s.Gus = accounts[10];
    });
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank);
        s.WETH = IERC20__factory.connect(s.wethAddress, s.Frank);
        s.UNI = IVOTE__factory.connect(s.uniAddress, s.Frank);
        s.WBTC = IERC20__factory.connect(s.wbtcAddress, s.Frank);
        s.COMP = IVOTE__factory.connect(s.compAddress, s.Frank);
        s.ENS = IVOTE__factory.connect(s.ensAddress, s.Frank);
        s.DYDX = IVOTE__factory.connect(s.dydxAddress, s.Frank);


        s.AAVE = IVOTE__factory.connect(s.aaveAddress, s.Frank);

        
        s.TRIBE = IVOTE__factory.connect(s.tribeAddress, s.Frank);

    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Curve = CurveMaster__factory.connect(d.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)
        const IPTaddress = "0xd909C5862Cdb164aDB949D92622082f0092eFC3d"
        s.IPT = InterestProtocolTokenDelegate__factory.connect(IPTaddress, s.Frank);
        const deployerVault = "0x85a5fD00bB725661F639F7300D48f64671D33BE5"
        s.DeployerVault = IVault__factory.connect(deployerVault, s.Frank)


    })

    it("Connect to mainnet deployments for capped IPT", async () => {

        const vvc = "0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2"
        s.VotingVaultController = VotingVaultController__factory.connect(vvc, s.Frank)
        const cipt = "0x42b4D79aE23165541f24c4cD52494fe8516B3C80"
        s.cIPT = CappedGovToken__factory.connect(cipt, s.Frank)
        const votingVaultAddress = "0xD80A8f7e3ba76afAcBfa66E01Bdf3c9776A6Aa5a"
        s.DeployerVotingVault = VotingVault__factory.connect(votingVaultAddress, s.Frank)


    })
    it("Should succesfully transfer money", async () => {
        //showBody(`stealing ${s.Andy_USDC} to andy from ${s.usdcAddress}`);
        await stealMoney(usdc_minter, s.Andy.address, s.usdcAddress, s.Andy_USDC)
        await mineBlock()
        await stealMoney(aave_minter, s.Andy.address, s.aaveAddress, s.aaveAmount)
        await mineBlock()

        //showBody(`stealing ${s.Dave_USDC} to dave from ${s.usdcAddress}`);
        await stealMoney(usdc_minter, s.Dave.address, s.usdcAddress, s.Dave_USDC)
        await mineBlock()

        //showBody(`stealing ${s.Carol_UNI} to carol from ${s.uniAddress}`);
        await stealMoney(uni_minter, s.Carol.address, s.uniAddress, s.Carol_UNI)
        await mineBlock()

        //showBody(`stealing ${s.Gus_WBTC} to gus from ${s.wbtcAddress}`);
        await stealMoney(wbtc_minter, s.Gus.address, s.wbtcAddress, s.Gus_WBTC)
        await mineBlock()

        //showBody(`stealing ${s.Bob_WETH} weth to bob from ${s.wethAddress}`);
        await stealMoney(weth_minter, s.Bob.address, s.wethAddress, s.Bob_WETH)
        await mineBlock()

        await stealMoney(aave_minter, s.Bob.address, s.aaveAddress, s.aaveAmount)
        await mineBlock()

        await stealMoney(aave_minter, s.Gus.address, s.aaveAddress, s.aaveAmount)
        await mineBlock()

        //steal IPT for Bob and Carol
        await stealMoney(s.DEPLOYER._address, s.Bob.address, s.IPT.address, s.aaveAmount)
        await mineBlock()
        await stealMoney(s.DEPLOYER._address, s.Carol.address, s.IPT.address, s.aaveAmount)
        await mineBlock()
        await stealMoney(s.DEPLOYER._address, s.Gus.address, s.IPT.address, s.aaveAmount)
        await mineBlock()



        //showBody(`stealing`,s.Bob_USDC,`usdc to bob from ${s.usdcAddress}`);
        await stealMoney(usdc_minter, s.Bob.address, s.usdcAddress, s.Bob_USDC)
        await mineBlock()

         //showBody(`stealing ${s.Carol_ENS} ens to carol from ${s.ensAddress}`);
         await expect(
            stealMoney(ens_minter, s.Carol.address, s.ensAddress, s.Carol_ENS)
        ).to.not.be.reverted;
        //showBody(`stealing ${s.Carol_DYDX} dydx to carol from ${s.dydxAddress}`);
        await expect(
            stealMoney(dydx_minter, s.Carol.address, s.dydxAddress, s.Carol_DYDX)
        ).to.not.be.reverted;

        await mineBlock();


        
        
    });
});