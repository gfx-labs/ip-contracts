import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getGas, toNumber, getArgs } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, fastForward, OneWeek } from "../../../util/block";
import { IVault__factory } from "../../../typechain-types";
//import { assert } from "console";
import { utils } from "ethers";


describe("Borrow against wBTC, liquidate, and repay", () => {
    //9000 USDC
    const depositAmount = s.Dave_USDC.sub(BN("1000e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))


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

        //mint vault
        //Bob mints vault
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

        //Bob transfers wETH collateral
        let balance = await s.WBTC.balanceOf(s.Gus.address)
        expect(balance).to.eq(s.Gus_WBTC)

        //Bob transfers 3 WBTC
        await s.WBTC.connect(s.Gus).transfer(s.GusVault.address, s.ONE_BTC)
        await mineBlock()

    })
    it("Check borrowing power and borrow USDi", async () => {
        let borrowPower = await s.VaultController.vaultBorrowingPower(vaultID)

        //borrow full amount
        const borrowResult = await s.VaultController.connect(s.Gus).borrowUsdi(vaultID, borrowPower)
        await mineBlock()
        const borrowArgs = await getArgs(borrowResult)
        const borrowAmount = borrowArgs.borrowAmount

        expect(await toNumber(borrowAmount)).to.be.closeTo(await toNumber(borrowPower), 0.01)
        let balance = await s.USDI.balanceOf(s.Gus.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(borrowPower), 0.01)

    })

    it("Pass time, vault underwater", async () => {
        await fastForward(OneWeek)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        let solvency = await s.VaultController.checkVault(vaultID)
        expect(solvency).to.eq(false)

    })

    it("Liquidate", async () => {

        let amountToSolvency = await s.VaultController.amountToSolvency(vaultID)
    

        const balance = await s.USDI.balanceOf(s.Dave.address)

        //confirm Dave has enough to liquidate
        expect(await toNumber(balance)).to.be.gt(await toNumber(amountToSolvency))

        const tokensToLiq = await s.VaultController.tokensToLiquidate(vaultID, s.WBTC.address)

        const startingWBTC = await s.WBTC.balanceOf(s.Dave.address)
        expect(startingWBTC).to.eq(0)//liquidator holds no wBTC prior to liquidation

        //liquidate
        await s.USDI.connect(s.Dave).approve(s.VaultController.address, amountToSolvency.add(utils.parseEther("5")))
        await mineBlock()
        await s.VaultController.connect(s.Dave).liquidateVault(vaultID, s.WBTC.address, tokensToLiq) //7748524 - true amount? 5167172 - off by 1 22798917 - maximum ish
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()
        let wbtcAmount = await s.WBTC.balanceOf(s.Dave.address)
        expect(wbtcAmount).to.be.gt(0)


        let endUSDI = await s.USDI.balanceOf(s.Dave.address) 
        let difference = balance.sub(endUSDI)

        expect(await toNumber(difference)).to.be.gt(0)

        amountToSolvency = await s.VaultController.amountToSolvency(vaultID)
        expect(await toNumber(amountToSolvency)).to.be.closeTo(0, 0.1)
    })

    it("Repay all and withdraw", async () => {


    })
})