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

//147 040 

describe("Testing CappedToken functions", () => {
    it("Deposit underlying", async () => {
        let balance = await s.CappedToken.balanceOf(s.Bob.address)
        expect(balance).to.eq(0, "Bob holds no capped paxg before deposit")

        //deposit 5 PAXG
        const PAXGamount = BN("5e18")
        await s.PAXG.connect(s.Bob).approve(s.CappedToken.address, PAXGamount)
        await mineBlock()
        const result = await s.CappedToken.connect(s.Bob).deposit(PAXGamount, s.Bob.address)
        await mineBlock()
        showBodyCyan("Gas: ", await getGas(result))

        balance = await s.CappedToken.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(PAXGamount), 0.002, "CappedToken balance is correct")

        expect(await toNumber(await s.PAXG.balanceOf(s.Bob.address))).to.be.closeTo(await toNumber(s.PAXG_AMOUNT.sub(PAXGamount)), 0.003, "PAXG balance after deposit correct")

    })


    it("Deposit underlying to another address", async () => {
        //Bob deposits some PAXG for Dave
        const PAXGamount = BN("2e18")
        await s.PAXG.connect(s.Bob).approve(s.CappedToken.address, PAXGamount)
        await s.CappedToken.connect(s.Bob).deposit(PAXGamount, s.Dave.address)
        await mineBlock()

        let balance = await s.CappedToken.balanceOf(s.Dave.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(PAXGamount), 0.002, "CappedToken balance is correct")

    })

    it("Check things", async () => {
        const bobCT = await s.CappedToken.balanceOf(s.Bob.address)

        let maxWithdraw = await s.CappedToken.maxWithdraw(s.Bob.address)
        expect(maxWithdraw).to.eq(bobCT, "Max withdraw is correct")
        //todo check maxWithdraw when reserve is low - can reserve even ever be too low? 

        let previewRedeem = await s.CappedToken.previewRedeem(maxWithdraw)
        expect(previewRedeem).to.eq(maxWithdraw, "previewRedeem is correct")

    })

    it("Withdraw underlying", async () => {
        const ctPAXG = await s.PAXG.balanceOf(s.CappedToken.address)
        const startPAXG = await s.PAXG.balanceOf(s.Bob.address)
        const startCT = await s.CappedToken.balanceOf(s.Bob.address)
        const startSupply = await s.CappedToken.totalSupply()

        //Bob swapps all of his Capped Token for PAXG
        const PAXGamount = await s.CappedToken.balanceOf(s.Bob.address)

        //Bob withdraws
        await s.CappedToken.connect(s.Bob).withdraw(PAXGamount, s.Bob.address)
        await mineBlock()

        expect(await s.PAXG.balanceOf(s.CappedToken.address)).to.eq(ctPAXG.sub(PAXGamount), "PAXG held by Capped Contract has reduced by the expected amount")
        expect(await toNumber(await s.PAXG.balanceOf(s.Bob.address))).to.be.closeTo(await toNumber(startPAXG.add(PAXGamount)), 0.003, "PAXG held by Bob has increased by the expected amount")
        expect(await toNumber(await s.CappedToken.balanceOf(s.Bob.address))).to.eq(startCT.sub(PAXGamount), "Capped Tokens held by Bob has decreased by the expected amount")
        expect(await s.CappedToken.totalSupply()).to.eq(startSupply.sub(PAXGamount), "Capped Tokens total supply has decreased by the expected amount")

    })


    it("Withdraw underlying to another address", async () => {
        const ctPAXG = await s.PAXG.balanceOf(s.CappedToken.address)
        const startPAXG = await s.PAXG.balanceOf(s.Bob.address)
        const startCT = await s.CappedToken.balanceOf(s.Dave.address)
        const startSupply = await s.CappedToken.totalSupply()


        const remaining = await s.CappedToken.balanceOf(s.Dave.address)
        

        //Dave withdraws back to Bob
        await s.CappedToken.connect(s.Dave).withdraw(remaining, s.Bob.address)
        await mineBlock()

        expect(await s.PAXG.balanceOf(s.CappedToken.address)).to.eq(ctPAXG.sub(remaining), "PAXG held by Capped Contract has reduced by the expected amount")
        expect(await toNumber(await s.PAXG.balanceOf(s.Bob.address))).to.be.closeTo(await toNumber(startPAXG.add(remaining)), 0.002, "PAXG held by Bob has increased by the expected amount")
        expect(await s.CappedToken.balanceOf(s.Dave.address)).to.eq(startCT.sub(remaining), "Capped Tokens held by Dave has decreased by the expected amount")
        expect(await s.CappedToken.totalSupply()).to.eq(startSupply.sub(remaining), "Capped Tokens total supply has decreased by the expected amount")



    })

    it("Check end state", async () => {

        let ctRemaining = await s.PAXG.balanceOf(s.CappedToken.address)
        expect(ctRemaining).to.eq(0, "0 PAXG remains on the contract")

        let totalSupply = await s.CappedToken.totalSupply()
        expect(totalSupply).to.equal(0, "0 Capped tokens remain in curculation")


    })



})