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

        let borrowPower = await s.VaultController.vaultBorrowingPower(vaultID)
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


        //Carol transfers UNI collateral
        let balance = await s.UNI.balanceOf(s.Carol.address)
        expect(balance).to.eq(s.Carol_UNI)

        //Carol transfers all UNI
        await s.UNI.connect(s.Carol).transfer(s.CarolVault.address, balance)
        await mineBlock()

        let borrowPower = await s.VaultController.vaultBorrowingPower(vaultID)
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

        const initLiability = await s.VaultController.vaultLiability(vaultID)
        const startBalance = await s.USDI.balanceOf(s.Frank.address)
        const initBaseLiab = await s.VaultController.totalBaseLiability()
        const initInterestFactor = await s.VaultController.interestFactor()

        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        let AccountLiability = await s.VaultController.vaultLiability(vaultID)

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
        expect(await toNumber(balance)).to.be.gt(0)
        //confirm reserve is 0
        let reserve = await s.USDC.balanceOf(s.USDI.address)
        expect(reserve).to.eq(0)


        //try to withdraw from empty reserve
        await s.USDI.connect(s.Frank).approve(s.USDI.address, balance)
        await mineBlock()
        await expect(s.USDI.connect(s.Frank).withdraw(balance)).to.be.reverted
        await mineBlock()

    })

    it("test donateReserve", async () => {
        const eroniousAmount = 500e6

        let totalUSDC = await s.USDC.balanceOf(s.USDI.address)
        assert.equal(totalUSDC.toNumber(), 0, "No USDC is held by the USDI contract")

        //deposit some USDC
        let balance = await s.USDC.balanceOf(s.Bob.address)
        expect(balance).to.eq(s.Bob_USDC)
        await s.USDC.connect(s.Bob).approve(s.USDI.address, balance)
        await mineBlock()
        const depositResult = await s.USDI.connect(s.Bob).deposit(balance)
        await mineBlock()

        //erouniously transfer some USDC to the reserve
        balance = await s.USDC.balanceOf(s.Dave.address)
        expect(balance).to.eq(s.Dave_USDC)
        await s.USDC.connect(s.Dave).transfer(s.USDI.address, eroniousAmount)//eroniously transfer 500 USDC
        await mineBlock()

        //check things before donate
        totalUSDC = await s.USDC.balanceOf(s.USDI.address)
        assert.equal(totalUSDC.toNumber(), (s.Bob_USDC.toNumber() + eroniousAmount), "Correct amount of USDC is held by the USDI contract")

        let IF = await s.VaultController.interestFactor()
        let totalLiability = await s.VaultController.totalBaseLiability()
        totalLiability = await truncate(totalLiability.mul(IF))

        let trueTotal = (totalUSDC.mul(BN("1e12"))).add(totalLiability)

        let totalSupply = await s.USDI.totalSupply()
        let difference = trueTotal.sub(totalSupply)


        //donate
        const result = await s.USDI.connect(s.Frank).donateReserve()
        await mineBlock()
        const args = await getArgs(result)

        expect(await toNumber(args._value)).to.be.closeTo(await toNumber(BN("1e12").mul(eroniousAmount)), 1)
        expect(await toNumber(difference)).to.be.closeTo(await toNumber(args._value), 1)

        //check more things        

        IF = await s.VaultController.interestFactor()
        totalLiability = await s.VaultController.totalBaseLiability()
        totalLiability = await truncate(totalLiability.mul(IF))

        trueTotal = (totalUSDC.mul(BN("1e12"))).add(totalLiability)

        totalSupply = await s.USDI.totalSupply()
        difference = trueTotal.sub(totalSupply)

        //no reserve to donate
        expect(difference).to.eq(0)

        await expect(s.USDI.donateReserve()).to.be.revertedWith("No extra reserve")




    })
})