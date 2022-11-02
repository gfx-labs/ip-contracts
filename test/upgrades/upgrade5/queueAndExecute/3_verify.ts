import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number";
import {
    IVault__factory,
    VotingVault,
    IVault,
    VotingVault__factory,
    CurveMaster__factory,
    curve
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

    const expectedValues = {
        _r0: "3000000000000000000",
        _r1: "200000000000000000",
        _r2: "5000000000000000",
        _s1: "350000000000000000",
        _s2: "650000000000000000"
    }

    it("Confirm IP is returning the correct curve contract", async () => {
        const curveMasterAddr = await s.VaultController.getCurveMaster()
        const curveMaster = CurveMaster__factory.connect(curveMasterAddr, s.Frank)

        const curveResult = await curveMaster._curves("0x0000000000000000000000000000000000000000")

        expect(curveResult).to.hexEqual(s.NEW_CURVE)

    })

    it("Check new curve values", async () => {

        let result = await s.newThreeLines._r0()
        expect(result.toString()).to.eq(expectedValues._r0, "_r0 is correct")

        result = await s.newThreeLines._r1()
        expect(result.toString()).to.eq(expectedValues._r1, "_r1 is correct")

        result = await s.newThreeLines._r2()
        expect(result.toString()).to.eq(expectedValues._r2, "_r2 is correct")

        result = await s.newThreeLines._s1()
        expect(result.toString()).to.eq(expectedValues._s1, "_s1 is correct")

        result = await s.newThreeLines._s2()
        expect(result.toString()).to.eq(expectedValues._s2, "_s2 is correct")

    })

});





