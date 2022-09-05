import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear, OneDay } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { upgrades, ethers } from "hardhat";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { start } from "repl";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
//import { providers } from "web3";
require("chai").should();
describe("Testing CappedToken functions", () => {

    it("Deposit underlying", async () => {
        let balance = await s.CappedPAXG.balanceOf(s.Bob.address)
        expect(balance).to.eq(0, "Bob holds no capped paxg before deposit")

        await s.PAXG.connect(s.Bob).approve(s.CappedPAXG.address, s.PAXG_AMOUNT)
        await mineBlock()

        const result = await s.CappedPAXG.connect(s.Bob).deposit(s.PAXG_AMOUNT, s.BobVaultID)
        await mineBlock()
        showBodyCyan("Gas to deposit cap token: ", await getGas(result))


    })

    it("Check token destinations", async () => {

        let balance = await s.PAXG.balanceOf(s.BobVotingVault.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.PAXG_AMOUNT), 0.003, "Voting vault holds the underlying")

        balance = await s.CappedPAXG.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(s.PAXG_AMOUNT), 0.003, "Regular vault holds the wrapped cap token")

    })

    it("Try to transfer", async () => {
        expect(s.CappedPAXG.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
    })

    it("Borrow maximum against paxg", async () => {
        const borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

        const result = await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowPower.sub(500))
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(borrowPower), 0.001, "Borrow amount correct")

    })

    it("Advance time to put vault underwater", async () => {

        let solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(true, "Bob's vault is solvent")

        await fastForward(OneWeek * 6)
        await s.VaultController.calculateInterest()
        await mineBlock()

        solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is insolvent")
    })


    it("Liquidate", async () => {
        //fund dave for liquidation
        await s.USDC.connect(s.Dave).approve(s.USDI.address, BN("10000e6"))
        await s.USDI.connect(s.Dave).deposit(BN("10000e6"))
        await mineBlock()

        const startingPAXG = await s.PAXG.balanceOf(s.Dave.address)
        expect(await toNumber(startingPAXG)).to.be.closeTo(await toNumber(s.PAXG_AMOUNT.add(BN("5e17"))), 0.003, "Dave has starting paxg amount minus fee on transfer")

        let solvency = await s.VaultController.checkVault(s.BobVaultID)
        expect(solvency).to.eq(false, "Bob's vault is insolvent")

        let amountToSolvency = await s.VaultController.amountToSolvency(s.BobVaultID)
        expect(amountToSolvency).to.be.gt(0, "Amount to solvency")

        const tokensToLiq = await s.VaultController.tokensToLiquidate(s.BobVaultID, s.CappedPAXG.address)
        expect(tokensToLiq).to.be.gt(0, "Tokens to liquidate")

        let balance = await s.USDI.balanceOf(s.Dave.address)
        expect(await toNumber(balance)).to.be.gt(((await toNumber(tokensToLiq)) * 1700), "Dave has enough funds to liquidate")

        balance = await ethers.provider.getBalance(s.Dave.address)
         
        await s.USDI.connect(s.Dave).approve(s.VaultController.address, await s.USDI.balanceOf(s.Dave.address))
        await mineBlock()

        const result = await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, s.CappedPAXG.address, 1)
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to liquidate a capped token and receive underlying: ", gas)

        balance = await s.PAXG.balanceOf(s.Dave.address)
        expect(balance).to.be.gt(startingPAXG, "Dave received PAXG for liquidating CappedPAXG")

    })

    it("Check end state", async () => {

        let remianingPAXG = await s.PAXG.balanceOf(s.BobVotingVault.address)
        let remainingCapped = await s.CappedPAXG.balanceOf(s.BobVault.address)

        expect(await toNumber(remianingPAXG)).to.be.closeTo(await toNumber(remainingCapped), 0.002, "Accounting is correct")
    })
    it("Repay all", async () => {

        //Fund Bob to repayAll
        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).depositTo(BN("500e6"), s.Bob.address)
        await mineBlock()

        await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await mineBlock()

        let liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Vault completely repaid")

    })


    it("Withdraw underlying", async () => {

        const startPAXG = await s.PAXG.balanceOf(s.Bob.address)
        const startSupply = await s.CappedPAXG.totalSupply()
        expect(startSupply).to.be.gt(0, "Some amount in use")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedPAXG.address, await s.CappedPAXG.balanceOf(s.BobVault.address))
        await mineBlock()

        let Supply = await s.CappedPAXG.totalSupply()
        expect(Supply).to.eq(0, "All Capped PAXG burned")

        let balance = await s.PAXG.balanceOf(s.CappedPAXG.address)
        expect(balance).to.eq(0, "All PAXG have been withdrawn from the cap contract")

        balance = await s.PAXG.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startSupply.add(startPAXG)), 0.0021, "Bob received the correct amount of PAXG")
    })
})

describe("Hitting the cap", () => {
    const lowCap = BN("5e18")
    const lowerCap = BN("2e18")
    it("Admin sets a low cap", async () => {

        await s.CappedPAXG.connect(s.Frank).setCap(lowCap)
        await mineBlock()

        expect(await s.CappedPAXG.getCap()).to.eq(lowCap, "Cap has been set correctly")

    })

    it("Deposit exactly up to cap", async () => {

        await s.PAXG.connect(s.Bob).approve(s.CappedPAXG.address, lowCap)
        await mineBlock()

        const result = await s.CappedPAXG.connect(s.Bob).deposit(lowCap, s.BobVaultID)
        await mineBlock()

        let supply = await s.CappedPAXG.totalSupply()
        expect(await toNumber(supply)).to.be.closeTo(await toNumber(lowCap), 0.0021, "Cap has been reached minus fee-on-transfer")

    })

    it("Try to deposit more than cap", async () => {
        await s.PAXG.connect(s.Bob).approve(s.CappedPAXG.address, lowCap)
        await mineBlock()

        expect(s.CappedPAXG.connect(s.Bob).deposit(lowCap, s.BobVaultID)).to.be.revertedWith("cap reached")
    })

    it("Admin reduces cap to below current supply", async () => {

        const startBorrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(startBorrowPower).to.be.gt(0, "Borrow power exists")

        await s.CappedPAXG.connect(s.Frank).setCap(lowerCap)
        await mineBlock()

        expect(await s.CappedPAXG.getCap()).to.eq(lowerCap, "Cap has been set correctly")
        expect(lowerCap).to.be.lt(await s.CappedPAXG.totalSupply(), "Cap is lower than supply")

        let bp = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        expect(bp).to.eq(startBorrowPower, "Borrow power did not change when cap was lowered")

    })

    it("Reduced cap does not prevent withdraw", async () => {
        const startPAXG = await s.PAXG.balanceOf(s.Bob.address)
        const startSupply = await s.CappedPAXG.totalSupply()
        expect(startSupply).to.be.gt(0, "Some amount in use")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedPAXG.address, await s.CappedPAXG.balanceOf(s.BobVault.address))
        await mineBlock()

        let Supply = await s.CappedPAXG.totalSupply()
        expect(Supply).to.eq(0, "All Capped PAXG burned")

        let balance = await s.PAXG.balanceOf(s.CappedPAXG.address)
        expect(balance).to.eq(0, "All PAXG have been withdrawn from the cap contract")

        balance = await s.PAXG.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.closeTo(await toNumber(startSupply.add(startPAXG)), 0.0021, "Bob received the correct amount of PAXG")
    })

})

describe("More oracle tests", async () => {

    const megaWhale = "0x28c6c06298d514db089934071355e5743bf21d60"
    const whale = ethers.provider.getSigner(megaWhale)

    const Router02Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    const IUniswapV2Router02 = require("../../isolated/uniPool/util/IUniswapV2Router02")
    const router02ABI = new IUniswapV2Router02()
    let ro2 = router02ABI.Router02()
    const router02 = ro2[0].abi
    const routerV2 = new ethers.Contract(Router02Address, router02, ethers.provider)

    const largePaxgAmount = BN("2000e18")
    let whaleStartingPAXG: BigNumber
    let wethReceived: BigNumber

    let tx = {
        to: whale._address,
        value: BN("1e18")
    }


    it("Setup", async () => {

        await s.Frank.sendTransaction(tx)
        await mineBlock()
       
         whaleStartingPAXG = await s.PAXG.balanceOf(megaWhale)
        expect(whaleStartingPAXG).to.be.gt(largePaxgAmount, "Enough PAXG")

    })

    /**
       * In order to simulate what it might look like when we need to call update() on the relay, 
       * we need the reported prices between the UniV3Relay and Chainlink price feed to deviate.
       * We will achieve this by way of a giant swap
       */
    it("Do large swap on uni v2 to simulate a the main price deviating from the anchor", async () => {

        const wethBalance = await s.WETH.balanceOf(whale._address)

        await impersonateAccount(whale._address)

        //approve
        await s.PAXG.connect(whale).approve(routerV2.address, largePaxgAmount)
        await mineBlock()

        const block = await currentBlock()
        const deadline = block.timestamp + 500

        //swap exact tokens for tokens
        await routerV2.connect(whale).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            largePaxgAmount,
            largePaxgAmount.div(2),//amountOutMin - PAXG is worth slightly less than ETH
            [s.PAXG.address, s.WETH.address],
            whale._address,
            deadline
        )
        await mineBlock()
        await ceaseImpersonation(whale._address)


        wethReceived = await s.WETH.balanceOf(whale._address)
        expect(wethReceived.sub(wethBalance)).to.be.gt(largePaxgAmount.div(2), "Received weth from swap")
        //showBody("WETH received: ", await toNumber(wethReceived.sub(wethBalance)))

        const startPrice = await s.UniV2Relay.currentValue()

        await mineBlock()
        await fastForward(OneDay * 14)
        await mineBlock()
        await s.UniV2Relay.update()
        await mineBlock()

        let newEthPrice = await s.UniV2Relay.currentValue()

        const percentMoved = (1 - (await toNumber(newEthPrice) / await toNumber(startPrice))) * 100
        expect(percentMoved).to.be.gt(10, "Out of bounds relative to main price")

        //try to get oraclePrice
        expect(s.Oracle.getLivePrice(s.CappedPAXG.address)).to.be.revertedWith("anchor too low")

    })


    /**
      * As of this point, we have simulated what it might look like if the chainlink feed price rises faster than the uniswap v2 pool
      * The currentValue() reported from the UniV2Relay should be less than the main price reported by chainlink by at least 10% 
      */
    it("Return to equilibrium", async () => {

        await impersonateAccount(whale._address)

        //approve
        await s.WETH.connect(whale).approve(routerV2.address, wethReceived)
        await mineBlock()

        const block = await currentBlock()
        const deadline = block.timestamp + 500

        //swap exact tokens for tokens
        await routerV2.connect(whale).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            wethReceived,
            wethReceived.div(2),//amountOutMin - PAXG is worth slightly less than ETH
            [s.WETH.address, s.PAXG.address],
            whale._address,
            deadline
        )
        await mineBlock()
        await ceaseImpersonation(whale._address)

        await mineBlock()
        await fastForward(OneDay * 14)
        await mineBlock()

    })

    /**
     * As of this point, the effective price of the pool should be within bounds of the main relay (chainlink)
     * In our simulation, think of this as the Uniswap v2 pool price catching up with the chainlink price
     * However, update() has not been called, so the reported price is still too low
     * 
     * UPDATING PRICE RESTORES
     */
    it("Updating price restores oracle functionality", async () => {
        //try to get oraclePrice - error because we have not updated the price yet
        expect(s.Oracle.getLivePrice(s.CappedPAXG.address)).to.be.revertedWith("anchor too low")

        const startPrice = await s.UniV2Relay.currentValue()

        await s.UniV2Relay.update()
        await mineBlock()

        const newEthPrice = await s.UniV2Relay.currentValue()

        expect(newEthPrice).to.be.gt(startPrice, "Price moved up after calling update()")

        const oraclePrice = await s.Oracle.getLivePrice(s.CappedPAXG.address)
        expect(oraclePrice).to.be.gt(0, "Valid oracle price returned, update restored functionality")

    })
})





