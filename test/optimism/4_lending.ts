import { s } from "./scope"
import { expect, assert } from "chai"
import { showBody, showBodyCyan } from "../../util/format"
import { BN } from "../../util/number"
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear, hardhat_mine_timed } from "../../util/block"
import { utils, BigNumber } from "ethers"
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance, toNumber } from "../../util/math"
import { IVault__factory } from "../../typechain-types"
const borrowAmount = BN("500e18")

describe("Lending with capped WETH", () => {

    it("Check borrow power / LTV", async () => {
        let borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(borrowPower).to.be.gt(0, "There exists a borrow power against capped token")

        const balance = await s.CappedWeth.balanceOf(s.BobVault.address)
        const price = await s.Oracle.getLivePrice(s.CappedWeth.address)
        let totalValue = (balance.mul(price)).div(BN("1e18"))
        let expectedBorrowPower = (totalValue.mul(s.WethLTV)).div(BN("1e18"))
        expect(await toNumber(borrowPower)).to.be.closeTo(await toNumber(expectedBorrowPower), 0.0001, "Borrow power is correct")
    })

    it("Borrow a small amount against capped token", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)
        expect(startUSDI).to.eq(0, "Bob holds 0 USDi")

        const result = await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)
        await hardhat_mine_timed(1, 15)


        let balance = await s.USDI.balanceOf(s.Bob.address)
        showBody("USDI Balance: ", await toNumber(await s.USDI.balanceOf(s.Bob.address)))
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startUSDI.add(borrowAmount)), 0.001, "Bob received USDi loan")

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(await toNumber(liability)).to.be.closeTo(await toNumber(borrowAmount), 0.001, "Liability is correct")

    })

    it("Repay loan", async () => {
        expect(await s.USDC.balanceOf(s.Bob.address)).to.eq(s.Bob_USDC, "Bob still holds starting USDC")

        //deposit some to be able to repay all
        await s.USDC.connect(s.Bob).approve(s.USDI.address, BN("50e6"))
        await s.USDI.connect(s.Bob).deposit(BN("50e6"))
        await mineBlock()

        await s.USDI.connect(s.Bob).approve(s.VaultController.address, await s.USDI.balanceOf(s.Bob.address))
        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await hardhat_mine_timed(1, 15)

        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Loan repaid")
    })

})

describe("Liquidations - WETH", () => {

    let borrowPower: BigNumber
    let T2L: BigNumber

    before(async () => {
        borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
    })

    it("Borrow max", async () => {

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)

        let startLiab = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(startLiab).to.eq(0, "Liability is still 0")
        //showBody("Start USDI: ", await toNumber(await s.USDI.balanceOf(s.Bob.address)))
        //showBody("Borrow power: ", await toNumber(borrowPower))
        //showBody("Borrow power: ", await toNumber(await s.VaultController.vaultBorrowingPower(s.BobVaultID)))

        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, await s.VaultController.vaultBorrowingPower(s.BobVaultID))
        await mineBlock()
        await hardhat_mine_timed(1, 15)
        const liab = await s.VaultController.vaultLiability(s.BobVaultID)
        //showBody("Liab: ", await toNumber(liab))
        //showBody("USDI: ", await toNumber(await s.USDI.balanceOf(s.Bob.address)))
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

    it("Try to withdraw when vault is underwater", async () => {
        const amount = BN("250e18")
        expect(s.BobVault.connect(s.Bob).withdrawErc20(s.CappedWeth.address, amount)).to.be.revertedWith("over-withdrawal")
    })

    it("Liquidate", async () => {

        const amountToSolvency = await s.VaultController.amountToSolvency(s.BobVaultID)
        expect(amountToSolvency).to.be.gt(0, "Vault underwater")

        const tokensToLiquidate = await s.VaultController.tokensToLiquidate(s.BobVaultID, s.CappedWeth.address)
        T2L = tokensToLiquidate
        expect(tokensToLiquidate).to.be.gt(0, "Capped Tokens are liquidatable")

        const price = await s.Oracle.getLivePrice(s.CappedWeth.address)
        expect(price).to.be.gt(0, "Valid price")

        const liquidationValue = (price.mul(tokensToLiquidate)).div(BN("1e18"))

        const startSupply = await s.CappedWeth.totalSupply()
        //expect(startSupply).to.eq(borrowAmount, "Starting supply unchanged")

        const startingUSDI = await s.USDI.balanceOf(s.Dave.address)
        //expect(await toNumber).to.be.gt(await toNumber(s.Dave_USDC.mul(BN("1e12"))), "More than starting USDC due to interest accrual")

        const startingWWETH = await s.CappedWeth.balanceOf(s.BobVault.address)
        const startWETH = await s.WETH.balanceOf(s.Dave.address)
        expect(startWETH).to.eq(0, "Dave holds 0 WETH")

        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedWeth.address, BN("1e50"))
        await mineBlock()

        let supply = await s.CappedWeth.totalSupply()
        expect(await toNumber(supply)).to.be.closeTo(await toNumber(startSupply.sub(tokensToLiquidate)), 2, "Total supply reduced as Capped WETH is liquidatede")


        let endwWETH = await s.CappedWeth.balanceOf(s.BobVault.address)
        expect(await toNumber(endwWETH)).to.be.closeTo(await toNumber(startingWWETH.sub(tokensToLiquidate)), 0.0001, "Expected amount liquidated")

        let endWETH = await s.WETH.balanceOf(s.Dave.address)
        expect(await toNumber(endWETH)).to.be.closeTo(await toNumber(tokensToLiquidate), 0.001, "Dave received the underlying WETH")

        const usdiSpent = startingUSDI.sub(await s.USDI.balanceOf(s.Dave.address))

        //price - liquidation incentive (5%)
        const effectivePrice = (price.mul(BN("1e18").sub(s.WethLiqInc))).div(BN("1e18"))
        const realPrice = ((tokensToLiquidate.mul(effectivePrice)).div(tokensToLiquidate))
        expect(await toNumber(realPrice)).to.be.closeTo(await toNumber(effectivePrice), 0.001, "Effective price is correct")


        const profit = liquidationValue.sub(usdiSpent)
        const expected = (liquidationValue.mul(s.WethLiqInc)).div(BN("1e18"))

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

        const voteVaultWETH = await s.WETH.balanceOf(s.BobVotingVault.address)
        expect(voteVaultWETH).to.be.gt(0, "Vote vault holds WETH")
        const vaultCappedWeth = await s.CappedWeth.balanceOf(s.BobVault.address)

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedWeth.address, vaultCappedWeth)
        await mineBlock()

        let balance = await s.WETH.balanceOf(s.BobVotingVault.address)
        expect(await toNumber(balance)).to.eq(0, "All WETH withdrawn")

        balance = await s.CappedWeth.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(0, "All CappedWeth removed from vault")

        const supply = await s.CappedWeth.totalSupply()
        expect(await toNumber(supply)).to.be.closeTo(0, 0.1, "All CappedWeth Burned")

        balance = await s.WETH.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.Bob_WETH.sub(T2L)), 2, "Bob received collateral - liquidated amount")

    })

    it("mappings", async () => {
        const _vaultAddress_vaultId = await s.VotingVaultController._vaultAddress_vaultId(s.BobVault.address)
        expect(_vaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(BN(s.BobVaultID))
        expect(_vaultId_votingVaultAddress.toUpperCase()).to.equal(s.BobVotingVault.address.toUpperCase(), "Correct voting vault ID")

        const _votingVaultAddress_vaultId = await s.VotingVaultController._votingVaultAddress_vaultId(s.BobVotingVault.address)
        expect(_votingVaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.wethAddress)
        expect(_underlying_CappedToken.toUpperCase()).to.eq(s.CappedWeth.address.toUpperCase(), "Underlying => Capped is correct")

        const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedWeth.address)
        expect(_CappedToken_underlying.toUpperCase()).to.eq(s.wethAddress.toUpperCase(), "Capped => Underlying correct")
    })

})