import { s } from "./scope";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { fastForward, mineBlock, OneDay } from "../../../util/block";
import { BigNumber } from "ethers";
import { getGas } from "../../../util/math";
import { expect } from "chai";
import { toNumber } from "../../../util/math";
require("chai").should();

const borrowAmount = BN("500e18")


describe("Check starting values", () => {
    const amount = BN("500e18")

    it("Check borrow power / LTV", async () => {
        let borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(borrowPower).to.be.gt(0, "There exists a borrow power against capped token")

        let balance = await s.WrappedPosition.balanceOf(s.BobVault.address)
        let price = await s.Oracle.getLivePrice(s.WrappedPosition.address)

        let totalValue = (balance.mul(price)).div(BN("1e18"))

        let expectedBorrowPower = (totalValue.mul(s.LTV)).div(BN("1e18"))
        expect(await toNumber(borrowPower)).to.be.closeTo(await toNumber(expectedBorrowPower), 0.0001, "Borrow power is correct")

    })
})


describe("Lending with capped Balancer LP tokens and uniPosition", () => {
    it("Borrow a small amount against staked capped uniPosition", async () => {


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

    //todo liquidations affected by partial repay?
    it("Repay loan", async () => {

        expect(await s.USDC.balanceOf(s.Bob.address)).to.eq(s.Bob_USDC.mul(10), "Bob still holds starting USDC")

        //deposit some to be able to repay all
        await s.USDC.connect(s.Bob).approve(s.USDI.address, BN("50e6"))
        await s.USDI.connect(s.Bob).deposit(BN("50e6"))
        await mineBlock()

        await s.USDI.connect(s.Bob).approve(s.VaultController.address, await s.USDI.balanceOf(s.Bob.address))
        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await fastForward(OneDay)


        const liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Loan repaid")

    })
})


describe("Liquidations - uniPosition", () => {

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

        await fastForward(OneDay * 30)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        const solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is now underwater")

    })

    it("Try to withdraw when vault is underwater", async () => {
        const amount = BN("250e18")
        expect(s.BobVault.connect(s.Bob).withdrawErc20(s.WrappedPosition.address, amount)).to.be.revertedWith("over-withdrawal")
    })

    it("Liquidate", async () => {

        const amountToSolvency = await s.VaultController.amountToSolvency(s.BobVaultID)
        expect(amountToSolvency).to.be.gt(0, "Vault underwater")

        const tokensToLiquidate = await s.VaultController.tokensToLiquidate(s.BobVaultID, s.WrappedPosition.address)
        T2L = tokensToLiquidate
        expect(tokensToLiquidate).to.be.gt(0, "Capped Tokens are liquidatable")

        const price = await s.Oracle.getLivePrice(s.WrappedPosition.address)
        expect(await toNumber(price)).to.eq(1, "Expected price mofifier returned")

        const liquidationValue = (price.mul(tokensToLiquidate)).div(BN("1e18"))

        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).deposit(await s.USDC.balanceOf(s.Dave.address))
        await mineBlock()

        const startingUSDI = await s.USDI.balanceOf(s.Dave.address)

        const startinguniPosition = await s.WrappedPosition.balanceOf(s.BobVault.address)
        const startuniPosition = await s.nfpManager.balanceOf(s.Dave.address)
        expect(startuniPosition).to.eq(0, "Dave holds 0 uniPosition")

        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.WrappedPosition.address, BN("1e50"))
        const gas = await getGas(result)
        showBodyCyan("Gas to liquidate uniPosition: ", gas)

        let endWrappedPosition = await s.WrappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(endWrappedPosition)).to.eq(0, "Total position liquidated")

        let enduniPosition = await s.nfpManager.balanceOf(s.Dave.address)
        expect(enduniPosition).to.eq(2, "Dave recieved both positions")

        const usdiSpent = startingUSDI.sub(await s.USDI.balanceOf(s.Dave.address))
        const expectedSpend = await toNumber(startinguniPosition) - (await toNumber(startinguniPosition) * (await toNumber(s.LiquidationIncentive)))

        expect(await toNumber(usdiSpent)).to.be.closeTo(expectedSpend, 0.1, "Correct amount of USDI spent")


        const endLiability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(endLiability).to.eq(0, "Liability is now 0")

        let endBalance = await s.nfpManager.balanceOf(s.Dave.address)
        expect(endBalance).to.eq(2, "Dave received both positions")

    })

    it("Dave deposits and borrows", async () => {
        await s.nfpManager.connect(s.Dave).approve(s.WrappedPosition.address, s.BobPositionId)
        const result = await s.WrappedPosition.connect(s.Dave).deposit(s.BobPositionId, s.BobVaultID)
    })

    it("Borrow to add some liability", async () => {
        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, BN("50e18"))
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

        const startCarolBalance = await s.WrappedPosition.balanceOf(s.CarolVault.address)
        const result = await s.BobVault.connect(s.Bob).withdrawErc20(s.WrappedPosition.address, 99999)

        let balance = await s.nfpManager.balanceOf(s.BobNftVault.address)
        expect(await toNumber(balance)).to.eq(0, "All uniPosition withdrawn")

        balance = await s.WrappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(0, "All WrappedPosition removed from vault")

        balance = await s.WrappedPosition.balanceOf(s.CarolVault.address)
        expect(balance).to.eq(startCarolBalance, "Carol's balance is unaffected by withdraw")

    })

    it("mappings", async () => {
        const _vaultAddress_vaultId = await s.NftVaultController._vaultAddress_vaultId(s.BobVault.address)
        expect(_vaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")


        const _vaultId_nftVaultAddress = await s.NftVaultController._vaultId_nftVaultAddress(BN(s.BobVaultID))
        expect(_vaultId_nftVaultAddress.toUpperCase()).to.equal(s.BobNftVault.address.toUpperCase(), "Correct nft vault ID")

        const _nftVaultAddress_vaultId = await s.NftVaultController._nftVaultAddress_vaultId(s.BobNftVault.address)
        expect(_nftVaultAddress_vaultId.toNumber()).to.eq(s.BobVaultID.toNumber(), "Correct vault ID")

        const _underlying_CappedToken = await s.NftVaultController._underlying_CollateralToken(s.nfpManager.address)
        expect(_underlying_CappedToken.toUpperCase()).to.eq(s.WrappedPosition.address.toUpperCase(), "Underlying => Capped is correct")

        const _CappedToken_underlying = await s.NftVaultController._CollateralToken_underlying(s.WrappedPosition.address)
        expect(_CappedToken_underlying.toUpperCase()).to.eq(s.nfpManager.address.toUpperCase(), "Capped => Underlying correct")

    })
})


