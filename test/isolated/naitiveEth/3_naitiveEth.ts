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


describe("Deposit, borrow against, and withdraw using naitive ether", () => {
    //9500 USDC
    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    const amount = utils.parseEther("5") //5 eth
    const borrowAmount = utils.parseEther("500")//usdi to borrow against eth

    let vaultID: number

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

    it("mint a vault", async () => {

        //confirm reserve is 0
        let reserve = await s.USDC.balanceOf(s.USDI.address)
        expect(reserve).to.eq(0)

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

    })

    it("send eronious ether to vault", async () => {

        let tx = {
            to: s.BobVault.address,
            value: amount
        }
        await expect(s.Bob.sendTransaction(tx)).to.be.reverted
        await mineBlock()

    })

    it("deposit naitive ether", async () => {
        const startingEth = await ethers.provider.getBalance(s.Bob.address)
        expect(await toNumber(startingEth)).to.be.gt(await toNumber(amount))
        const overrides = {
            value: amount
        }

        const depositResult = await s.BobVault.connect(s.Bob).depositETH(overrides)
        await mineBlock()
        const gas = await getGas(depositResult)
        showBodyCyan("Gas cost to deposit ether: ", gas)

        //bob has 5 less eth +/- gas 
        let balance = await ethers.provider.getBalance(s.Bob.address)
        let difference = startingEth.sub(balance)
        expect(await toNumber(difference)).to.be.closeTo(5, 0.0001)
    })

    it("check things", async () => {
        //bob's vault holds 0 naitive ether
        let balance = await ethers.provider.getBalance(s.BobVault.address)
        expect(balance).to.eq(0)

        balance = await s.WETH.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.eq(await toNumber(amount))
    })

    it("borrow against naitive eth", async () => {

        const borrowPower = await s.VaultController.accountBorrowingPower(vaultID)


        await s.VaultController.connect(s.Bob).borrowUsdi(vaultID, borrowPower)
        await mineBlock()


        const liability = await s.VaultController.accountLiability(vaultID)
        expect(await toNumber(liability)).to.be.gt(0)
    })

    it("try to withdraw ether when vault is insolvent", async () => {
        await expect(s.BobVault.connect(s.Bob).withdrawEther(amount)).to.be.revertedWith("over-withdrawal")        
    })

    it("repay entire loan", async () => {
        //deposit some USDC so bob has enough USDi to repay all of the loan
        await s.USDC.connect(s.Bob).approve(s.USDI.address, BN("5e6"))
        await mineBlock()
        await s.USDI.connect(s.Bob).deposit(BN("5e6"))
        await mineBlock()

        //repay
        let balance = await s.USDI.balanceOf(s.Bob.address)
        await s.USDI.connect(s.Bob).approve(s.VaultController.address, balance)
        await mineBlock()

        await s.VaultController.connect(s.Bob).repayAllUSDi(vaultID)
        await mineBlock()

        const liability = await s.VaultController.accountLiability(vaultID)
        expect(liability).to.eq(0)

    })

    it("Dave tries to withdraw ether from Bob's vault", async () => {
        await expect(s.BobVault.connect(s.Dave).withdrawEther(amount)).to.be.revertedWith("sender not minter")
    })

    it("try to withdraw more ether than vault contains", async () => {
        await expect(s.BobVault.connect(s.Bob).withdrawEther(amount.add(500))).to.be.reverted
    })

    it("withdraw ether and confirm balance", async () => {
        const startingEth = await ethers.provider.getBalance(s.Bob.address)
        const vaultWETH = await s.WETH.balanceOf(s.BobVault.address)
        expect(await toNumber(vaultWETH)).to.eq(await toNumber(amount))

        await s.BobVault.connect(s.Bob).withdrawEther(amount)
        await mineBlock()

        let balance = await ethers.provider.getBalance(s.Bob.address)
        let difference = balance.sub(startingEth)
        expect(await toNumber(difference)).to.be.closeTo(5, 0.0001)
    })








})