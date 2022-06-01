import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getArgs, getGas, truncate, toNumber, getEvent } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, currentBlock, fastForward, OneYear, OneWeek } from "../../../util/block";
import { IVault__factory } from "../../../typechain-types";
import { BigNumber, utils } from "ethers";
import { token } from "../../../typechain-types";


describe("Test Uniswap pool with rebasing USDi token", () => {
    //get router for uniV2
    const IUniswapV2Router02 = require("./util/IUniswapV2Router02")
    const router02ABI = new IUniswapV2Router02()
    let ro2 = router02ABI.Router02()
    const router02 = ro2[0].abi
    const Router02Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"

    const routerV2 = new ethers.Contract(Router02Address, router02, ethers.provider)

    //get factory for uniV2
    const IUniswapV2Factory = require("./util/IUniswapV2Factory")
    const factory02ABI = new IUniswapV2Factory()
    let fa2 = factory02ABI.Factory02()
    const factory02 = fa2[0].abi
    const Factory02Address = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"

    const factoryV2 = new ethers.Contract(Factory02Address, factory02, ethers.provider)

    let pairV2: any

    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    //1 quarter of Dave's USDC
    const usdcDepositAmount = s.Dave_USDC.div(4)

    let usdiAmount: BigNumber

    //1 half of Bob's wETH
    const collateralAmount = s.Bob_WETH.div(2)
    const amount = utils.parseEther("500")

    let borrowAmount: BigNumber

    let startingUSDIreserve: BigNumber

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

    it("Use borrowed USDi to make a uni v2 pool", async () => {
        const wETHamount = await s.WETH.balanceOf(s.Bob.address)
        expect(await toNumber(wETHamount)).to.eq(await toNumber(s.Bob_WETH.div(2)))

        usdiAmount = await s.USDI.balanceOf(s.Bob.address)
        const block = await currentBlock()
        const deadline = block.timestamp + 500

        //approvals
        await s.USDI.connect(s.Bob).approve(routerV2.address, usdiAmount)
        await s.WETH.connect(s.Bob).approve(routerV2.address, wETHamount)
        await mineBlock()

        const poolResult = await routerV2.connect(s.Bob).addLiquidity(
            s.USDI.address,
            s.WETH.address,
            usdiAmount,
            wETHamount,
            usdiAmount.div(2),
            wETHamount.div(2),
            s.Bob.address,
            deadline
        )
        await mineBlock()

        //pair has been created
        const pair = await factoryV2.getPair(s.USDI.address, s.WETH.address)
        expect(pair).to.not.eq(undefined)

        let balance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(balance.toString(), "0", "Bob no longer has any USDI as it has been sent to the pool")

        balance = await s.WETH.balanceOf(s.Bob.address)
        assert.equal(balance.toString(), "0", "Bob no longer has any WETH as it has been sent to the pool")

    })

    it("check that the pair has been created correctly", async () => {
        const pairAddr = await factoryV2.getPair(s.USDI.address, s.WETH.address)
        //get factory for uniV2
        const IUniswapV2Pair = require("./util/IUniswapV2Pair")
        const pair02ABI = new IUniswapV2Pair()
        let pa2 = pair02ABI.Pair02()
        const pair02 = pa2[0].abi

        pairV2 = new ethers.Contract(pairAddr, pair02, ethers.provider)

        const getReserves = await pairV2.getReserves()
        expect(await toNumber(getReserves.reserve1)).to.equal(await toNumber(s.Bob_WETH.div(2)))
        expect(await toNumber(getReserves.reserve0)).to.equal(await toNumber(usdiAmount))

        //USDI token0 is correct
        const token0 = await pairV2.token0()
        expect(token0.toString().toUpperCase()).to.equal(s.USDI.address.toString().toUpperCase())

        //wETH token1 is correct
        const token1 = await pairV2.token1()
        expect(token1.toString().toUpperCase()).to.equal(s.WETH.address.toString().toUpperCase())

    })


    it("check what happens when USDi rebases while in the pool", async () => {
        const liab = await s.VaultController.totalBaseLiability()
        expect(await toNumber(liab)).to.be.gt(0)//there is liability on the protocol, so interest will accrue 

        let getReserves = await pairV2.getReserves()
        startingUSDIreserve = getReserves.reserve0
        const expectedWETH = getReserves.reserve1
        expect(await toNumber(expectedWETH)).to.equal(await toNumber(s.Bob_WETH.div(2)))
        const lptokens = await pairV2.balanceOf(s.Bob.address)
        //pass time
        await fastForward(OneYear)
        await mineBlock()
        await s.VaultController.calculateInterest()
        await mineBlock()

        getReserves = await pairV2.getReserves()

        assert.equal(startingUSDIreserve.toString(), getReserves.reserve0.toString(), "Reserve on pair has not changed")
        let balance = await s.USDI.balanceOf(pairV2.address)

        //actual USDI on pair contract is higher due to interest
        expect(await toNumber(balance)).to.be.gt(await toNumber(startingUSDIreserve))

        //no new lp tokens
        let currentLPTs = await pairV2.balanceOf(s.Bob.address)
        expect(await toNumber(currentLPTs)).to.eq(await toNumber(lptokens))

    })

    it("do a small swap", async () => {
        const startBalance = await s.USDI.balanceOf(s.Dave.address)
        
        expect(await toNumber(startBalance)).to.be.gt(await toNumber(amount))

        const startWETH = await s.WETH.balanceOf(s.Dave.address)

        //approve
        await s.USDI.connect(s.Dave).approve(routerV2.address, amount)
        await mineBlock()

        const block = await currentBlock()
        const deadline = block.timestamp + 500

        //swap exact tokens for tokens
        await routerV2.connect(s.Dave).swapExactTokensForTokens(
            amount,
            500,
            [s.USDI.address, s.WETH.address],
            s.Dave.address,
            deadline
        )
        await mineBlock()

        //Dave spent exactly 500 USDi
        let balance = await s.USDI.balanceOf(s.Dave.address)
        const difference = startBalance.sub(balance)
        expect(await toNumber(difference)).to.eq(await toNumber(amount))

        //Dave received wETH
        balance = await s.WETH.balanceOf(s.Dave.address)
        expect(await toNumber(balance)).to.be.gt(0)

    })

    it("Check state of pool", async () => {
        const liab = await s.VaultController.totalBaseLiability()
        expect(await toNumber(liab)).to.be.gt(0)//there is liability on the protocol, so interest will accrue 

        let getReserves = await pairV2.getReserves()
        let currentUSDIreserve = getReserves.reserve0

        //pool reports a reserve that includes interest generation, so it is higher than the original amount supplied + the amount swaped 
        expect(await toNumber(currentUSDIreserve)).to.be.gt(await toNumber(startingUSDIreserve.add(amount)))

        let trueBalance = await s.USDI.balanceOf(pairV2.address)

        //pool reports the accurate number of USDi after a swap has taken place 
        expect(await toNumber(trueBalance)).to.eq(await toNumber(currentUSDIreserve))

    })

    it("remove all liquidity from pool and receive USDi + interest ", async () => {
        const lptokens = await pairV2.balanceOf(s.Bob.address)

        const pairWETH = await s.WETH.balanceOf(pairV2.address)
        const pairUSDi = await s.USDI.balanceOf(pairV2.address)

        //aprove
        await pairV2.connect(s.Bob).approve(routerV2.address, lptokens)
        await mineBlock()

        const block = await currentBlock()
        const deadline = block.timestamp + 500

        //removeLiquidity
        const removeResult = await routerV2.connect(s.Bob).removeLiquidity(
            s.USDI.address,
            s.WETH.address,
            lptokens,
            5000,
            5000,
            s.Bob.address,
            deadline
        )
        await mineBlock()

        //pair USDi is very close to 0
        let balance = await s.USDI.balanceOf(pairV2.address)
        expect(await toNumber(balance)).to.be.closeTo(0, 100000)

        //bob received USDi + interest
        balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.gt(await toNumber(usdiAmount))
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(pairUSDi), 100000)

        //pair wETH is very close to 0
        balance = await s.WETH.balanceOf(pairV2.address)
        expect(await toNumber(balance)).to.be.closeTo(0, 100000)

        //bob received virtually all wETH back
        balance = await s.WETH.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(pairWETH), 0.0000000000001)//todo

    })

})