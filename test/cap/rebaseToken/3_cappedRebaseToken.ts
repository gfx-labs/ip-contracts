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
const depositAmount = utils.parseEther("5")

describe("Testing CappedSTETH functions", () => {

    //Bob wraps and later unwraps
    //compare Bob's balance after unwrap to one of the users who did not wrap


    const rebase = async () => {
        const callerAddr = "0x404335bce530400a5814375e7ec1fb55faff3ea2";

        let signer = ethers.provider.getSigner(callerAddr)
        await impersonateAccount(callerAddr)

        await s.ST_ORACLE.connect(signer).reportBeacon(132300, 4243292214304813, 129034)
        await mineBlock()

        await ceaseImpersonation(callerAddr)
        await mineBlock()

    }


    it("Deposit underlying", async () => {

        let startBalance = await s.STETH.balanceOf(s.Bob.address)
        expect(await toNumber(startBalance)).to.be.closeTo(await toNumber(s.STETH_AMOUNT), 0.01, "Start balance is correct")


        await s.STETH.connect(s.Bob).approve(s.CappedSTETH.address, depositAmount)
        await mineBlock()
        await s.CappedSTETH.connect(s.Bob).wrap(depositAmount)
        await mineBlock()

        //balance is off by 1 wei due to 1 wei corner case - https://docs.lido.fi/guides/steth-integration-guide
        let balance = await s.STETH.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startBalance.sub(depositAmount)), 0.0001, "Balance decremented by the correct amount")

        balance = await s.CappedSTETH.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startBalance.div(2)), 0.5, "Correct amount of capped tokens received")

    })

    it("elapse time and rebase", async () => {
        await fastForward(OneWeek)
        await mineBlock()
        let balance = await s.STETH.balanceOf(s.Bob.address)

        await rebase()

        let newBalance = await s.STETH.balanceOf(s.Bob.address)
        expect(newBalance).to.be.gt(balance, "Rebase increased balance")

    })

    it("Check end state", async () => {
        let balance = await s.CappedSTETH.balanceOf(s.Bob.address)

        //unwrap
        await s.CappedSTETH.connect(s.Bob).approve(s.CappedSTETH.address, balance)
        await s.CappedSTETH.connect(s.Bob).unwrap(balance)
        await mineBlock()

        balance = await s.STETH.balanceOf(s.Bob.address)

        //Bob has the expected amount of STETH after unwrap
        expect(await toNumber(balance)).to.eq(await toNumber(await s.STETH.balanceOf(s.Gus.address)), "Bob has the same STETH as a control, he received the rebase")


    })
})

describe("Checking the cap", () => {

    it("Wrap some stETH", async () => {
        //Bob wraps some
        await s.STETH.connect(s.Bob).approve(s.CappedSTETH.address, depositAmount)
        await mineBlock()
        await s.CappedSTETH.connect(s.Bob).wrap(depositAmount)
        await mineBlock()

        //Carol wraps some
        await s.STETH.connect(s.Carol).approve(s.CappedSTETH.address, depositAmount)
        await mineBlock()
        await s.CappedSTETH.connect(s.Carol).wrap(depositAmount)
        await mineBlock()
    })

    it("Admin reduces cap while there are more CapTokens in curculation than the cap", async () => {
        await s.CappedSTETH.connect(s.Frank).setCap(BN("5e18"))
        await mineBlock()
        expect(await s.CappedSTETH.getCap()).to.eq(BN("5e18"), "Cap has been set correctly")
    })

    it("Try to wrap more", async () => {
        //Eric tries
        await s.STETH.connect(s.Eric).approve(s.CappedSTETH.address, depositAmount)
        await mineBlock()
        expect(s.CappedSTETH.connect(s.Eric).wrap(depositAmount)).to.be.revertedWith("cap reached")
    })

    it("Unwrap", async () => {

        let balance = await s.CappedSTETH.balanceOf(s.Bob.address)
        await s.CappedSTETH.connect(s.Bob).approve(s.CappedSTETH.address, balance)
        await s.CappedSTETH.connect(s.Bob).unwrap(balance)
        await mineBlock()

        balance = await s.CappedSTETH.balanceOf(s.Carol.address)
        await s.CappedSTETH.connect(s.Carol).approve(s.CappedSTETH.address, balance)
        await s.CappedSTETH.connect(s.Carol).unwrap(balance)
        await mineBlock()
    })

    it("Check end state", async () => {

        //Balance is not exactly 0 due to 1 wei corner case - https://docs.lido.fi/guides/steth-integration-guide
        let balance = await s.STETH.balanceOf(s.CappedSTETH.address)
        expect(balance.toNumber()).to.be.closeTo(0, 5, "Cap contract returned all STETH")


        //control
        let expectedBalance = await s.STETH.balanceOf(s.Gus.address)

        let carolBalance = await s.STETH.balanceOf(s.Carol.address)
        let bobBalance = await s.STETH.balanceOf(s.Bob.address)

        expect(await toNumber(bobBalance)).to.eq(await toNumber(carolBalance)).to.eq(await toNumber(expectedBalance), "All balances correct")

    })
})

/**
 * NOTE ETHER deposited this way can not be redeemed for ETHER, only for STETH using the unwrap function
 */
describe("Test naitive eth fallback", () => {
    const ethAmount = BN("1e18")
    it("Send naitive eth", async () => {

        const startBalance = await ethers.provider.getBalance(s.Eric.address)
        const startSTETH = await s.STETH.balanceOf(s.Eric.address)
        const startCapToken = await s.CappedSTETH.balanceOf(s.Eric.address)
        expect(startCapToken).to.eq(0, "Eric holds 0 cap tokens")

        let tx = {
            to: s.CappedSTETH.address,
            value: ethAmount
        }

        await s.Eric.sendTransaction(tx)
        await mineBlock()

        let newBalance = await ethers.provider.getBalance(s.Eric.address)
        expect(await toNumber(newBalance)).to.be.closeTo(await toNumber(startBalance) - 1, 0.01, "Ether has been sent")

        let newSTETH = await s.STETH.balanceOf(s.Eric.address)
        expect(startSTETH).to.eq(newSTETH, "No change in STETH balance")

        let capBal = await s.CappedSTETH.balanceOf(s.Eric.address)
        expect(await toNumber(capBal)).to.be.closeTo(1, 0.1, "Eric received cap tokens in exchange for ether")
       
    })
})