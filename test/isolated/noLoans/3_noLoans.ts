import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, fastForward, OneYear } from "../../../util/block";
import { IVault__factory } from "../../../typechain-types";
//import { assert } from "console";
import { utils } from "ethers";


describe("What happens when there are no loans?", () => {
    //9500 USDC
    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
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

        const reserveRatio = await s.USDI.reserveRatio()
        showBody("reserveRatio: ", reserveRatio)

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

        //todo check totalSupply and confirm interest rate changes

        //Dave approves and donates half of his remaining USDC
        const donateAmount = balance.div(2)

        await s.USDC.connect(s.Dave).approve(s.USDI.address, donateAmount)
        const donateResult = await s.USDI.connect(s.Dave).donate(donateAmount)
        await advanceBlockHeight(1)

        let newReserve = await s.USDC.balanceOf(s.USDI.address)
        assert.equal(newReserve.toString(), reserve.add(donateAmount).toString(), "New reserve is correct")

        //reserve ratio too high? 
        let reserveRatio = await s.USDI.reserveRatio()
        //showBody("reserveRatio: ", utils.formatEther(reserveRatio.toString()))

        balance = await s.USDI.balanceOf(s.Dave.address)
        expect(balance).to.be.gt(s.Dave_USDC.sub(depositAmount).toNumber())
        //showBody("Dave USDI: ", utils.formatEther(balance.toString()))

        //andy sends 100 USDC to the USDI contract like a dingus
        showBodyCyan("ANDY SENDS USDC")
        await s.USDC.connect(s.Andy).transfer(s.USDI.address, BN("100e6"))
        await mineBlock()
        reserveRatio = await s.USDI.reserveRatio()
        //showBody("reserveRatio: ", utils.formatEther(reserveRatio.toString()))

        balance = await s.USDI.balanceOf(s.Dave.address)
        //showBody("Dave USDI: ", utils.formatEther(balance.toString()))

    })

    it("Repay when reserve ratio is > 1e18", async () => {

        let reserveRatio = await s.USDI.reserveRatio()
        showBody("reserveRatio: ", utils.formatEther(reserveRatio.toString()))

        showBodyCyan("REPAY")
        const repayResult = await s.USDI.connect(s.Dave).withdrawAll()
        await advanceBlockHeight(1)
        let balance = await s.USDI.balanceOf(s.Dave.address)
        expect(balance.toNumber()).to.be.closeTo(0, BN("1e12").toNumber())

        reserveRatio = await s.USDI.reserveRatio()
        showBody("reserveRatio: ", utils.formatEther(reserveRatio.toString()))

    })

    it("need a loan to mint some new USDi to get reserve ratio below 0", async () => {
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
        showBody("borrowPower: ", utils.formatEther(borrowPower.toString()))

        //borrow full amount
        await s.VaultController.connect(s.Bob).borrowUsdi(vaultID, borrowPower)
        await mineBlock()
        let AccountLiability = await s.VaultController.accountLiability(vaultID)
        showBody("AccountLiability: ", utils.formatEther(AccountLiability.toString()))


        let reserveRatio = await s.USDI.reserveRatio()
        showBody("reserveRatio: ", utils.formatEther(reserveRatio.toString()))



        //repay all
        //bob does not have enough USDI to repay all with interest, must exchange USDC for some more to repayAll
        await expect(s.VaultController.connect(s.Bob).repayAllUSDi(vaultID)).to.be.reverted
        await mineBlock()

        balance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(balance.toString(), AccountLiability.toString(), "Bob's USDI == account liability before interest is calculated")

        balance = await s.USDC.balanceOf(s.Bob.address)
        showBody("Bob USDC", balance)

        //deposit 5 USDC
        await s.USDC.connect(s.Bob).approve(s.USDI.address, BN("5e6"))
        await mineBlock()
        const depositResult = await s.USDI.connect(s.Bob).deposit(BN("5e6"))
        await mineBlock()

        
        await s.VaultController.connect(s.Bob).repayAllUSDi(vaultID)
        await mineBlock()

        reserveRatio = await s.USDI.reserveRatio()
        showBody("reserveRatio: ", utils.formatEther(reserveRatio.toString()))

    })

})