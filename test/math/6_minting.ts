import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../util/format";
import { BN } from "../util/number";
import { advanceBlockHeight, mineBlock } from "../util/block";

describe("Vault setup:", () => {
    it("andy deposits usdc for usdi", async () => {
        //showBody("andy has", s.Andy_USDC, "USDC")
        expect(await s.USDC.balanceOf(s.Andy.address)).to.eq(s.Andy_USDC)
        //showBody(`deposits ${s.Andy_USDC} USDC`)
        await s.USDC.connect(s.Andy).approve(s.USDI.address, s.Andy_USDC);
        await s.USDI.connect(s.Andy).deposit(s.Andy_USDC);
        await advanceBlockHeight(1);
        let av = BN(s.Andy_USDC).mul(BN("1e12"))
        //showBody(`andy should have ${av} usdi`)
        expect(await s.USDI.balanceOf(await s.Andy.getAddress())).to.eq(av);
    })
    it("dave deposits usdc for usdi", async () => {
        //showBody("dave has", s.Dave_USDC, "USDC")
        expect(await s.USDC.balanceOf(s.Dave.address)).to.eq(s.Dave_USDC)
        //showBody(`dave deposits ${s.Dave_USDC} USDC`)
        await s.USDC.connect(s.Dave).approve(s.USDI.address, s.Dave_USDC);
        await s.USDI.connect(s.Dave).deposit(s.Dave_USDC);
        await advanceBlockHeight(1);
        let dv = BN(s.Dave_USDC).mul(BN("1e12"))
        //showBody("dave should have", dv, "usdi")
        expect(await s.USDI.balanceOf(s.Dave.address)).to.eq(dv);
    })
})