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


describe("Check starting values", () => {
    const amount = BN("500e18")
    it("Check starting balance", async () => {
        const startCap = await s.CappedAave.balanceOf(s.BobVault.address)
        expect(startCap).to.eq(amount, "Starting balance is correct")

        let balance = await s.WBTC.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")

        balance = await s.WETH.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")

        balance = await s.UNI.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")
        let liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Bob's vault has no outstanding debt")
    })

    it("Check borrow power / LTV", async () => {
        let borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(borrowPower).to.be.gt(0, "There exists a borrow power against capped token")     

        const balance = await s.CappedAave.balanceOf(s.BobVault.address)
        const price = await s.Oracle.getLivePrice(s.CappedAave.address)
        let totalValue = (balance.mul(price)).div(BN("1e18"))
        let expectedBorrowPower = (totalValue.mul(s.UNI_LTV)).div(BN("1e18"))

        expect(await toNumber(borrowPower)).to.be.closeTo(await toNumber(expectedBorrowPower), 0.0001, "Borrow power is correct")
    })
})

describe("Lending", () => {
    const borrowAmount = BN("500e18")
    it("Borrow a small amount against capped token", async () => {
        
        const startUSDI = await s.USDI.balanceOf(s.Bob.address)
        expect(startUSDI).to.eq(0, "Bob holds 0 USDi")

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startUSDI.add(balance)), 0.001, "Bob received USDi loan")

    })  

    it("Check loan details", async () => {

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liability)).to.be.closeTo(await toNumber(borrowAmount), 0.001, "Liability is correct")

    })

    it("Check governance vote delegation", async () => {


        const startPower = await s.AAVE.getPowerCurrent(s.Bob.address, 0)

        //delegate
        await s.BobVotingVault.connect(s.Bob).delegateCompLikeTo(s.Bob.address, s.aaveAddress)
        await mineBlock()

        let power = await s.AAVE.getPowerCurrent(s.Bob.address, 0)

        const expected = (await s.AAVE.balanceOf(s.Bob.address)).add(await s.AAVE.balanceOf(s.BobVotingVault.address))
        
        expect(power).to.be.gt(startPower, "Voting power increased")
        expect(power).to.eq(expected, "Expected voting power achieved")

    })

    it("Repay loan", async () => {
        expect(await s.USDC.balanceOf(s.Bob.address)).to.eq(s.Bob_USDC, "Bob still holds starting USDC")

        //deposit some to be able to repay all
        await s.USDC.connect(s.Bob).approve(s.USDI.address, BN("50e6"))
        await s.USDI.connect(s.Bob).deposit(BN("50e6"))
        await mineBlock()

        await s.USDI.connect(s.Bob).approve(s.VaultController.address, await s.USDI.balanceOf(s.Bob.address))
        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await mineBlock()

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Loan repaid")
    })
})

describe("Liquidations", () => {

    let borrowPower:BigNumber

    before(async () => {
        borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        showBody(await toNumber(borrowPower))
    })

    it("Borrow max", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowPower)
        await mineBlock()
        const liab = await s.VaultController.vaultLiability(s.BobVaultID)
        showBody(await toNumber(borrowPower))
        showBody(await toNumber(liab))

        let balance = await s.USDI.balanceOf(s.Bob.address)
        showBody("Balance: ", await toNumber(balance))

        //expect(await toNumber(liab)).to.eq(await toNumber(borrowPower), "Borrow correct")


    })

    it("Elapse time to put vault underwater", async () => {

        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

    })

    it("Liquidate", async () => {

    })

})