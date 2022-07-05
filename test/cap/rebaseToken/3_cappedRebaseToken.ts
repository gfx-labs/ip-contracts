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

    it("Convert USDC to USDi to deposit", async () => {
        await s.USDC.connect(s.Bob).approve(s.USDI.address, await s.USDC.balanceOf(s.Bob.address))
        await s.USDI.connect(s.Bob).deposit(await s.USDC.balanceOf(s.Bob.address))
        await mineBlock()
        expect(await toNumber(await s.USDI.balanceOf(s.Bob.address))).to.eq(s.Bob_USDC.div(BN("1e6")))
    })

    it("Deposit underlying", async () => {
        let startBalance = await s.USDI.balanceOf(s.Bob.address)
        expect(startBalance).to.eq(s.Bob_USDC.mul(BN("1e12")))


        //deposit 500 USDi - error - cannot deposit 0 
        const depositAmount = utils.parseEther("500")
        await s.USDI.connect(s.Bob).approve(s.RebasingCapped.address, depositAmount)
        await mineBlock()
        await s.RebasingCapped.connect(s.Bob).depositTo(depositAmount, s.Bob.address)
        await mineBlock()

        let balance = await s.RebasingCapped.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.eq(await toNumber(depositAmount), "RebasingCapped balance is correct")




    })

    it("elapse time and pay interest to rebase", async () => {
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await mineBlock()
    })

    it("Check things", async () => {


    })

    it("Withdraw underlying", async () => {

    })
})