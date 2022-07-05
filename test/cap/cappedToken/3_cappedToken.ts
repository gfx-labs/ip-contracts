import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { start } from "repl";
require("chai").should();


describe("Testing CappedToken functions", () => {
    it("Deposit underlying", async () => {

        let startBalance = await s.USDC.balanceOf(s.Bob.address)
        expect(startBalance).to.eq(s.Bob_USDC)


        //deposit 500 USDC
        const USDCamount = BN("500e6")
        await s.USDC.connect(s.Bob).approve(s.CappedToken.address, USDCamount)
        await mineBlock()
        await s.CappedToken.connect(s.Bob).deposit(USDCamount)
        await mineBlock()

        let balance = await s.CappedToken.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.eq(USDCamount.div(BN("1e6")), "CappedToken balance scaled correctly")

        expect(await s.USDC.balanceOf(s.Bob.address)).to.eq(s.Bob_USDC.sub(USDCamount))


    })

    it("Deposit underlying to another address", async () => {
        let startBalance = await s.USDC.balanceOf(s.Bob.address)
        expect(startBalance).to.eq(s.Bob_USDC.div(2))

        //Bob deposits some USDC for Dave
        const USDCamount = BN("200e6")
        await s.USDC.connect(s.Bob).approve(s.CappedToken.address, USDCamount)
        await s.CappedToken.connect(s.Bob).depositTo(USDCamount, s.Dave.address)
        await mineBlock()

        let balance = await s.CappedToken.balanceOf(s.Dave.address)
        expect(await toNumber(balance)).to.eq(USDCamount.div(BN("1e6")), "CappedToken scaled correctly to receiver")


    })

    it("Check things", async () => {

        const underlyingRatio = await s.CappedToken.underlyingRatio()
        //showBody("Raw Ratio: ", underlyingRatio)
        //showBody("Ratio: ", await toNumber(underlyingRatio))

    })

    it("Withdraw underlying", async () => {
        const ctUSDC = await s.USDC.balanceOf(s.CappedToken.address)
        const startUSDC = await s.USDC.balanceOf(s.Bob.address)
        const startCT = await s.CappedToken.balanceOf(s.Bob.address)
        const startSupply = await s.CappedToken.totalSupply()

        //expected deltas 
        const USDCamount = BN("500e6")
        const e18Amount = utils.parseEther("500")

        //Bob withdraws
        await s.CappedToken.connect(s.Bob).withdraw(USDCamount)
        await mineBlock()

        expect(await s.USDC.balanceOf(s.CappedToken.address)).to.eq(ctUSDC.sub(USDCamount), "USDC held by Capped Contract has reduced by the expected amount")
        expect(await s.USDC.balanceOf(s.Bob.address)).to.eq(startUSDC.add(USDCamount), "USDC held by Bob has increased by the expected amount")
        expect(await s.CappedToken.balanceOf(s.Bob.address)).to.eq(startCT.sub(e18Amount), "Capped Tokens held by Bob has decreased by the expected amount")
        expect(await s.CappedToken.totalSupply()).to.eq(startSupply.sub(e18Amount), "Capped Tokens total supply has decreased by the expected amount")

    })

    it("Withdraw underlying to another address", async () => {
        const ctUSDC = await s.USDC.balanceOf(s.CappedToken.address)
        const startUSDC = await s.USDC.balanceOf(s.Bob.address)
        const startCT = await s.CappedToken.balanceOf(s.Dave.address)
        const startSupply = await s.CappedToken.totalSupply()

        //expected deltas 
        const USDCamount = BN("200e6")
        const e18Amount = utils.parseEther("200")

        //Dave withdraws back to Bob
        await s.CappedToken.connect(s.Dave).withdrawTo(USDCamount, s.Bob.address)
        await mineBlock()

        expect(await s.USDC.balanceOf(s.CappedToken.address)).to.eq(ctUSDC.sub(USDCamount), "USDC held by Capped Contract has reduced by the expected amount")
        expect(await s.USDC.balanceOf(s.Bob.address)).to.eq(startUSDC.add(USDCamount), "USDC held by Bob has increased by the expected amount")
        expect(await s.CappedToken.balanceOf(s.Dave.address)).to.eq(startCT.sub(e18Amount), "Capped Tokens held by Dave has decreased by the expected amount")
        expect(await s.CappedToken.totalSupply()).to.eq(startSupply.sub(e18Amount), "Capped Tokens total supply has decreased by the expected amount")

    })
})