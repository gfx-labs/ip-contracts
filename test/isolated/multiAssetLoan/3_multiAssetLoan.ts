import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getGas, toNumber, getArgs } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, fastForward, OneWeek } from "../../../util/block";
import { IVault__factory } from "../../../typechain-types";
import { utils, BigNumber } from "ethers";


describe("borrow against WBTC and another asset", () => {
    //9000 USDC
    const depositAmount = s.Dave_USDC.sub(BN("1000e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    let wbtcBorrowPower: BigNumber

    const UniAmount = utils.parseEther("90")

    let vaultID: number

    it("Confirms contract holds no value", async () => {
        const totalLiability = await s.VaultController.totalBaseLiability()
        expect(totalLiability).to.eq(BN("0"))

        const vaultsMinted = await s.VaultController.vaultsMinted()
        expect(vaultsMinted).to.eq(BN("0"))

        const interestFactor = await s.VaultController.interestFactor()
        expect(interestFactor).to.eq(BN("1e18"))

        const tokensRegistered = await s.VaultController.tokensRegistered()
        expect(tokensRegistered).to.eq(BN("3"))//weth, UNI, wBTC

        //no new USDi has been minted
        const totalSupply = await s.USDI.totalSupply()
        expect(totalSupply).to.eq(BN("1e18"))

        const scaledTotalSupply = await s.USDI.scaledTotalSupply()
        expect(scaledTotalSupply).to.eq(totalSupply.mul(BN("1e48")))

        const reserveRatio = await s.USDI.reserveRatio()
        expect(reserveRatio).to.eq(0)

    })

    it("Pay interest, and check values to confirm change", async () => {

        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        const totalLiability = await s.VaultController.totalBaseLiability()
        expect(totalLiability).to.eq(BN("0"))

        const vaultsMinted = await s.VaultController.vaultsMinted()
        expect(vaultsMinted).to.eq(BN("0"))

        const interestFactor = await s.VaultController.interestFactor()
        expect(interestFactor).to.not.eq(BN("1e18"))//Interest factor is slightly higher due to time passing

        const tokensRegistered = await s.VaultController.tokensRegistered()
        expect(tokensRegistered).to.eq(BN("3"))//weth, UNI, wBTC

        //no new USDi has been minted
        const totalSupply = await s.USDI.totalSupply()
        expect(totalSupply).to.eq(BN("1e18"))

        const scaledTotalSupply = await s.USDI.scaledTotalSupply()
        expect(scaledTotalSupply).to.eq(totalSupply.mul(BN("1e48")))

        const reserveRatio = await s.USDI.reserveRatio()
        expect(reserveRatio).to.eq(0)
    })

    it("Dave deposits USDC to reserve and receives USDI", async () => {
        await s.USDC.connect(s.Dave).approve(s.USDI.address, depositAmount)
        await s.USDI.connect(s.Dave).deposit(depositAmount)
        await mineBlock()
        let balance = await s.USDI.balanceOf(s.Dave.address)
        expect(await toNumber(balance)).to.eq(await toNumber(depositAmount_e18))
    })
    it("Make a vault and transfer wBTC", async () => {
        //Gus mints vault
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not.reverted;
        await mineBlock();
        vaultID = await (await s.VaultController.vaultsMinted()).toNumber()
        let gusVault = await s.VaultController.vaultAddress(vaultID)
        s.GusVault = IVault__factory.connect(
            gusVault,
            s.Gus,
        );
        expect(await s.GusVault.minter()).to.eq(s.Gus.address)
        await mineBlock()

        //Gus transfers wbtc collateral
        let balance = await s.WBTC.balanceOf(s.Gus.address)
        expect(balance).to.eq(s.Gus_WBTC)

        //Gus transfers 1 WBTC
        await s.WBTC.connect(s.Gus).transfer(s.GusVault.address, s.ONE_BTC)
        await mineBlock()

        wbtcBorrowPower = await s.VaultController.vaultBorrowingPower(vaultID)

    })
    it("Transfer Uni to the vault", async () => {
        let startBalance = await s.UNI.balanceOf(s.Gus.address)
        expect(startBalance).to.eq(s.Carol_UNI)

        //Gus transfers 90 UNI
        await s.UNI.connect(s.Gus).transfer(s.GusVault.address, UniAmount)
        await mineBlock()

        let balance = await s.UNI.balanceOf(s.Gus.address)

        expect(await toNumber(balance)).to.eq(await toNumber(startBalance.sub(UniAmount)))

    })

    it("Check borrow power: ", async () => {
        let totalBorrowPower = await s.VaultController.vaultBorrowingPower(vaultID)
        const uniBorrowPower = totalBorrowPower.sub(wbtcBorrowPower)

        let uniPrice = await s.Oracle.getLivePrice(s.uniAddress)
        let formatUniPrice = await toNumber(uniPrice)
        let uniBalance = await s.UNI.balanceOf(s.GusVault.address)
        let formatUniBalance = await toNumber(uniBalance)

        let formatUniValue = formatUniBalance * formatUniPrice
        let expectedUniBorrowPower = formatUniValue * (await toNumber(s.UNI_LTV))
        assert.equal(expectedUniBorrowPower, await toNumber(uniBorrowPower), "Borrow power for Uni is correct")


        let wbtcPrice = await s.Oracle.getLivePrice(s.wbtcAddress)
        let adjusted = wbtcPrice.div(BN("1e10"))//adjust for decimals
        let formatBtcPrice = await toNumber(adjusted)
        let wbtcBalance = await s.WBTC.balanceOf(s.GusVault.address)
        let formatBTCbalance = wbtcBalance.div(BN("1e8"))//format to BTC terms instead of sat terms

        let formatBTCvalue = formatBTCbalance.toNumber() * formatBtcPrice
        let expectedBTCborrowPower = formatBTCvalue * (await toNumber(s.wBTC_LTV))

        assert.equal(expectedBTCborrowPower, await toNumber(wbtcBorrowPower), "Borrow power for wBTC is correct")
    })

    it("borrow maximum USDi", async () => {
        let totalBorrowPower = await s.VaultController.vaultBorrowingPower(vaultID)

        await s.VaultController.connect(s.Gus).borrowUsdi(vaultID, totalBorrowPower)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Gus.address)
        expect(await toNumber(balance)).to.eq(await toNumber(totalBorrowPower))

    })

    it("Pass time, vault underwater", async () => {
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await mineBlock()

        const solvency = await s.VaultController.checkVault(vaultID)
        expect(solvency).to.eq(false)
    })

    it("Liquidate multiple assets", async () => {
        
        let balance = await s.USDI.balanceOf(s.Dave.address)
        await s.USDI.connect(s.Dave).approve(s.VaultController.address, balance)
        await mineBlock()          

        balance = await s.WBTC.balanceOf(s.Dave.address)
        expect(balance).to.eq(0)
        const wbtcToLiq = await s.VaultController.tokensToLiquidate(vaultID, s.WBTC.address)
        await s.VaultController.connect(s.Dave).liquidateVault(vaultID, s.WBTC.address, wbtcToLiq.sub(5000)) //liquidate mostly BTC but leave some room for a second UNI liquidation
        await mineBlock()
        balance = await s.WBTC.balanceOf(s.Dave.address)
        expect(await toNumber(balance)).to.eq(await toNumber(wbtcToLiq.sub(5000)))
        
        balance = await s.UNI.balanceOf(s.Dave.address)
        expect(balance).to.eq(0)
        const uniToLiq = await s.VaultController.tokensToLiquidate(vaultID, s.UNI.address)
        await s.VaultController.connect(s.Dave).liquidateVault(vaultID, s.UNI.address, uniToLiq)
        await mineBlock()
        balance = await s.UNI.balanceOf(s.Dave.address)
        expect(await toNumber(balance)).to.eq(await toNumber(uniToLiq))  

        let amountToSolvency = await s.VaultController.amountToSolvency(vaultID)
        expect(await toNumber(amountToSolvency)).to.be.closeTo(0, 0.1)
    })

    it("Repay all", async () => {
        await s.USDI.connect(s.Dave).transfer(s.Gus.address, UniAmount)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Gus.address)
        await s.USDI.connect(s.Gus).approve(s.VaultController.address, balance)
        await s.VaultController.connect(s.Gus).repayAllUSDi(vaultID)
        await mineBlock()

        let liability = await s.VaultController.vaultLiability(vaultID)
        expect(liability).to.eq(0)
    })

    it("withdraw wBTC", async () => {
        let balance = await s.WBTC.balanceOf(s.GusVault.address)
        await s.GusVault.connect(s.Gus).withdrawErc20(s.wbtcAddress, balance)
        await mineBlock()
        balance = await s.WBTC.balanceOf(s.Gus.address)
        expect(balance).to.be.closeTo(s.Gus_WBTC, 15000000) //~0.15 BTC from liquidation
    })

    it("withdraw UNI", async () => {
        let balance = await s.UNI.balanceOf(s.GusVault.address)
        await s.GusVault.connect(s.Gus).withdrawErc20(s.uniAddress, balance)
        await mineBlock()
        balance = await s.UNI.balanceOf(s.Gus.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.Carol_UNI), 1) //~1 UNI from liquidation

        let borrowPower = await s.VaultController.vaultBorrowingPower(vaultID)
        expect(borrowPower).to.eq(0)
    })
})