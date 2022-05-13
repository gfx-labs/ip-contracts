import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getArgs, getGas, truncate, toNumber } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, currentBlock, fastForward, OneYear, OneWeek } from "../../../util/block";
import { IVault__factory } from "../../../typechain-types";
//import { assert } from "console";
import { BigNumber, utils } from "ethers";
//simport { truncate } from "fs";




describe("Test Uniswap pool with rebasing USDi token", () => {
    const IUniswapV2Router02 = require("./util/IUniswapV2Router02")
    const router02ABI = new IUniswapV2Router02()
    let ro2 = router02ABI.Router02()
    const router02 = ro2[0].abi
    const Router02Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"

    const routerV2 = new ethers.Contract(Router02Address, router02 , ethers.provider)

    //showBody(router02[0].abi)


    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    //1 quarter of Dave's USDC
    const usdcDepositAmount = s.Dave_USDC.div(4)

    //1 half of Bob's wETH
    const collateralAmount = s.Bob_WETH.div(2)

    let borrowAmount:BigNumber

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

    it("deposit some USDC so there is some reserve", async () => {
        //dave deposits USDC
        let daveUSDC = await s.USDC.balanceOf(s.Dave.address)
        expect(await toNumber(daveUSDC)).to.eq(await toNumber(s.Dave_USDC))

        await s.USDC.connect(s.Dave).approve(s.USDI.address, usdcDepositAmount)
        await mineBlock()

        await s.USDI.connect(s.Dave).deposit(usdcDepositAmount)
        await mineBlock()

        //dave has the correct amount of USDC after deposit 
        daveUSDC = await s.USDC.balanceOf(s.Dave.address)
        expect(await toNumber(daveUSDC)).to.eq(await toNumber(s.Dave_USDC.sub(usdcDepositAmount)))

        //USDC in reserve is correct
        const reserve = await s.USDC.balanceOf(s.USDI.address)
        expect(await toNumber(reserve)).to.eq(await toNumber(usdcDepositAmount))       

    })


    it("Start some liability so USDi has yield", async () => {

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

        //Bob transfers wETH
        await s.WETH.connect(s.Bob).transfer(s.BobVault.address, collateralAmount)
        await mineBlock()

        let borrowPower = await s.VaultController.accountBorrowingPower(vaultID)
        //borrow 80% of LTV maximum
        borrowAmount = borrowPower.sub(borrowPower.div(5))

        //borrow 
        const borrowResult = await s.VaultController.connect(s.Bob).borrowUsdi(vaultID, borrowAmount)
        await mineBlock()
        const borrowArgs = await getArgs(borrowResult)

        expect(await toNumber(borrowAmount)).to.equal(await toNumber(borrowArgs.borrowAmount))

    })


    it("Use borrowed USDi to make a uni v2 pool", async () => {
        const wETHamount = await s.WETH.balanceOf(s.Bob.address)
        const USDIamount = await s.USDI.balanceOf(s.Bob.address)
        const block = await currentBlock()
        const deadline = block.timestamp + 500

    
        //approvals
        await s.USDI.connect(s.Bob).approve(routerV2.address, USDIamount)
        await s.WETH.connect(s.Bob).approve(routerV2.address, wETHamount)
        await mineBlock()

        await routerV2.connect(s.Bob).addLiquidity(
            s.USDI.address,
            s.WETH.address,
            USDIamount,
            wETHamount,
            USDIamount.div(2),
            wETHamount.div(2),
            s.Bob.address,
            deadline
        )
        await mineBlock()


        




    })

    it("check things", async () => {

    })



    it("check more things", async () => {

    })





})