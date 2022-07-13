import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { toNumber } from "../../../util/math"
import { BN } from "../../../util/number";
import { s } from "../scope";
import { d } from "../DeploymentInfo";

import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import { IERC20__factory, VaultController__factory, USDI__factory, OracleMaster__factory, CurveMaster__factory, ProxyAdmin__factory, ILido__factory, ILidoOracle__factory } from "../../../typechain-types";
import _ from "lodash";
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
let usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";
let AMPL_WHALE = "0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2"

if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        //https://etherscan.io/tx/0x9faf2315d32ada8a38178beba6bdc32b4b7e7f6a6bb90c42c53eeda0904deb66
        expect(await reset(15127785)).to.not.throw;//15127781
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [false])).to.not
            .throw;
    });
});

describe("Token Setup", () => {
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
        s.WETH = IERC20__factory.connect(s.wethAddress, s.Frank);

        s.AMPL = IERC20__factory.connect(s.AMPL_ADDR, s.Frank)

    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Curve = CurveMaster__factory.connect(d.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)

    })
    it("Should succesfully transfer money", async () => {
        //for some reason at this block, account 1 has 1 USDC, need to burn so all accounts are equal
        await s.USDC.connect(s.accounts[1]).transfer(usdc_minter, await s.USDC.balanceOf(s.accounts[1].address))
        await mineBlock()
        for (let i = 0; i < s.accounts.length; i++) {
            await expect(
                stealMoney(AMPL_WHALE, s.accounts[i].address, s.AMPL.address, s.AMPL_AMOUNT)
            ).to.not.be.reverted;
            await mineBlock()
            expect(await s.AMPL.balanceOf(s.accounts[i].address)).to.eq(s.AMPL_AMOUNT, "Ample received")
        }
    });
});