import { s } from "../scope";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { BN } from "../../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneDay } from "../../../../util/block";
import { utils, BigNumber } from "ethers";
import { getGas, getArgs, truncate, getEvent, toNumber } from "../../../../util/math";
import { stealMoney } from "../../../../util/money"
import { IVault__factory } from "../../../../typechain-types";

let firstBorrowIF: BigNumber
describe("Check starting values", () => {
    it("Check starting balance", async () => {
        const startCappedrETH = await s.CappedRETH.balanceOf(s.BobVault.address)

        let balance = await s.WETH.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")

        let liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Bob's vault has no outstanding debt")
    })

    it("Check borrow power / LTV", async () => {
        let borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(borrowPower).to.be.gt(0, "There exists a borrow power against capped token")

        let balance = await s.CappedRETH.balanceOf(s.BobVault.address)
        let price = await s.Oracle.getLivePrice(s.CappedRETH.address)
        const rETHval = (balance.mul(price)).div(BN("1e18"))

        balance = await s.CappedCBETH.balanceOf(s.BobVault.address)
        price = await s.Oracle.getLivePrice(s.CappedCBETH.address)
        const cbETH_VAL = (balance.mul(price)).div(BN("1e18"))

        const totalValue = rETHval.add(cbETH_VAL)//dydxVal.add(rETHval).add(crvVal)

        let expectedBorrowPower = (totalValue.mul(s.rETH_LTV)).div(BN("1e18"))
        expect(await toNumber(borrowPower)).to.be.closeTo(await toNumber(expectedBorrowPower), 0.0001, "Borrow power is correct")
    })
})

describe("Lending", () => {
    const borrowAmount = BN("500e18")


    it("Borrow a small amount against capped tokens", async () => {

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
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(borrowPower.add(startUSDI)), 0.1, "Balance is correct")

    })


    it("Elapse time to put vault underwater", async () => {
        let solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(true, "Bob's vault is not yet underwater")

        await fastForward(OneWeek)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is underwater")

    })

    it("Try to withdraw when vault is underwater", async () => {
        const amount = BN("250e18")
        expect(s.BobVault.connect(s.Bob).withdrawErc20(s.CappedRETH.address, amount)).to.be.revertedWith("over-withdrawal")
    })

    it("Liquidate", async () => {

        const amountToSolvency = await s.VaultController.amountToSolvency(s.BobVaultID)
        expect(amountToSolvency).to.be.gt(0, "Vault underwater")

        // give dave some money
        await stealMoney("0x8EB8a3b98659Cce290402893d0123abb75E3ab28", s.Dave.address, s.usdcAddress, BN("20000e6"))
        await mineBlock()

        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).deposit(await s.USDC.balanceOf(s.Dave.address))
        await mineBlock()


        const tokensToLiquidate = await s.VaultController.tokensToLiquidate(s.BobVaultID, s.CappedRETH.address)
        T2L = tokensToLiquidate
        expect(tokensToLiquidate).to.be.gt(0, "Capped Tokens are liquidatable")

        const price = await s.Oracle.getLivePrice(s.CappedRETH.address)
        expect(price).to.be.gt(0, "Valid price")

        const liquidationValue = (price.mul(tokensToLiquidate)).div(BN("1e18"))

        const startSupply = await s.CappedRETH.totalSupply()
        //expect(startSupply).to.eq(borrowAmount.mul(2).add(69), "Starting supply unchanged")

        const startingUSDI = await s.USDI.balanceOf(s.Dave.address)
        //expect(startingUSDI).to.eq(s.Dave_USDC.add(BN("200e12")).mul(BN("1e12")))

        const startingCappedrETH = await s.CappedRETH.balanceOf(s.BobVault.address)


        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedRETH.address, BN("1e50"))
        await mineBlock()

        let supply = await s.CappedRETH.totalSupply()

        expect(await toNumber(supply)).to.be.closeTo(await toNumber(startSupply.sub(tokensToLiquidate)), 2, "Total supply reduced as Capped rETH is liquidated")

        let endCaprETH = await s.CappedRETH.balanceOf(s.BobVault.address)
        expect(await toNumber(endCaprETH)).to.be.closeTo(await toNumber(startingCappedrETH.sub(tokensToLiquidate)), 2, "Expected amount liquidated")

        let endrETH = await s.rETH.balanceOf(s.Dave.address)
        expect(await toNumber(endrETH)).to.be.closeTo(await toNumber(tokensToLiquidate.add(s.rETH_Amount)), 2, "Dave received the underlying rETH")

        const usdiSpent = startingUSDI.sub(await s.USDI.balanceOf(s.Dave.address))

        //price - liquidation incentive (5%)
        const effectivePrice = (price.mul(BN("1e18").sub(BN("8e16")))).div(BN("1e18"))
        const realPrice = ((tokensToLiquidate.mul(effectivePrice)).div(tokensToLiquidate))
        expect(await toNumber(realPrice)).to.be.closeTo(await toNumber(effectivePrice), 0.001, "Effective price is correct")


        const profit = liquidationValue.sub(usdiSpent)
        const expected = (liquidationValue.mul(BN("8e16"))).div(BN("1e18"))

        expect(await toNumber(profit)).to.be.closeTo(await toNumber(expected), 5, "Expected profit achieved")

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
        const voteVaultrETH = await s.rETH.balanceOf(s.BobVotingVault.address)
        expect(voteVaultrETH).to.be.gt(0, "Vote vault holds BAL")
        const vaultCappedrETH = await s.CappedRETH.balanceOf(s.BobVault.address)

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedRETH.address, vaultCappedrETH)
        await mineBlock()

        let balance = await s.rETH.balanceOf(s.BobVotingVault.address)
        expect(await toNumber(balance)).to.eq(0, "All rETH withdrawn")

        balance = await s.CappedRETH.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(0, "All CappedrETH removed from vault")

        const supply = await s.CappedRETH.totalSupply()
        expect(supply).to.eq(0, "All New CappedrETH Burned")

        balance = await s.rETH.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.rETH_Amount.sub(T2L)), 5, "Bob received collateral - liquidated amount")

    })

    it("mappings", async () => {
        const _vaultAddress_vaultId = await s.VotingVaultController._vaultAddress_vaultId(s.BobVault.address)
        expect(_vaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(BN(s.BobVaultID))
        expect(_vaultId_votingVaultAddress.toUpperCase()).to.equal(s.BobVotingVault.address.toUpperCase(), "Correct voting vault ID")

        const _votingVaultAddress_vaultId = await s.VotingVaultController._votingVaultAddress_vaultId(s.BobVotingVault.address)
        expect(_votingVaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _underlying_CappedToken = await s.VotingVaultController._underlying_CappedToken(s.rETH.address)
        expect(_underlying_CappedToken.toUpperCase()).to.eq(s.CappedRETH.address.toUpperCase(), "Underlying => Capped is correct")

        const _CappedToken_underlying = await s.VotingVaultController._CappedToken_underlying(s.CappedRETH.address)
        expect(_CappedToken_underlying.toUpperCase()).to.eq(s.rETH.address.toUpperCase(), "Capped => Underlying correct")
    })


})



