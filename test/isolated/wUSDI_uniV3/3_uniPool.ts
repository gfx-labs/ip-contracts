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
import { start } from "repl";
import { webcrypto } from "crypto";


describe("Test Uniswap V3 pool with wrapped USDi token", () => {
    //get router for uniV3
    const v2RouterAddress = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" //V2 compatible router
    const ROUTER02_ABI = require("./util/ISwapRouter02.json")
    const router02 = new ethers.Contract(v2RouterAddress, ROUTER02_ABI, ethers.provider)

    const v3RouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
    const ROUTER_ABI = require("./util/ISwapRouter.json")
    const router = new ethers.Contract(v3RouterAddress, ROUTER_ABI, ethers.provider)

    const nfpManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
    const NFPM_ABI = require("./util/INonfungiblePositionManager.json")
    const NFPM = new ethers.Contract(nfpManagerAddress, NFPM_ABI, ethers.provider)

    //get factory for uniV3
    const v3FactoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
    const factoryV3 = new ethers.Contract(v3FactoryAddress, FACTORY_ABI, ethers.provider)

    let poolAddress: string
    let poolV3: any
    let tokenId: number


    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    //1 quarter of Dave's USDC
    const usdcDepositAmount = s.Dave_USDC.div(4)

    //0x19fdfff24c5dda5d2fcb032bda8cc4482270a8d17452a7478be427b595fe5408
    const wETHamount = utils.parseEther("5")
    //const usdiAmount = BN("9745435642333408348323")
    const usdiAmount = utils.parseEther("1000")

    //1 half of Bob's wETH
    const collateralAmount = s.Bob_WETH.div(2)

    let borrowAmount: BigNumber
    let balance: BigNumber


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

    it("wrap some USDI and receive wUSDI", async () => {




        const startUSDI = await s.USDI.balanceOf(s.Bob.address)
        //showBody(await toNumber(usdiAmount))
        //showBody("Start USDI: ", await toNumber(startUSDI))
        expect(await toNumber(startUSDI)).to.be.gt(await toNumber(usdiAmount)) //Bob has enough USDI


        await s.USDI.connect(s.Bob).transfer(s.Eric.address, usdiAmount)//Eric holds 100 USDI and acts as control
        await mineBlock()
        await s.USDI.connect(s.Bob).transfer(s.Gus.address, usdiAmount)//Gus wraps 100 USDI and unwraps and compares to Eric
        await mineBlock()

        const gusBalance = await s.USDI.balanceOf(s.Eric.address)
        expect(await toNumber(gusBalance)).to.eq(await toNumber(usdiAmount)) //Bob has enough USDI

        const ericBalance = await s.USDI.balanceOf(s.Eric.address)
        expect(await toNumber(ericBalance)).to.eq(await toNumber(usdiAmount)) //Bob has enough USDI

        balance = await s.WUSDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.eq(0) //Bob has 0 WUSDI

        await s.USDI.connect(s.Gus).approve(s.WUSDI.address, usdiAmount)
        await mineBlock()

        await s.WUSDI.connect(s.Gus).deposit(usdiAmount)
        await mineBlock()

        balance = await s.WUSDI.balanceOf(s.Gus.address)
        //showBody("WUSDI received: ", await toNumber(balance))
        //expect(await toNumber(balance)).to.eq(await toNumber(usdiAmount)) //Bob has the correct amount of WUSDI

        balance = await s.USDI.balanceOf(s.Gus.address)
        expect(await toNumber(balance)).to.eq(0)



    })

    it("Advance time, unwrap, compare balances", async () => {
        const liab = await s.VaultController.totalBaseLiability()
        expect(await toNumber(liab)).to.be.gt(0)//there is liability on the protocol, so interest will accrue 
        //pass time
        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        const controlBalance = await s.USDI.balanceOf(s.Eric.address)
        expect(await toNumber(controlBalance)).to.be.gt(await toNumber(usdiAmount))//interest has accrued

        let underlying = await s.WUSDI.balanceOfUnderlying(s.Gus.address)
        //slight error means WUSDI contract does not quite hold enough USDI to withdraw all
        await s.WUSDI.connect(s.Gus).withdraw(underlying.sub(utils.parseEther('1')))
        await mineBlock()

        //balance = await s.WUSDI.balanceOf(s.Gus.address)
        //showBody("Gus WUSDI: ", await toNumber(balance))

        balance = await s.USDI.balanceOf(s.Gus.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(controlBalance), 1)    

    })
    it("Use wUSDi to make a uni v3 pool", async () => {

        const createPoolResult = await factoryV3.connect(s.Bob).createPool(
            s.USDI.address,
            s.WETH.address,
            10000
        )
        await mineBlock()
        const receipt = await createPoolResult.wait()
        await mineBlock()
        poolAddress = receipt!.events![0].args.pool

        poolV3 = await new ethers.Contract(poolAddress, POOL_ABI, ethers.provider)
    })
    it("mint a position on the new pool", async () => {

    })

    it("Advance time", async () => {
        const liab = await s.VaultController.totalBaseLiability()
        expect(await toNumber(liab)).to.be.gt(0)//there is liability on the protocol, so interest will accrue 
        //pass time
        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()


    })

    it("Dave does a small swap", async () => {

    })

    it("Advance time again", async () => {
        const liab = await s.VaultController.totalBaseLiability()
        expect(await toNumber(liab)).to.be.gt(0)//there is liability on the protocol, so interest will accrue 
        //pass time
        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()


    })

    it("Collect fee from pool, unclaimed USDi rewards do not accrue interest", async () => {

    })

    it("remove all liquidity from pool and receive USDi + interest ", async () => {



    })

    it("confirm liquidity is now 0", async () => {

    })

    it("any way to redeem the interest on USDi that is still in the pool?", async () => {

    })

})