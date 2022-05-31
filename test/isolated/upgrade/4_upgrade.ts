import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getArgs, getGas, truncate, toNumber } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, fastForward, OneYear, OneWeek } from "../../../util/block";
import { IVaultController2, IVault__factory } from "../../../typechain-types";
//import { assert } from "console";
import { utils } from "ethers";
//simport { truncate } from "fs";

let VaultController2: IVaultController2
describe("Testing explicit upgradeability ", () => {
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
    it("Mint a vault and initiate a borrow", async () => {
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



    it("Upgrade VaultController contract", async () => {
        //deploy implementation
        const VC2factory = await ethers.getContractFactory("VaultController2")
        const imp = await VC2factory.deploy()
        await mineBlock()
        await imp.deployed()

        //upgrade
        await s.ProxyAdmin.connect(s.Frank).upgrade(s.VaultController.address, imp.address)
        await mineBlock()

        VaultController2 = VC2factory.attach(s.VaultController.address)
        await mineBlock()

    })

    it("Check VaultController2 new features", async () => {
        const result = await VaultController2.changeTheThing(24)
        await mineBlock()
        const args = await getArgs(result)

        assert.equal(args.newThing.toNumber(), 24, "New thing is correct on new event arg")

        let newThing = await VaultController2.newThing()
        assert.equal(newThing.toNumber(), 24, "New thing is correct on contract state")

    })

    it("Confirm state matches VaultController V1", async () => {
        const vaultsMinted = await VaultController2.vaultsMinted()
        expect(vaultsMinted).to.eq(BN("1"))//1 vault minteds

        //totalLiability has increased
        const totalLiability = await s.VaultController.totalBaseLiability()
        expect(await toNumber(totalLiability)).to.be.gt(0)

        //interest factor has increased
        const interestFactor = await s.VaultController.interestFactor()
        expect(await toNumber(interestFactor)).to.be.gt(1.0)

    })

    it("liquidate vault on new upgraded contract", async () => {
        const vaultID = await VaultController2.vaultsMinted()
        const bobUSDI = await s.USDI.balanceOf(s.Bob.address)

        const daveUSDI = await s.USDI.balanceOf(s.Dave.address)
        expect(await toNumber(daveUSDI)).to.be.gt(0)//dave has USDI to liquidate with 

        const AccountLiability = await VaultController2.vaultLiability(vaultID)
        expect(await toNumber(AccountLiability)).to.be.gt(await toNumber(bobUSDI))//bob does not have enough USDI to completely repay the loan
        //showBody("Account Liability: ", await toNumber(AccountLiability))

        const amountToSolvency = await VaultController2.amountToSolvency(vaultID)
        expect(await toNumber(amountToSolvency)).to.be.gt(0)

        const daveWETH = await s.WETH.balanceOf(s.Dave.address)

        //liquidate
        await VaultController2.connect(s.Dave).liquidateVault(vaultID, s.wethAddress, utils.parseEther("1"))
        await mineBlock()
        
        //dave received wETH for liquidation
        let balance = await s.WETH.balanceOf(s.Dave.address)
        expect(await toNumber(balance)).to.be.gt(await toNumber(daveWETH))

        let a2s = await VaultController2.amountToSolvency(vaultID)
        expect(a2s.toNumber()).to.be.closeTo(1000, 999)//amountToSolvency should be almost 0 

    })
})