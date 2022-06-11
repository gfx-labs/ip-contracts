import { s } from "./scope";
import {d} from "./DeploymentInfo"
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../util/format";
import { BN } from "../../util/number";
import { mineBlock } from "../../util/block";
import { toNumber } from "../../util/math";



describe("getting prices from oracle master", () => {
    it("fetch eth price", async () => {
        let dog = (await s.Oracle.getLivePrice(d.WETH)).div(1e14).toNumber() / 1e4
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });

    it("uni price", async () => {
        let dog = (await s.Oracle.getLivePrice(d.UNI)).div(1e14).toNumber() / 1e4
        expect(dog).to.be.above(1).and.to.be.below(100);
    })
    it("wbtc price", async () => {
        let rawPrice = await s.Oracle.getLivePrice(d.WBTC)
        rawPrice = rawPrice.div(BN("1e10"))
        let format = await toNumber(rawPrice)

        expect(format).to.be.above(10000).and.to.be.below(70000);
    })
});