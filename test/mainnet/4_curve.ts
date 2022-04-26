import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../util/format";
import { BN } from "../../util/number";
import { mineBlock } from "../../util/block";

describe("curve-threelines:", () => {
    it("test setting a new curve", async () => {
        await expect(s.Curve.connect(s.Frank).set_curve(
            "0x0000000000000000000000000000000000000000",
            s.ThreeLines.address
        )).to.not.reverted;
        await mineBlock();
    })
    it("test threelines math via curve master", async () => {
        let val: any;
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", "0")).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(2);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("25e16"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(1.025);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("50e16"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.05);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("525e15"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.0475);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("55e16"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.045);
        val = (await s.Curve.getValueAt("0x0000000000000000000000000000000000000000", BN("1e18"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.045);
    });
});