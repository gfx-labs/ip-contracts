import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../util/money";
import { showBody } from "../../util/format";
import { BN } from "../../util/number";
import { s } from "./scope";
import { d } from "./DeploymentInfo";
import { advanceBlockHeight, reset, mineBlock } from "../../util/block";
import { toNumber } from "../../util/math";

import {
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    CurveMaster,
    CurveMaster__factory,
    IERC20,
    IERC20__factory,
    IOracleRelay,
    OracleMaster,
    OracleMaster__factory,
    ProxyAdmin,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    ThreeLines0_100,
    ThreeLines0_100__factory,
    UniswapV3OracleRelay__factory,
    USDI,
    USDI__factory,
    Vault,
    VaultController,
    VaultController__factory,
    IVaultController__factory,
    IVOTE,
    IVOTE__factory,
  } from "../../typechain-types";

require("chai").should();

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
        expect(await reset(15186589)).to.not.throw;//14940917
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
       

    })
    it("Should succesfully transfer money", async () => {
        //showBody(`stealing ${s.Andy_USDC} to andy from ${s.usdcAddress}`);
        await stealMoney(usdc_minter, s.Andy.address, s.usdcAddress, s.Andy_USDC)
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
