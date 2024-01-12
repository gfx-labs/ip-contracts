import { MintParams, s } from "./scope";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { currentBlock, fastForward, hardhat_mine_timed, mineBlock, OneDay } from "../../../util/block";
import { BigNumber } from "ethers";
import { getArgs, getGas } from "../../../util/math";
import { expect } from "chai";
import { toNumber } from "../../../util/math";
import { IVault, IVault__factory, VaultNft, VaultNft__factory } from "../../../typechain-types";
import { nearestUsableTick } from "@uniswap/v3-sdk";
require("chai").should();

const borrowAmount = BN("500e18")


describe("Check starting values", () => {
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


describe("More Liquidations", () => {
    let andyVaultId: BigNumber
    let andyVault: IVault
    let andyNftVault: VaultNft
    let andyPositionId: BigNumber

    before(async () => {
        //mint vaults for Andy
        await expect(s.VaultController.connect(s.Andy).mintVault()).to.not
            .reverted
        await mineBlock()
        andyVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(andyVaultId)
        andyVault = IVault__factory.connect(vaultAddress, s.Andy)
        expect(await andyVault.minter()).to.eq(s.Andy.address)

        await s.NftVaultController.connect(s.Andy).mintVault(andyVaultId)
        const nftVaultAddr = await s.NftVaultController.NftVaultAddress(andyVaultId)
        andyNftVault = VaultNft__factory.connect(nftVaultAddr, s.Andy)

        //approvals
        await s.WBTC.connect(s.Andy).approve(s.nfpManager.address, s.wBTC_Amount)
        await s.WETH.connect(s.Andy).approve(s.nfpManager.address, s.WETH_AMOUNT)

        const [fee, tickSpacing, slot0] =
            await Promise.all([
                s.POOL.fee(),
                s.POOL.tickSpacing(),
                s.POOL.slot0(),
            ])
        //mint with different tick spacing
        const nut = nearestUsableTick(slot0[1], tickSpacing)
        const tickLower = nut - (tickSpacing)
        const tickUpper = nut + (tickSpacing)

        const block = await currentBlock()

        const params: MintParams = {
            token0: s.WBTC.address,
            token1: s.WETH.address,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: s.wBTC_Amount,
            amount1Desired: s.WETH_AMOUNT,
            amount0Min: BN("0"),
            amount1Min: BN("0"),
            recipient: s.Andy.address,
            deadline: block.timestamp + 500
        }
        const result = await s.nfpManager.connect(s.Andy).mint(params)
        const args = await getArgs(result)
        andyPositionId = args.tokenId

        await hardhat_mine_timed(50, 15)

        //deposit position
        await s.nfpManager.connect(s.Andy).approve(s.WrappedPosition.address, andyPositionId)
        await s.WrappedPosition.connect(s.Andy).deposit(andyPositionId, andyVaultId)

        let borrowPower = await s.VaultController.vaultBorrowingPower(andyVaultId)

        //deposit legacy collaterals
        await s.WETH.connect(s.Andy).transfer(andyVault.address, s.WETH_AMOUNT)
        expect(await toNumber(borrowPower)).to.be.lt(await toNumber(await s.VaultController.vaultBorrowingPower(andyVaultId)), "borrow power increased")
        borrowPower = await s.VaultController.vaultBorrowingPower(andyVaultId)

        await s.WBTC.connect(s.Andy).transfer(andyVault.address, s.wBTC_Amount)
        expect(await toNumber(borrowPower)).to.be.lt(await toNumber(await s.VaultController.vaultBorrowingPower(andyVaultId)), "borrow power increased")
        borrowPower = await s.VaultController.vaultBorrowingPower(andyVaultId)

        await hardhat_mine_timed(500, 15)
    })

    /**
     * liquidation of the position should not be possible until all other legacy assets are liquidated
     */
    it("Liquidations where legacy collateral also exists in the vault", async () => {

        const startBorrowPower = await s.VaultController.vaultBorrowingPower(andyVaultId)

        //borrow max
        await s.VaultController.connect(s.Andy).borrowUsdi(andyVaultId, startBorrowPower)

        const startLiab = await s.VaultController.vaultLiability(andyVaultId)
        expect(await toNumber(startLiab)).to.be.closeTo(await toNumber(startBorrowPower), 0.01, "Liability is accurate")

        //advance time
        await hardhat_mine_timed(15000, 15)
        await s.VaultController.calculateInterest()

        const preLiquidationLiability = await s.VaultController.vaultLiability(andyVaultId)
        expect(preLiquidationLiability).to.be.gt(startLiab, "Vault underwater")

        //over liquidation
        expect(s.VaultController.connect(s.Dave).liquidateVault(andyVaultId, s.WrappedPosition.address, BN("9999999e18"))).to.be.revertedWith("overliquidation")

        const startWeth = await s.WETH.balanceOf(s.Dave.address)
        await s.VaultController.connect(s.Dave).liquidateVault(andyVaultId, s.WETH.address, BN("9999999e18"))
        let balance = await s.WETH.balanceOf(s.Dave.address)

        expect(balance).to.be.gt(startWeth, "Dave received WETH")

    })

    it("Total Liquidation", async () => {

        //elapse enough time for all assets to need to be liquidated
        await hardhat_mine_timed(36500000, 30)
        await s.VaultController.calculateInterest()

        await s.VaultController.connect(s.Dave).liquidateVault(andyVaultId, s.WETH.address, BN("9999999e18"))
        let balance = await s.WETH.balanceOf(andyVault.address)
        expect(balance).to.eq(BN("0"), "All wEth Liquidated")

        //try to liquidate again
        expect(s.VaultController.connect(s.Dave).liquidateVault(andyVaultId, s.WrappedPosition.address, BN("9999999e18"))).to.be.revertedWith("overliquidation")

        await s.VaultController.connect(s.Dave).liquidateVault(andyVaultId, s.WBTC.address, BN("999999999e18"))

        balance = await s.WBTC.balanceOf(andyVault.address)
        expect(balance).to.eq(BN("0"), "All wBTC Liquidated")

        let bp = await s.VaultController.vaultBorrowingPower(andyVaultId)

        //liquidate position
        const positionValue = await s.WrappedPosition.balanceOf(andyVault.address)

        const startUsdi = await s.USDI.balanceOf(s.Dave.address)

        //liquidation goes through this time
        await s.VaultController.connect(s.Dave).liquidateVault(andyVaultId, s.WrappedPosition.address, BN("9999999e18"))

        const endUsdi = await s.USDI.balanceOf(s.Dave.address)
        const usdiSpent = startUsdi.sub(endUsdi)
        const expectedSpend = positionValue.sub((positionValue.mul(s.LiquidationIncentive)).div(BN("1e18")))

        expect(await toNumber(usdiSpent)).to.be.closeTo(await toNumber(expectedSpend), 0.01, "Correct amount of USDI spent to liquidate position")

        bp = await s.VaultController.vaultBorrowingPower(andyVaultId)
        expect(bp).to.eq(BN("0"), "Borrow power is now 0, all assets liquidated")
    })
})