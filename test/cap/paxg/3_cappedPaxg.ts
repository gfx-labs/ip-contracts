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

        await s.PAXG.connect(s.Bob).approve(s.CappedPAXG.address, PAXGamount)
        await mineBlock()

        const result = await s.CappedPAXG.connect(s.Bob).deposit(PAXGamount, s.BobVaultID)
        await mineBlock()
        showBodyCyan("Gas to deposit: ", await getGas(result))
        //check event receipt? 
        const args = await getArgs(result)
        //showBody(args)

    })

    it("Check things", async () => {
        let balance = await s.CappedPAXG.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(PAXGamount), 0.002, "CappedToken balance is correct on Bob's vault")
        expect(await toNumber(await s.PAXG.balanceOf(s.Bob.address))).to.be.closeTo(await toNumber(s.PAXG_AMOUNT.sub(PAXGamount)), 0.003, "PAXG balance after deposit correct")

        balance = await s.PAXG.balanceOf(s.CappedPAXG.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(PAXGamount), 0.002, "Capped PAXG contract holds the paxg")


        const borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(borrowPower).to.be.gt(0, "Bob has borrow power against capped paxg")


    })

    it("Borrow maximum against paxg", async () => {
        const borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowPower)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(borrowPower), 0.001, "Borrow amount correct")

    })

    it("Advance time to put vault underwater", async () => {

        let solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(true, "Bob's vault is solvent")

        await fastForward(OneWeek * 6)
        await s.VaultController.calculateInterest()
        await mineBlock()

        solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is insolvent")
    })


    it("Liquidate", async () => {
        //fund dave for liquidation
        await s.USDC.connect(s.Dave).approve(s.USDI.address, BN("1000e6"))
        await s.USDI.connect(s.Dave).deposit(BN("1000e6"))
        await mineBlock()

        const startingPAXG = await s.PAXG.balanceOf(s.Dave.address)
        expect(await toNumber(startingPAXG)).to.be.closeTo(await toNumber(s.PAXG_AMOUNT), 0.003, "Dave has starting paxg amount minus fee on transfer")

        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedPAXG.address, BN("9999e18"))
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to liquidate a capped token and receive underlying: ", gas)

        let balance = await s.PAXG.balanceOf(s.Dave.address)
        expect(balance).to.be.gt(startingPAXG, "Dave received PAXG for liquidating CappedPAXG")

    })

    it("Check end state", async () => {

        let remianingPAXG = await s.PAXG.balanceOf(s.CappedPAXG.address)
        let remainingCapped = await s.CappedPAXG.balanceOf(s.BobVault.address)

        expect(remianingPAXG).to.eq(remainingCapped, "Accounting is correct")
    })
    it("Repay all", async () => {

        //Fund Bob to repayAll
        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).depositTo(BN("500e6"), s.Bob.address)
        await mineBlock()

        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await mineBlock()

        let liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Vault completely repaid")    

    })
    it("Withdraw underlying", async () => {

        const startPAXG = await s.PAXG.balanceOf(s.Bob.address)
        const startSupply = await s.CappedPAXG.totalSupply()
        expect(startSupply).to.be.gt(0, "Some amount in use")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedPAXG.address, await s.CappedPAXG.balanceOf(s.BobVault.address))
        await mineBlock()

        let Supply = await s.CappedPAXG.totalSupply()
        expect(Supply).to.eq(0, "All Capped PAXG burned")

        let balance = await s.PAXG.balanceOf(s.CappedPAXG.address)
        expect(balance).to.eq(0, "All PAXG have been withdrawn from the cap contract")

        balance = await s.PAXG.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startSupply.add(startPAXG)), 0.0021, "Bob received the correct amount of PAXG")
    })
})
describe("Hitting the cap", () => {
    const lowCap = BN("5e18")
    const lowerCap = BN("2e18")
    it("Admin sets a low cap", async () => {

        await s.CappedPAXG.connect(s.Frank).setCap(lowCap)
        await mineBlock()

        expect(await s.CappedPAXG.getCap()).to.eq(lowCap, "Cap has been set correctly")       

    })

    it("Deposit exactly up to cap", async () => {

        await s.PAXG.connect(s.Bob).approve(s.CappedPAXG.address, lowCap)
        await mineBlock()

        const result = await s.CappedPAXG.connect(s.Bob).deposit(lowCap, s.BobVaultID)
        await mineBlock()

        let supply = await s.CappedPAXG.totalSupply()
        expect(await toNumber(supply)).to.be.closeTo(await toNumber(lowCap), 0.0021, "Cap has been reached minus fee-on-transfer")

    })

    it("Try to deposit more than cap", async () => {
        await s.PAXG.connect(s.Bob).approve(s.CappedPAXG.address, lowCap)
        await mineBlock()

        expect(s.CappedPAXG.connect(s.Bob).deposit(lowCap, s.BobVaultID)).to.be.revertedWith("cap reached")
    })

    it("Admin reduces cap to below current supply", async () => {

        const startBorrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(startBorrowPower).to.be.gt(0, "Borrow power exists")

        await s.CappedPAXG.connect(s.Frank).setCap(lowerCap)
        await mineBlock()

        expect(await s.CappedPAXG.getCap()).to.eq(lowerCap, "Cap has been set correctly")  
        expect(lowerCap).to.be.lt(await s.CappedPAXG.totalSupply(), "Cap is lower than supply")

        let bp = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(bp).to.eq(startBorrowPower, "Borrow power did not change when cap was lowered")

    })

    it("Reduced cap does not prevent withdraw", async () => {
        const startPAXG = await s.PAXG.balanceOf(s.Bob.address)
        const startSupply = await s.CappedPAXG.totalSupply()
        expect(startSupply).to.be.gt(0, "Some amount in use")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedPAXG.address, await s.CappedPAXG.balanceOf(s.BobVault.address))
        await mineBlock()

        let Supply = await s.CappedPAXG.totalSupply()
        expect(Supply).to.eq(0, "All Capped PAXG burned")

        let balance = await s.PAXG.balanceOf(s.CappedPAXG.address)
        expect(balance).to.eq(0, "All PAXG have been withdrawn from the cap contract")

        balance = await s.PAXG.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startSupply.add(startPAXG)), 0.0021, "Bob received the correct amount of PAXG")
    })

})