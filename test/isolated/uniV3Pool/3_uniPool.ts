import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getArgs, getGas, truncate, toNumber, getEvent } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, currentBlock, fastForward, OneYear, OneWeek } from "../../../util/block";
import { IVault__factory } from "../../../typechain-types";
//import { assert } from "console";
import { BigNumber, utils } from "ethers";
import { token } from "../../../typechain-types";

import {
    abi as FACTORY_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'

import {
    abi as POOL_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'


describe("Test Uniswap V3 pool with rebasing USDi token", () => {
    //get router for uniV3
    const v3RouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"


    const nfpManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
    const NFPM_ABI = require("./util/INonfungiblePositionManager.json")
    const NFPM = new ethers.Contract(nfpManagerAddress, NFPM_ABI, ethers.provider)




    //get factory for uniV3
    const v3FactoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
    const factoryV3 = new ethers.Contract(v3FactoryAddress, FACTORY_ABI, ethers.provider)

    let poolAddress: string
    let poolV3: any


    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    //1 quarter of Dave's USDC
    const usdcDepositAmount = s.Dave_USDC.div(4)

    let usdiAmount: BigNumber

    //1 half of Bob's wETH
    const collateralAmount = s.Bob_WETH.div(2)

    let borrowAmount: BigNumber

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

        let borrowPower = await s.VaultController.vaultBorrowingPower(vaultID)
        //borrow 80% of LTV maximum
        borrowAmount = borrowPower.sub(borrowPower.div(5))

        //borrow 
        const borrowResult = await s.VaultController.connect(s.Bob).borrowUsdi(vaultID, borrowAmount)
        await mineBlock()
        const borrowArgs = await getArgs(borrowResult)

        expect(await toNumber(borrowAmount)).to.equal(await toNumber(borrowArgs.borrowAmount))

    })


    it("Use borrowed USDi to make a uni v3 pool", async () => {
        const wETHamount = await s.WETH.balanceOf(s.Bob.address)
        expect(await toNumber(wETHamount)).to.eq(await toNumber(s.Bob_WETH.div(2)))
        usdiAmount = await s.USDI.balanceOf(s.Bob.address)
        const block = await currentBlock()
        const deadline = block.timestamp + 500

        const createPoolResult = await factoryV3.connect(s.Frank).createPool(
            s.USDI.address,
            s.WETH.address,
            3000
        )
        await mineBlock()
        const receipt = await createPoolResult.wait()
        await mineBlock()
        poolAddress = receipt!.events![0].args.pool

        poolV3 = await new ethers.Contract(poolAddress, POOL_ABI, ethers.provider)

        const sqrtPriceX96 = utils.parseEther("45")//eth price ~2k -> sqrt = ~45

        await poolV3.connect(s.Frank).initialize(sqrtPriceX96)
        await mineBlock()

        let mintParams = [
            s.USDI.address,
            s.WETH.address,
            "10000", //Fee
            "-259200", //tickLower
            "-257600", //tickUpper
            usdiAmount,
            wETHamount,
            usdiAmount.div(2),
            wETHamount.div(2),
            s.Frank.address,
            deadline
        ]

        const mintResult = await NFPM.connect(s.Frank).mint(mintParams)
        await mineBlock()

      

        showBody(mintParams)




        //await poolV3.connect(s.Frank).addLiquidity()
        //await mineBlock()



        /**
          await poolV3.connect(s.Frank).mint(
             s.Frank.address,
             -259200,
             -257600,
             5999999853934643922,
             0x0
         )
         await mineBlock()
         */



        //const observe = await poolV3.connect(s.Frank).observe([30])
        //await mineBlock()
        //showBody(observe)

        let slot0 = await poolV3.slot0()
        showBody(slot0)




    })

    it("check that the pair has been created correctly", async () => {


    })


    it("check what happens when USDi rebases while in the pool", async () => {


    })

    it("do a small swap", async () => {


    })

    it("remove all liquidity from pool and receive USDi + interest ", async () => {

    })

})