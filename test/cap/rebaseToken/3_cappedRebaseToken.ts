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
import { max, red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { start } from "repl";
require("chai").should();
describe("Testing RebasingCapped functions", () => {

  

    it("Deposit underlying", async () => {
        let startBalance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(startBalance)).to.be.closeTo(await toNumber(s.Bob_USDC.mul(BN("1e12"))), 0.01, "Start balance is correct")




        //try to transfer some USDI to the cap contract to start? 
        await s.USDI.connect(s.Bob).transfer(s.RebasingCapped.address, BN("5e18"))
        await mineBlock()

        //deposit 500 USDi - error - cannot deposit 0 
        const depositAmount = utils.parseEther("500")
        await s.USDI.connect(s.Bob).approve(s.RebasingCapped.address, depositAmount)
        await mineBlock()
        await s.RebasingCapped.connect(s.Bob).depositFor( s.Bob.address, depositAmount)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Bob.address)
        showBody("start balance: ", await toNumber(startBalance))

        showBody("usdi balance: ", await toNumber(balance))

        //expect(await toNumber(balance)).to.eq(await toNumber(startBalance.sub(depositAmount)), "Correct amount of USDi taken from depositer")


        balance = await s.RebasingCapped.balanceOf(s.Bob.address)
        showBody("Cap balance: ", await toNumber(balance))



    })

    it("elapse time and pay interest to rebase", async () => {
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await mineBlock()
    })

    it("Check things", async () => {

        let balance = await s.RebasingCapped.balanceOf(s.Bob.address)
        showBody(balance)

        await s.RebasingCapped.connect(s.Bob).approve(s.RebasingCapped.address, await s.RebasingCapped.balanceOf(s.Bob.address))
        await mineBlock()
        await s.RebasingCapped.connect(s.Bob).withdraw(BN("10e18"))
        await mineBlock()



    })

    it("Withdraw underlying", async () => {

    })
})