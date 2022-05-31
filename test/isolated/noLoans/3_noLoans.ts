import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getArgs, getGas, toNumber } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, fastForward, OneYear } from "../../../util/block";
import { IVault__factory } from "../../../typechain-types";
import { utils } from "ethers";


describe("What happens when there are no loans?", () => {
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

    it("Deposit USDC and receive USDi", async () => {

        //dave deposits a large amount of USDC for USDI
        let balance = await s.USDC.balanceOf(s.Dave.address)
        assert.equal(balance.toString(), s.Dave_USDC.toString(), "Dave starting USDC is correct")

        //dave deposits all but 500 of his USDC
        await s.USDC.connect(s.Dave).approve(s.USDI.address, depositAmount)
        await mineBlock()
        const depositResult = await s.USDI.connect(s.Dave).deposit(depositAmount)
        await mineBlock()

        balance = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(balance.toString(), depositAmount.mul(BN("1e12")).toString(), "Dave has the correct amount of USDI")

    })
    it("Check for interest generation", async () => {

        await s.VaultController.calculateInterest()
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(balance.toString(), depositAmount.mul(BN("1e12")).toString(), "Dave has received no interest, as there are no loans")

        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        balance = await s.USDI.balanceOf(s.Dave.address)
        assert.equal(balance.toString(), depositAmount.mul(BN("1e12")).toString(), "Dave still has received no interest after 1 year, as there are no loans")

    })

    it("what happens when someone donates in this scenario?", async () => {
        let balance = await s.USDC.balanceOf(s.Dave.address)
        let reserve = await s.USDC.balanceOf(s.USDI.address)

        assert.equal(reserve.toString(), depositAmount.toString(), "reserve is correct")

        const initialTotalSupply = await s.USDI.totalSupply()

        //Dave approves and donates half of his remaining USDC
        const donateAmount = balance.div(2)

        await s.USDC.connect(s.Dave).approve(s.USDI.address, donateAmount)
        const donateResult = await s.USDI.connect(s.Dave).donate(donateAmount)
        await advanceBlockHeight(1)

        let newTS = await s.USDI.totalSupply()
        assert.equal(await toNumber(newTS), await toNumber(initialTotalSupply.add(donateAmount.mul(BN("1e12")))), "New total supply is correct")

        let newReserve = await s.USDC.balanceOf(s.USDI.address)
        assert.equal(newReserve.toString(), reserve.add(donateAmount).toString(), "New reserve is correct")

        //reserve ratio is still below 1 after donate
        let reserveRatio = await s.USDI.reserveRatio()
        expect(await toNumber(reserveRatio)).to.be.lt(1)
        expect(await toNumber(reserveRatio)).to.be.closeTo(1, 0.001)

        balance = await s.USDI.balanceOf(s.Dave.address)
        expect(balance).to.be.gt(s.Dave_USDC.sub(depositAmount).toNumber())

        //andy sends 100 USDC to the USDI contract
        await s.USDC.connect(s.Andy).transfer(s.USDI.address, BN("100e6"))
        await mineBlock()
        reserveRatio = await s.USDI.reserveRatio()
        expect(await toNumber(reserveRatio)).to.be.gt(1)//reserve ratio is too high

    })
    
    /**
     * NOTE: once governance calls donateReserve(), there is no longer a possibility for a 
     * refund for any USDC accidently sent to the USDi contract, unless governance decides to 
     * issue a refund from its treasury
     * 
     * Once donateReserve() is called, all USDC held by the USDi contract will be rebased to all USDi holders irreversibly 
     */
    it("Test donateReserve", async () => {

        const daveBalanceInit = await s.USDI.balanceOf(s.Dave.address)

        let reserveRatio = await s.USDI.reserveRatio()
        expect(reserveRatio.sub(BN("1e18"))).to.be.gt(0)

        let donateReserveResult = await s.USDI.donateReserve()
        await mineBlock()
        let gas = await getGas(donateReserveResult)
        showBodyCyan("Gas cost to donate reserve: ", gas)

        reserveRatio = await s.USDI.reserveRatio()
        assert.equal(reserveRatio.toString(), BN("1e18").toString(), "Reserve ratio is exactly 1e18 after rebase")

        let daveBalance = await s.USDI.balanceOf(s.Dave.address)
        expect(await toNumber(daveBalance)).to.be.gt(await toNumber(daveBalanceInit))
    })

    it("Repay when reserve ratio is > 1e18", async () => {

        //andy sends the rest of his USDC to USDI contract
        let balance = await s.USDC.balanceOf(s.Andy.address)
        let format = balance.div(BN("1e6"))
        await s.USDC.connect(s.Andy).transfer(s.USDI.address, balance)
        await mineBlock()
        let reserveRatio = await s.USDI.reserveRatio()
        expect(await toNumber(reserveRatio)).to.be.gt(1.0)

        //repay when reserve ratio is too high, makes reserve ratio even higher 
        const repayResult = await s.USDI.connect(s.Dave).withdrawAll()
        await advanceBlockHeight(1)
        balance = await s.USDI.balanceOf(s.Dave.address)
        expect(balance.toNumber()).to.be.closeTo(0, BN("1e12").toNumber())

        reserveRatio = await s.USDI.reserveRatio()
        expect(await toNumber(reserveRatio)).to.be.closeTo(2.0, 0.2)

        //donate reserve to get it to 1 again
        let donateReserveResult = await s.USDI.connect(s.Frank).donateReserve()
        await mineBlock()
        let gas = await getGas(donateReserveResult)
        showBodyCyan("Gas cost to donate reserve: ", gas)
        let args = await getArgs(donateReserveResult)
        expect(await toNumber(args._value)).to.eq(format.toNumber())

        reserveRatio = await s.USDI.reserveRatio()
        assert.equal(reserveRatio.toString(), BN("1e18").toString(), "Reserve ratio is exactly 1e18 after rebase")
    })
})