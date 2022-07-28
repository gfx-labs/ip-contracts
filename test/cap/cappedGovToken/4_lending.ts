import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear, OneDay } from "../../../util/block";
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

const borrowAmount = BN("500e18")


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
    it("Borrow a small amount against capped token", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)
        expect(startUSDI).to.eq(0, "Bob holds 0 USDi")

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)
        await mineBlock()

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startUSDI.add(borrowAmount.mul(2))), 0.001, "Bob received USDi loan")

    })

    it("Check loan details", async () => {

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liability)).to.be.closeTo(await toNumber(borrowAmount.mul(2)), 0.001, "Liability is correct")

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

    /**
     * Bob minted this voting vault using Carol's regular vault ID
     * Previous tests confirmed Carol is the minter
     * We will now confirm that only carol has the right to delegate voting power
     */
    it("Check governance vote delgation for a vault that was minted by someone else", async () => {
        const amount = BN("50e18")

        //raise cap so Carol can have some capped aave
        await s.CappedAave.connect(s.Frank).setCap(BN("550e18"))
        await mineBlock()

        //Bob funds Carol's vault
        await s.AAVE.connect(s.Bob).approve(s.CappedAave.address, amount)
        await s.CappedAave.connect(s.Bob).deposit(amount, s.CaroLVaultID)
        await mineBlock()

        const startPower = await s.AAVE.getPowerCurrent(s.Carol.address, 0)
        expect(startPower).to.eq(0, "Carol holds 0 Aave and has no delegated voting power")

        await s.CarolVotingVault.connect(s.Carol).delegateCompLikeTo(s.Carol.address, s.aaveAddress)
        await mineBlock()

        let power = await s.AAVE.getPowerCurrent(s.Carol.address, 0)
        expect(power).to.eq(amount, "Voting power is correct")

        await s.CarolVault.connect(s.Carol).withdrawErc20(s.CappedAave.address, amount)
        await s.AAVE.connect(s.Carol).transfer(s.Bob.address, amount)
        await mineBlock()

    })

    it("Repay loan", async () => {
        expect(await s.USDC.balanceOf(s.Bob.address)).to.eq(s.Bob_USDC, "Bob still holds starting USDC")

        //deposit some to be able to repay all
        await s.USDC.connect(s.Bob).approve(s.USDI.address, BN("50e6"))
        await s.USDI.connect(s.Bob).deposit(BN("50e6"))
        await mineBlock()

        await s.USDI.connect(s.Bob).approve(s.VaultController.address, await s.USDI.balanceOf(s.Bob.address))
        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        //await mineBlock()
        //await mineBlock()
        await advanceBlockHeight(1)
        await fastForward(OneDay)


        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Loan repaid")
    })
})

describe("Liquidations", () => {

    let borrowPower: BigNumber
    let T2L: BigNumber

    before(async () => {
        borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
    })

    it("Borrow max", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)

        let startLiab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(startLiab).to.eq(0, "Liability is still 0")

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowPower)
        await mineBlock()
        const liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liab)).to.be.closeTo(await toNumber(borrowPower), 0.001, "Liability is correct")

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(borrowPower.add(startUSDI)), 0.001, "Balance is correct")

    })

    it("Elapse time to put vault underwater", async () => {

        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        const solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is now underwater")

    })

    it("Liquidate", async () => {

        const amountToSolvency = await s.VaultController.amountToSolvency(s.BobVaultID)
        expect(amountToSolvency).to.be.gt(0, "Vault underwater")

        const tokensToLiquidate = await s.VaultController.tokensToLiquidate(s.BobVaultID, s.CappedAave.address)
        T2L = tokensToLiquidate
        expect(tokensToLiquidate).to.be.gt(0, "Capped Tokens are liquidatable")

        const price = await s.Oracle.getLivePrice(s.CappedAave.address)
        expect(price).to.be.gt(0, "Valid price")

        const liquidationValue = (price.mul(tokensToLiquidate)).div(BN("1e18"))

        const startSupply = await s.CappedAave.totalSupply()
        expect(startSupply).to.eq(borrowAmount, "Starting supply unchanged")


        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).deposit(await s.USDC.balanceOf(s.Dave.address))
        await mineBlock()

        let supply = await s.CappedAave.totalSupply()

        expect(await toNumber(supply)).to.be.closeTo(await toNumber(startSupply.sub(tokensToLiquidate)), 2, "Total supply reduced as Capped Aave is liquidatede")

        const startingUSDI = await s.USDI.balanceOf(s.Dave.address)
        expect(startingUSDI).to.eq(s.Dave_USDC.mul(BN("1e12")))

        const startingWAAVE = await s.CappedAave.balanceOf(s.BobVault.address)
        const startAAVE = await s.AAVE.balanceOf(s.Dave.address)
        expect(startAAVE).to.eq(0, "Dave holds 0 AAVE")

        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedAave.address, BN("1e50"))
        await mineBlock()

        let endwaave = await s.CappedAave.balanceOf(s.BobVault.address)
        expect(await toNumber(endwaave)).to.be.closeTo(await toNumber(startingWAAVE.sub(tokensToLiquidate)), 0.0001, "Expected amount liquidated")

        let endAave = await s.AAVE.balanceOf(s.Dave.address)
        expect(await toNumber(endAave)).to.be.closeTo(await toNumber(tokensToLiquidate), 0.001, "Dave received the underlying Aave")

        const usdiSpent = startingUSDI.sub(await s.USDI.balanceOf(s.Dave.address))

        //price - liquidation incentive (5%)
        const effectivePrice = (price.mul(BN("1e18").sub(s.LiquidationIncentive))).div(BN("1e18"))
        const realPrice = ((tokensToLiquidate.mul(effectivePrice)).div(tokensToLiquidate))
        expect(await toNumber(realPrice)).to.be.closeTo(await toNumber(effectivePrice), 0.001, "Effective price is correct")


        const profit = liquidationValue.sub(usdiSpent)
        const expected = (liquidationValue.mul(s.LiquidationIncentive)).div(BN("1e18"))

        expect(await toNumber(profit)).to.be.closeTo(await toNumber(expected), 0.1, "Expected profit achieved")


    })

    it("repay all", async () => {

        let liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liab).to.be.gt(0, "Liability exists")

        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await mineBlock()

        liab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liab).to.eq(0, "Loan completely repaid")
    })


    it("Withdraw after loan", async () => {

        const voteVaultAave = await s.AAVE.balanceOf(s.BobVotingVault.address)
        expect(voteVaultAave).to.be.gt(0, "Vote vault holds Aave")
        const vaultCappedAave = await s.CappedAave.balanceOf(s.BobVault.address)

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedAave.address, vaultCappedAave)
        await mineBlock()

        let balance = await s.AAVE.balanceOf(s.BobVotingVault.address)
        expect(await toNumber(balance)).to.eq(0, "All Aave withdrawn")

        balance = await s.CappedAave.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(0, "All CappedAave removed from vault")

        const supply = await s.CappedAave.totalSupply()
        expect(await toNumber(supply)).to.eq(0, "All CappedAave Burned")

        balance = await s.AAVE.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.aaveAmount.sub(T2L)), 2, "Bob received collateral - liquidated amount")

    })

    it("mappings", async () => {
        const _vaultAddress_vaultId = await s.VotingVaultController._vaultAddress_vaultId(s.BobVault.address)
        expect(_vaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(BN(s.BobVaultID))
        expect(_vaultId_votingVaultAddress.toUpperCase()).to.equal(s.BobVotingVault.address.toUpperCase(), "Correct voting vault ID")

        const _votingVaultAddress_vaultId = await s.VotingVaultController._votingVaultAddress_vaultId(s.BobVotingVault.address)
        expect(_votingVaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.aaveAddress)
        expect(_underlying_CappedToken.toUpperCase()).to.eq(s.CappedAave.address.toUpperCase(), "Underlying => Capped is correct")

        const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedAave.address)
        expect(_CappedToken_underlying.toUpperCase()).to.eq(s.aaveAddress.toUpperCase(), "Capped => Underlying correct")
    })
})

describe("Unregister Underlying", () => {
    const amount = BN("10e18")
    const oxo = "0x0000000000000000000000000000000000000000"

    it("setup", async () => {
        await s.AAVE.connect(s.Bob).approve(s.CappedAave.address, amount)
        await s.CappedAave.connect(s.Bob).deposit(amount, s.BobVaultID)
        await mineBlock()

        let borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        let liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Bob's vault has no debt")

        await s.VaultController.connect(s.Bob).borrowUSDIto(s.BobVaultID, borrowPower, s.Bob.address)
        await mineBlock()

        liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liability)).to.be.closeTo(await toNumber(borrowPower), 0.001, "Liability correct")
    })

    it("unregister underlying", async () => {    

        await s.VotingVaultController.connect(s.Frank).unregisterUnderlying(s.aaveAddress, s.CappedAave.address)
        await mineBlock()     
        
        const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.aaveAddress)
        const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedAave.address)

        expect(_underlying_CappedToken).to.eq(_CappedToken_underlying).to.eq(oxo, "Unregister successful")

    }) 

    it("Unregister does not prevent deposit", async () => {
        const smallAmount = BN("1e16")
        await s.AAVE.connect(s.Bob).approve(s.CappedAave.address, smallAmount)
        await expect(s.CappedAave.connect(s.Bob).deposit(smallAmount, s.BobVaultID)).to.not.be.reverted
        await mineBlock()
    })

    it("Unregister prevents withdraw from cap contract", async () => {
         expect(s.BobVault.connect(s.Bob).withdrawErc20(s.CappedAave.address, amount)).to.be.revertedWith("Only Capped Token") 
    })

    it("Elapse time to put vault underwater", async () => {

        let solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(true, "Bob's vault is not yet underwater")


        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        solvency = await s.VaultController.checkVault(s.BobVaultID) 
        expect(solvency).to.eq(false, "Bob's vault is now underwater")

    })

    it("Unregister prevents liquidation", async () => {        
         expect(s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedAave.address, BN("1e50"))).to.be.revertedWith("Only Capped Token")
    })

    it("Unregister does not prevent repay", async () => {

        await expect(s.VaultController.connect(s.Bob).repayUSDi(s.BobVaultID, BN("10e18"))).to.not.be.reverted
        await mineBlock()

    })
})