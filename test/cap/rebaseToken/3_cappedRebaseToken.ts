import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"

import { utils, BigNumber } from "ethers"
import { ethers, network } from "hardhat";
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

    //Bob wraps and later unwraps
    //compare Bob's balance after unwrap to one of the users who did not wrap

    const depositAmount = utils.parseEther("5")

    const rebase = async () => {
        const callerAddr = "0x404335bce530400a5814375e7ec1fb55faff3ea2";

        let signer = ethers.provider.getSigner(callerAddr)
        await impersonateAccount(callerAddr)

        await s.ST_ORACLE.connect(signer).reportBeacon(132300, 4243292214304813, 129034)
        await mineBlock()
        await ceaseImpersonation(callerAddr)
        await mineBlock()

       


        /**
         let oracle = await s.STETH.getOracle()
        showBody("Oracle: ", oracle)

        await impersonateAccount(oracle)
        let signer = ethers.provider.getSigner(oracle)

        await s.STETH.connect(signer).depositBufferedEther()
        await mineBlock()
        await ceaseImpersonation(oracle)
        await mineBlock()
         */


    }


    it("Deposit underlying", async () => {

        let startBalance = await s.STETH.balanceOf(s.Bob.address)
        expect(await toNumber(startBalance)).to.be.closeTo(await toNumber(s.STETH_AMOUNT), 0.01, "Start balance is correct")


        await s.STETH.connect(s.Bob).approve(s.RebasingCapped.address, depositAmount)
        await mineBlock()
        await s.RebasingCapped.connect(s.Bob).depositFor(s.Bob.address, depositAmount)
        await mineBlock()

        showBody("start balance: ", await toNumber(startBalance))

        let balance = await s.STETH.balanceOf(s.Bob.address)
        showBody("STETH balance: ", await toNumber(balance))

        //expect(await toNumber(balance)).to.eq(await toNumber(startBalance.sub(depositAmount)), "Correct amount of STETH taken from depositer")


        balance = await s.RebasingCapped.balanceOf(s.Bob.address)
        showBody("Bob's cap token balance: ", await toNumber(balance))



    })

    it("elapse time and pay interest to rebase", async () => {
        await fastForward(OneWeek * 52)
        await mineBlock()
        let balance = await s.STETH.balanceOf(s.Bob.address)
        showBody("Pre rebase balance: ", await toNumber(balance))

        await rebase()

        balance = await s.STETH.balanceOf(s.Bob.address)
        showBody("post rebase balance: ", await toNumber(balance))


    })

    it("Check things", async () => {

        /**
         let balance = await s.RebasingCapped.balanceOf(s.Bob.address)

        balance = await s.USDI.balanceOf(s.RebasingCapped.address)
        showBody("Bob USDI: ", await toNumber(balance))


        await s.RebasingCapped.connect(s.Bob).approve(s.RebasingCapped.address, await s.RebasingCapped.balanceOf(s.Bob.address))
        await mineBlock()
        await s.RebasingCapped.connect(s.Bob).withdraw(balance)
        await mineBlock()

        balance = await s.USDI.balanceOf(s.RebasingCapped.address)
        expect(balance).to.eq(0, "Remaining USDI on cap contract is 0")

        balance = await s.USDI.balanceOf(s.Bob.address)
        showBody("Bob USDI: ", await toNumber(balance))

        balance = await s.USDI.balanceOf(s.Dave.address)
        showBody("control USDI: ", await toNumber(balance))

         */

    })

    it("Withdraw underlying", async () => {

    })
})