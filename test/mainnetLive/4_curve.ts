import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../util/format";
import { BN } from "../../util/number";
import { mineBlock } from "../../util/block";
import {
    CurveMaster__factory, ThreeLines0_100__factory,
} from "../../typechain-types";

/**
 * OLD
 describe("curve-threelines:", () => {
    
    it("test threelines math via curve master", async () => {
        let val: any;
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", "0")).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(6);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("25e16"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(2.3125);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("50e16"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.0525);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("525e15"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.0406);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("55e16"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.0287);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("1e18"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.005);
    });
});
 */

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

        s.newThreeLines = new ThreeLines0_100__factory(s.Frank).attach(curveResult)

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