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

    //0x19fdfff24c5dda5d2fcb032bda8cc4482270a8d17452a7478be427b595fe5408
    const wETHamount = utils.parseEther("5")
    const usdiAmount = BN("9745435642333408348323")

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


    /**
     * try to make the exact WETH/USDI pool on v3 and steal the args from tenderly? 
     * use the exact same amount of USDi vs wETH that I can get on polygon, and match the TX 1:1
     * 
     * wallet: 0x2243b90CCaF4a03F7289502722D8665E3d4f2972
     * USDC: 0xbEed11d5c8c87FaCbf3f81728543eb8cB6CBa939
     * USDi: 0x203c05ACb6FC02F5fA31bd7bE371E7B213e59Ff7
     * wETH: 0x8afBfe06dA3D035c82C5bc55C82EB3FF05506a20
     * 
     * POOL PARAMS USDi - wETH - wETH price 1750 USDi - 0.0005714 wETH per USDI
     * 1% fee tier 
     * Min price: 1509.7 - 0.00050065 wETH per USDI
     * max price: 1997.4 - 0.0006624 wETH per USDI
     * 
     * DEPOSIT AMOUNTS
     * wETH: 5 - 4.999
     * USDI: 9,745.435642333408348323
     * 
     * Approve USDI TX: 0x9774719f616dae952e35b9a31efa69ad2eb29ab89f7d345002860022ebcee739
     * https://polygonscan.com/tx/0x9774719f616dae952e35b9a31efa69ad2eb29ab89f7d345002860022ebcee739
     * 
     * TX ID: 0x19fdfff24c5dda5d2fcb032bda8cc4482270a8d17452a7478be427b595fe5408
     * https://polygonscan.com/tx/0x19fdfff24c5dda5d2fcb032bda8cc4482270a8d17452a7478be427b595fe5408
     * 
     * Pool Address: 0x12370F952775cd268aeaBbc36671342245C32965
     * 
     * 
     * Tenderly data of note: 
     * deploy() in createPool() - tickSpacing: 200
     * 
     * Initialize: sqrtPricex96: 1893862710253677737936450510
     * 
     * Mint Params: 
     * "token0":"0x203c05acb6fc02f5fa31bd7be371e7b213e59ff7"
        "token1":"0x8afbfe06da3d035c82c5bc55c82eb3ff05506a20"
        "fee":"10000"
        "tickLower":"-76000"
        "tickUpper":"-73200"
        "amount0Desired":"9745435642333408348323"
        "amount1Desired":"5000000000000000000"
        "amount0Min":"9404681434654713997304"
        "amount1Min":"4804319378770569775"
        "recipient":"0x2243b90ccaf4a03f7289502722d8665e3d4f2972"
        "deadline":"1654278867"
     * 
        Output: 
        "tokenId":"127253"
        "liquidity":"3270355854394780560229"
        "amount0":"9745435642333408348323"
        "amount1":"5000000000000000000"

     */

    it("Use borrowed USDi to make a uni v3 pool", async () => {



        const startWETH = await s.WETH.balanceOf(s.Bob.address)
        showBodyCyan("START WETH: ", await toNumber(startWETH))
        expect(await toNumber(startWETH)).to.eq(await toNumber(s.Bob_WETH.div(2)))
        const startUSDI = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(startUSDI)).to.be.gt(await toNumber(usdiAmount))


        const block = await currentBlock()
        const deadline = block.timestamp + 500


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

        const sqrtPriceX96 = utils.parseEther("45")//eth price ~2k -> sqrt = ~45

        await poolV3.connect(s.Bob).initialize(sqrtPriceX96)
        await mineBlock()

        //approvals
        await s.USDI.connect(s.Bob).approve(nfpManagerAddress, usdiAmount)
        await mineBlock()
        await s.WETH.connect(s.Bob).approve(nfpManagerAddress, startWETH)
        await mineBlock()

        showBody("wETH amount: ", await toNumber(wETHamount))
        showBody("USDI amount: ", await toNumber(usdiAmount))


        let mintParams = [
            s.USDI.address,
            s.WETH.address,
            "10000", //Fee
            "-76000", //tickLower
            "-73200", //tickUpper
            usdiAmount,
            BN("4999999999999999999"),
            0,//usdiAmount.sub(utils.parseEther("5000")),
            0,//wETHamount.sub(utils.parseEther("2")),
            s.Bob.address,
            deadline
        ]


        /**
        * pool.mint params
        * liquidity: BN("3270355854394780560229")
        * data: "0x000000000000000000000000203c05acb6fc02f5fa31bd7be371e7b213e59ff70000000000000000000000008afbfe06da3d035c82c5bc55c82eb3ff05506a2000000000000000000000000000000000000000000000000000000000000027100000000000000000000000002243b90ccaf4a03f7289502722d8665e3d4f2972"
        */

        await poolV3.connect(s.Bob).mint(
            s.Bob.address,
            "-76000", //tickLower
            "-73200", //tickUpper
            BN("3270355854394780560229"),
            "0x000000000000000000000000203c05acb6fc02f5fa31bd7be371e7b213e59ff70000000000000000000000008afbfe06da3d035c82c5bc55c82eb3ff05506a2000000000000000000000000000000000000000000000000000000000000027100000000000000000000000002243b90ccaf4a03f7289502722d8665e3d4f2972"
        )
        await mineBlock()








        //const mintResult = await NFPM.connect(s.Bob).mint(mintParams)
        //await mineBlock()
        //const mintReceipt = await mintResult.wait()
        //showBody(mintReceipt)
        //const args = await getArgs(mintResult)
        //showBody(args)

        let balance = await s.USDI.balanceOf(s.Bob.address)
        let difference = startUSDI.sub(balance)
        expect(await toNumber(difference)).to.be.closeTo(await toNumber(usdiAmount), 0.001)

        balance = await s.WETH.balanceOf(s.Bob.address)
        showBody("Current wETH: ", await toNumber(balance))
        showBody("start wETH: ", await toNumber(startWETH))

        //expect(await toNumber(balance)).to.be.closeTo(await toNumber(wETHamount), 0.001)


        /**
         * pool.mint params
         * liquidity: BN("3270355854394780560229")
         * data: "0x000000000000000000000000203c05acb6fc02f5fa31bd7be371e7b213e59ff70000000000000000000000008afbfe06da3d035c82c5bc55c82eb3ff05506a2000000000000000000000000000000000000000000000000000000000000027100000000000000000000000002243b90ccaf4a03f7289502722d8665e3d4f2972"
         */



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