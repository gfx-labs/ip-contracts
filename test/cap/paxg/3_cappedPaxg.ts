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
    const PAXGamount = BN("5e18")//5 PAXGs
    it("Deposit underlying", async () => {
        let balance = await s.CappedPAXG.balanceOf(s.Bob.address)
        expect(balance).to.eq(0, "Bob holds no capped paxg before deposit")

        /**
         
        await s.PAXG.connect(s.Bob).approve(s.CappedPAXG.address, PAXGamount)
        await mineBlock()
        const result = await s.CappedPAXG.connect(s.Bob).deposit(PAXGamount, s.Bob.address)
        await mineBlock()
        showBodyCyan("Gas: ", await getGas(result))

        balance = await s.CappedPAXG.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(PAXGamount), 0.002, "CappedToken balance is correct")

        expect(await toNumber(await s.PAXG.balanceOf(s.Bob.address))).to.be.closeTo(await toNumber(s.PAXG_AMOUNT.sub(PAXGamount)), 0.003, "PAXG balance after deposit correct")


         */

    })


    it("Deposit underlying to another address", async () => {
        
    })

    it("Check things", async () => {
       
    })

    it("Withdraw underlying", async () => {
      
    })


    it("Withdraw underlying to another address", async () => {
       
    })

    it("Check end state", async () => {
       
    })
})
describe("Hitting the cap", () => {
    it("Admin sets a low cap", async () => {
        
    })

    it("Try to deposit exactly up to cap", async () => {
        
        
    })

    it("Try to deposit more than cap", async () => {

    })

})