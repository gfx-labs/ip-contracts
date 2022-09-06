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

//500 AMPL - decimal 9
const depositAmount = BN("500e9")
const mintAmount = BN("145e18")

describe("Testing CappedAMPL functions", () => {

    //Bob wraps and later unwraps
    //compare Bob's balance after unwrap to one of the users who did not wrap

    it("Deposit underlying", async () => {
        let startBalance = await s.AMPL.balanceOf(s.Bob.address)
        expect(await toNumber(startBalance)).to.be.closeTo(await toNumber(s.AMPL_AMOUNT), 0.01, "Start balance is correct")

        await s.AMPL.connect(s.Bob).approve(s.CappedAMPL.address, depositAmount)
        await s.CappedAMPL.connect(s.Bob).deposit(depositAmount)
        await mineBlock()


        let balance = await s.AMPL.balanceOf(s.Bob.address)
        expect(balance.toNumber()).to.be.closeTo((startBalance.sub(depositAmount)).toNumber(), 0.0001, "Balance decremented by the correct amount")

        balance = await s.CappedAMPL.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(mintAmount), 5, "Expected amount of CappedAmpl received")


    })

    it("Mint CappedAMPL in exchange for underlying", async () => {

        let startBalance = await s.AMPL.balanceOf(s.Carol.address)
        expect(await toNumber(startBalance)).to.be.closeTo(await toNumber(s.AMPL_AMOUNT), 0.01, "Start balance is correct")

        await s.AMPL.connect(s.Carol).approve(s.CappedAMPL.address, depositAmount)
        await s.CappedAMPL.connect(s.Carol).mint(mintAmount)
        await mineBlock()

        let balance = await s.AMPL.balanceOf(s.Carol.address)
        expect(balance.toNumber()).to.be.closeTo((startBalance.sub(depositAmount)).toNumber(), 2000000000, "Balance decremented by the correct amount ( +/- 2 AMPL ~2USD)")

        balance = await s.CappedAMPL.balanceOf(s.Carol.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(mintAmount), 0.0001, "Expected amount of CappedAmpl received")

    })

    //rebase??


    it("Withdraw underlying", async () => {

        let startBalance = await s.AMPL.balanceOf(s.Bob.address)

        await s.CappedAMPL.connect(s.Bob).withdrawAll()
        await mineBlock()

        let underlyingBalance = await s.AMPL.balanceOf(s.Bob.address)
        expect(underlyingBalance.toNumber()).to.be.closeTo(s.AMPL_AMOUNT.toNumber(), 1, "Bob received all AMPL back")

    })

    it("Burn CappedAMPL and receive underlying", async () => {

        await s.CappedAMPL.connect(s.Carol).burnAll()
        await mineBlock()

        let underlyingBalance = await s.AMPL.balanceOf(s.Carol.address)
        expect(underlyingBalance.toNumber()).to.be.closeTo(s.AMPL_AMOUNT.toNumber(), 1, "Carol received all AMPL back")

        let remainingAMPL = await s.AMPL.balanceOf(s.CappedAMPL.address)
        expect(remainingAMPL.toNumber()).to.be.closeTo(0, 2, "All AMPL removed from cap contract")
    })
})

describe("Testing cap", () => {

    it("Admin reduces cap", async () => {
        //set cap to 500 AMPL ~500USD
        await s.CappedAMPL.connect(s.Frank).setCap(BN("500e9"))
        await mineBlock()
    })

})
