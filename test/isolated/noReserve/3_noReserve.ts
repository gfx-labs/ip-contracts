import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getArgs, getGas, truncate, toNumber } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, fastForward, OneYear, OneWeek } from "../../../util/block";
import { IVault__factory } from "../../../typechain-types";
//import { assert } from "console";
import { utils } from "ethers";
//simport { truncate } from "fs";


describe("What happens when there is no reserve?", () => {
    //9500 USDC
    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    it("Confirms contract holds no value", async () => {
        const totalLiability = await s.VaultController.totalBaseLiability()
        expect(totalLiability).to.eq(BN("0"))

        const vaultsMinted = await s.VaultController.vaultsMinted()
        expect(vaultsMinted).to.eq(BN("0"))

        const interestFactor = await s.VaultController.interestFactor()
        expect(interestFactor).to.eq(BN("1e18"))

        const tokensRegistered = await s.VaultController.tokensRegistered()
        expect(tokensRegistered).to.eq(BN("2"))//weth && comp

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
        expect(tokensRegistered).to.eq(BN("2"))//weth && comp

        //no new USDi has been minted
        const totalSupply = await s.USDI.totalSupply()
        expect(totalSupply).to.eq(BN("1e18"))

        const scaledTotalSupply = await s.USDI.scaledTotalSupply()
        expect(scaledTotalSupply).to.eq(totalSupply.mul(BN("1e48")))

        const reserveRatio = await s.USDI.reserveRatio()
        expect(reserveRatio).to.eq(0)
    })

    it("borrow USDi when there is no reserve", async () => {

        //confirm reserve is 0
        let reserve = await s.USDC.balanceOf(s.USDI.address)
        expect(reserve).to.eq(0)

        //mint vault
        //Bob mints vault
        await expect(s.VaultController.connect(s.Bob).mintVault()).to.not.reverted;
        await mineBlock();
        const vaultID = await s.VaultController.vaultsMinted()
        let bobVault = await s.VaultController.vaultAddress(vaultID)
        s.BobVault = IVault__factory.connect(
            bobVault,
            s.Bob,
        );
        expect(await s.BobVault.minter()).to.eq(s.Bob.address)
        await mineBlock()


        //Bob transfers wETH collateral
        let balance = await s.WETH.balanceOf(s.Bob.address)
        expect(balance).to.eq(s.Bob_WETH)

        //Bob transfers 1 wETH
        await s.WETH.connect(s.Bob).transfer(s.BobVault.address, utils.parseEther("1"))
        await mineBlock()

        let borrowPower = await s.VaultController.accountBorrowingPower(vaultID)
        //showBody("borrowPower: ", utils.formatEther(borrowPower.toString()))

        //borrow full amount
        const borrowResult = await s.VaultController.connect(s.Bob).borrowUsdi(vaultID, borrowPower)
        await mineBlock()
        const borrowArgs = await getArgs(borrowResult)
        const borrowAmount = borrowArgs.borrowAmount

        expect(await toNumber(borrowAmount)).to.be.closeTo(await toNumber(borrowPower), 0.01)

    })

    it("Borrow again to push up the total base liability", async () => {
        //confirm reserve is 0
        let reserve = await s.USDC.balanceOf(s.USDI.address)
        expect(reserve).to.eq(0)

        //mint vault
        //Bob mints vault
        await expect(s.VaultController.connect(s.Carol).mintVault()).to.not.reverted;
        await mineBlock();
        const vaultID = await s.VaultController.vaultsMinted()
        let carolVault = await s.VaultController.vaultAddress(vaultID)
        s.CarolVault = IVault__factory.connect(
            carolVault,
            s.Carol,
        );
        expect(await s.BobVault.minter()).to.eq(s.Bob.address)
        await mineBlock()


        //Carol transfers COMP collateral
        let balance = await s.COMP.balanceOf(s.Carol.address)
        expect(balance).to.eq(s.Carol_COMP)

        //Carol transfers all COMP
        await s.COMP.connect(s.Carol).transfer(s.CarolVault.address, balance)
        await mineBlock()

        let borrowPower = await s.VaultController.accountBorrowingPower(vaultID)
        //showBody("borrowPower: ", utils.formatEther(borrowPower.toString()))

        //borrow full amount
        const borrowResult = await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, borrowPower)
        await mineBlock()
        const borrowArgs = await getArgs(borrowResult)
        const borrowAmount = borrowArgs.borrowAmount

        expect(await toNumber(borrowAmount)).to.be.closeTo(await toNumber(borrowPower), 0.01)
    })

    it("check things", async () => {
        const vaultID = await s.VaultController.vaultsMinted()

        const initLiability = await s.VaultController.accountLiability(vaultID)
        const startBalance = await s.USDI.balanceOf(s.Frank.address)
        const initBaseLiab = await s.VaultController.totalBaseLiability()
        const initInterestFactor = await s.VaultController.interestFactor()

        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        let AccountLiability = await s.VaultController.accountLiability(vaultID)

        expect(await toNumber(AccountLiability)).to.be.gt(await toNumber(initLiability))

        let totalBaseLiab = await s.VaultController.totalBaseLiability()
        assert.equal(totalBaseLiab.toString(), initBaseLiab.toString(), "base liability has not changed")

        let interestFactor = await s.VaultController.interestFactor()

        expect(await toNumber(interestFactor)).to.be.gt(await toNumber(initInterestFactor))

        //check interest generation
        let balance = await s.USDI.balanceOf(s.Frank.address)
        expect(await toNumber(balance)).to.be.gt(await toNumber(startBalance))
    })

    it("Large liability, to reserve, try to withdraw USDC for USDI", async () => {
        let balance = await s.USDI.balanceOf(s.Frank.address)
        expect(await toNumber(balance)).to.be.gt(1)
        //confirm reserve is 0
        let reserve = await s.USDC.balanceOf(s.USDI.address)
        expect(reserve).to.eq(0)


        //try to withdraw from empty reserve
        await s.USDI.connect(s.Frank).approve(s.USDI.address, balance)
        await mineBlock()
        await expect(s.USDI.connect(s.Frank).withdraw(balance)).to.be.reverted
        await mineBlock()

    })
})