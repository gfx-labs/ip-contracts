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
import { start } from "repl";


describe("Testing depositTo/withdrawTo, borrowUSDIto/borrowUSDCto", () => {
    //9500 USDC
    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    let vaultID: number
    const USDC_BORROW = BN("1000e6")//1k USDC

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

    it("Deposit some collateral so we can take a loan", async () => {
        //mint vault
        //Bob mints vault
        await expect(s.VaultController.connect(s.Bob).mintVault()).to.not.reverted;
        await mineBlock();
        vaultID = await (await s.VaultController.vaultsMinted()).toNumber()
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
        expect(await toNumber(borrowPower)).to.be.gt(2000, "Bob can now borrow more than 2k USD")
    })

    it("Borrow USDC using new borrowUSDCto function", async () => {
        const startUSDC = await s.USDC.balanceOf(s.Bob.address)
        //bob borrows USDC
        const result = await s.VaultController.connect(s.Bob).borrowUSDCto(vaultID, USDC_BORROW, s.Bob.address)
        await mineBlock()


        const endUSDC = await s.USDC.balanceOf(s.Bob.address)
        let difference = endUSDC.sub(startUSDC)
        showBody(difference)

    })
})
