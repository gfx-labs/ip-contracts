import { s } from "../scope";
import { expect } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";

import {
    CurveMaster__factory,
} from "../../../../typechain-types";


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





