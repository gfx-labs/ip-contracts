import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../util/format";
import { BN } from "../../util/number";
import { mineBlock } from "../../util/block";

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