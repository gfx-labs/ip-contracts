import { s } from "../scope";
import { ethers, network, tenderly } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number";
import {
    ProxyAdmin,
    ProxyAdmin__factory,
    USDI__factory,
    IVault__factory
} from "../../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
} from "../../../../util/block";
import { toNumber, getGas } from "../../../../util/math";

const usdcAmount = BN("50e6")
const usdiAmount = BN("50e18")

const USDC_BORROW = BN("1000e6")//1k USDC
const USDI_BORROW = BN("100e18")//500 USDI



require("chai").should();

describe("Verify Upgraded Contracts", () => {
    it("STETH oracle is working now", async () => {

     /**
         await impersonateAccount(s.IP_OWNER)
        let owner = ethers.provider.getSigner(s.IP_OWNER)
        await s.Oracle.connect(owner).setRelay(s.STETH_ADDRESS, "0x73052741d8bE063b086c4B7eFe084B0CEE50677A")
        await mineBlock()

        await ceaseImpersonation(s.IP_OWNER)
      */


        const price = await s.Oracle.getLivePrice(s.STETH_ADDRESS)
        showBody("Price: ", price)
        const ref = await s.Oracle.getLivePrice(s.wethAddress)
        showBody("ref: ", ref)
        expect(await toNumber(price)).to.be.closeTo(await toNumber(ref), 50, "STETH price is close to WETH price")


    })

    it("STETH has been registered", async () => {
    })
});

describe("Testing for failure on new USDI functions", () => {
    it("call deposit with amount == 0", async () => {

    })

    it("call deposit with an amount that is more than what is posessed", async () => {


    })

    it("Try to withdrawAllTo when holding 0 USDI", async () => {


    })
})

