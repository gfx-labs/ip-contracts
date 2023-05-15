import { expect, assert } from "chai";
import { ethers, network } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from "./scope";
import { d } from "../DeploymentInfo";
import { getArgs, toNumber } from "../../../util/math"
import { advanceBlockHeight, reset, mineBlock, currentBlock } from "../../../util/block";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import { IERC20__factory, INFPmanager__factory, INonfungiblePositionManager__factory, IOracleRelay__factory, InterestProtocolTokenDelegate__factory, OracleMaster__factory, ProxyAdmin__factory, USDI__factory, VaultController__factory, VotingVaultController__factory } from "../../../typechain-types";
//import { assert } from "console";


import { PromiseOrValue } from "../../../typechain-types/common";

require("chai").should();


describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(17167757)).to.not.throw;//16579684, 14940917
    });
    it("set automine", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
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
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank)
        s.WETH = IERC20__factory.connect(s.wethAddress, s.Frank)
        s.WBTC = IERC20__factory.connect(s.wbtcAddress, s.Frank)
        s.wethOracle = IOracleRelay__factory.connect(s.wethOracleAddr, s.Frank)
        s.wbtcOracle = IOracleRelay__factory.connect(s.wbtcOracleAddr, s.Frank)

    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)
        
        s.IPT = InterestProtocolTokenDelegate__factory.connect(d.IPTDelegator, s.Frank)

        const vvc = "0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2"
        s.VotingVaultController = VotingVaultController__factory.connect(vvc, s.Frank)


    })
    it("Should succesfully transfer money", async () => {
        let usdc_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
        const wbtc_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
        let weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";

        await stealMoney(usdc_minter, s.Frank.address, s.USDC.address, s.USDC_AMOUNT)
        await stealMoney(usdc_minter, s.Bob.address, s.USDC.address, s.USDC_AMOUNT.mul(10))
        await stealMoney(usdc_minter, s.Carol.address, s.USDC.address, s.USDC_AMOUNT)
        await stealMoney(usdc_minter, s.Dave.address, s.USDC.address, s.USDC_AMOUNT.mul(5))

        await stealMoney(weth_minter, s.Bob.address, s.WETH.address, s.WETH_AMOUNT)
        await stealMoney(wbtc_minter, s.Bob.address, s.wbtcAddress, s.wBTC_Amount)

    })




});

