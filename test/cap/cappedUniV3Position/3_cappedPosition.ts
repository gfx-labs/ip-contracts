import { s, MintParams } from "./scope";
import { showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { hardhat_mine_timed, mineBlock } from "../../../util/block";
import { BigNumber } from "ethers";
import { getArgs, getGas } from "../../../util/math";
import { currentBlock } from "../../../util/block";
import { ethers } from "hardhat";

import { expect } from "chai";
import { toNumber } from "../../../util/math";
import {
    VaultNft__factory,
    UniSwap__factory
} from "../../../typechain-types";
import { nearestUsableTick } from "@uniswap/v3-sdk";
require("chai").should();


describe("Verify setup", () => {
    it("Mint NFT vault for Bob", async () => {

        let _vaultId_votingVaultAddress = await s.NftVaultController._vaultId_nftVaultAddress(s.BobVaultID)
        expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

        const result = await s.NftVaultController.connect(s.Bob).mintVault(s.BobVaultID)
        const gas = await getGas(result)
        showBodyCyan("Gas to mint NFT vault: ", gas)

        let vaultAddr = await s.NftVaultController._vaultId_nftVaultAddress(s.BobVaultID)
        s.BobNftVault = VaultNft__factory.connect(vaultAddr, s.Bob)

        expect(s.BobNftVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Bob's nft vault setup complete")

    })
    it("Mint NFT vault for Carol", async () => {

        let _vaultId_votingVaultAddress = await s.NftVaultController._vaultId_nftVaultAddress(s.CaroLVaultID)
        expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

        const result = await s.NftVaultController.connect(s.Carol).mintVault(s.CaroLVaultID)
        const gas = await getGas(result)
        showBodyCyan("Gas to mint NFT vault: ", gas)

        let vaultAddr = await s.NftVaultController._vaultId_nftVaultAddress(s.CaroLVaultID)
        s.CarolNftVault = VaultNft__factory.connect(vaultAddr, s.Carol)

        expect(s.CarolNftVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Carol's nft vault setup complete")

    })

    it("Bob's Voting Vault setup correctly", async () => {
        /**
              const vaultInfo = await s.BobBptVault._vaultInfo()
        const parentVault = await s.BobBptVault.parentVault()

        expect(parentVault.toUpperCase()).to.eq(vaultInfo.vault_address.toUpperCase(), "Parent Vault matches vault info")

        expect(vaultInfo.id).to.eq(s.BobVaultID, "Voting Vault ID is correct")
        expect(vaultInfo.vault_address).to.eq(s.BobVault.address, "Vault address is correct")
         */
    })
    it("Carol's Voting Vault setup correctly", async () => {
        /**
           const vaultInfo = await s.CarolBptVault._vaultInfo()
  
          expect(vaultInfo.id).to.eq(s.CaroLVaultID, "Voting Vault ID is correct")
          expect(vaultInfo.vault_address).to.eq(s.CarolVault.address, "Vault address is correct")
         */
    })
})

describe("Capped Position Functionality", () => {

    it("Bob deposits position", async () => {
        await s.nfpManager.connect(s.Bob).approve(s.CappedPosition.address, s.BobPositionId)
        const result = await s.CappedPosition.connect(s.Bob).deposit(s.BobPositionId, s.BobVaultID)
        const gas = await getGas(result)
        showBodyCyan("Gas to deposit a position: ", gas)

        //check destinations
        // nft to vault NFT
        let balance = await s.nfpManager.balanceOf(s.BobNftVault.address)
        expect(balance).to.eq(1, "1 uni v3 position minted")

        // Calling balanceOf on standard vault returns position value
        balance = await s.CappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.be.gt(0, "BalanceOf on og vault returns value")
    })

    it("Withdraw position", async () => {


        const result = await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedPosition.address, 1)
        const gas = await getGas(result)
        showBodyCyan("Gas to withdraw position: ", gas)

        //check destinations
        // nft from vault NFT
        let balance = await s.nfpManager.balanceOf(s.Bob.address)
        expect(balance).to.eq(1, "1 uni v3 position returned to Bob")

        // Calling balanceOf on standard vault returns position value
        balance = await s.CappedPosition.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "BalanceOf is now 0")


    })

    it("Deposit position again for future tests", async () => {
        await s.nfpManager.connect(s.Bob).approve(s.CappedPosition.address, s.BobPositionId)
        const result = await s.CappedPosition.connect(s.Bob).deposit(s.BobPositionId, s.BobVaultID)

        //check destinations
        // nft to vault NFT
        let balance = await s.nfpManager.balanceOf(s.BobNftVault.address)
        expect(balance).to.eq(1, "1 uni v3 position minted")

        // Calling balanceOf on standard vault returns position value
        balance = await s.CappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.be.gt(0, "BalanceOf on og vault returns value")
    })

    it("Carol deposits the registered position", async () => {
        await s.nfpManager.connect(s.Carol).approve(s.CappedPosition.address, s.CarolPositionId)
        const result = await s.CappedPosition.connect(s.Carol).deposit(s.CarolPositionId, s.CaroLVaultID)
        const gas = await getGas(result)
        showBodyCyan("Gas to deposit a position: ", gas)

        //check destinations
        // nft to vault NFT
        let balance = await s.nfpManager.balanceOf(s.CarolNftVault.address)
        expect(balance).to.eq(1, "1 uni v3 position minted")

        // Calling balanceOf on standard vault returns position value
        balance = await s.CappedPosition.balanceOf(s.CarolVault.address)
        expect(await toNumber(balance)).to.be.gt(0, "BalanceOf on og vault returns value")
    })

    it("Try to deposit unregistered position", async () => {

        await s.nfpManager.connect(s.Carol).approve(s.CappedPosition.address, s.CarolIllegalPositionId)
        expect(s.CappedPosition.connect(s.Carol).deposit(s.CarolIllegalPositionId, s.CaroLVaultID)).to.be.revertedWith("Pool not registered")

    })


    //todo
    it("Check collection of income", async () => {

        //check amounts owed
        let data = await s.nfpManager.positions(s.BobPositionId)
        expect(data.tokensOwed0).to.eq(0, "No tokens0 owed yet")
        expect(data.tokensOwed1).to.eq(0, "No tokens1 owed yet")

        //do a swap
        //get start balance

        const uniSwap = await new UniSwap__factory(s.Frank).deploy()

        const amountIn = BN("1e7")

        //await s.WBTC.connect(s.Carol).approve(uniSwap.address, amountIn)
        //await hardhat_mine(1)
        //await uniSwap.connect(s.Carol).doSwap(s.POOL_ADDR, true, amountIn)



        /**
        for (let i = 0; i < 12; i++) {
            await doSwap()
            await hardhat_mine_timed(15, 15)
            await doInverseSwap()
            await hardhat_mine_timed(15, 15)
        }
         */


        //const endBalWBTC = await s.WBTC.balanceOf(s.Carol.address)
        //const endBalWETH = await s.WETH.balanceOf(s.Carol.address)

        //expect((startBalWBTC)).to.be.gt((endBalWBTC), "wBTC balance decreased")
        //expect(await toNumber(startBalWETH)).to.be.lt(await toNumber(endBalWETH), "wETH balance increased")

        //check tokens owed
        //data = await s.nfpManager.positions(s.BobPositionId)
        //console.log(data)
        //expect(await toNumber(data.tokensOwed0)).to.be.gt(0, "tokens0 owed increased")
        //expect(await toNumber(data.tokensOwed1)).to.be.gt(0, "tokens1 owed increased")

        const startBalWBTC = await s.WBTC.balanceOf(s.Carol.address)
        const startBalWETH = await s.WETH.balanceOf(s.Carol.address)


        await s.BobNftVault.connect(s.Bob).collect(s.BobPositionId, s.Bob.address)

        const endBalWBTC = await s.WBTC.balanceOf(s.Carol.address)
        const endBalWETH = await s.WETH.balanceOf(s.Carol.address)

        //showBody("WBTC: ", startBalWBTC, endBalWBTC)
        //showBody("WETH: ", await toNumber(startBalWETH), await toNumber(endBalWETH))

        //add these amounts to collateral value while not collected? 
    })

    const doSwap = async () => {
        const v3RouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
        const ROUTER_ABI = require("../../isolated/uniV3Pool/util/ISwapRouter.json")
        const router = new ethers.Contract(v3RouterAddress, ROUTER_ABI, ethers.provider)
        const swapInputAmount = BN("1e7")

        //approve router for 100 USDi
        await s.WBTC.connect(s.Carol).approve(router.address, swapInputAmount)
        await mineBlock()

        const block = await currentBlock()
        const deadline = block.timestamp + 500

        const swapParams = [
            s.WBTC.address.toString(), //tokenIn
            s.WETH.address.toString(), //tokenOut
            await s.POOL.fee(), //fee
            s.Carol.address.toString(), //recipient
            deadline.toString(),
            swapInputAmount.toString(), //amountIn
            "0", //amountOutMinimum
            "0", //sqrtPriceLimitX96
        ]
        //do the swap router
        await router.connect(s.Carol).exactInputSingle(swapParams)

    }

    const doInverseSwap = async () => {
        const v3RouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
        const ROUTER_ABI = require("../../isolated/uniV3Pool/util/ISwapRouter.json")
        const router = new ethers.Contract(v3RouterAddress, ROUTER_ABI, ethers.provider)
        const swapInputAmount = BN("1622415600000000000")

        //approve router for 100 USDi
        await s.WETH.connect(s.Carol).approve(router.address, swapInputAmount)
        await mineBlock()

        const block = await currentBlock()
        const deadline = block.timestamp + 500

        const swapParams = [
            s.WETH.address.toString(), //tokenIn
            s.WBTC.address.toString(), //tokenOut
            await s.POOL.fee(), //fee
            s.Carol.address.toString(), //recipient
            deadline.toString(),
            swapInputAmount.toString(), //amountIn
            "0", //amountOutMinimum
            "0", //sqrtPriceLimitX96
        ]
        //do the swap router
        await router.connect(s.Carol).exactInputSingle(swapParams)
    }

})

describe("Check valuations", async () => {
    it("Check weth/wbtc pool valuation", async () => {
        //derive value based on price
        let p0: BigNumber = (await s.wbtcOracle.currentValue()).div(BN("1e10"))
        let p1: BigNumber = await s.wethOracle.currentValue()

        let v0: BigNumber = (p0.mul(BN(s.BobAmount0))).div(BN("1e8"))//decimal 8 because wbtc
        let v1: BigNumber = (p1.mul(BN(s.BobAmount1))).div(BN("1e18"))
        const targetAmount = v1.add(v0)
        const actual = await s.CappedPosition.balanceOf(s.BobVault.address)
  
        expect(await toNumber(targetAmount)).to.be.closeTo(await toNumber(actual), 1, "Value is correct")

    })

    it("Bob deposits a second position", async () => {
        const startingValue = await s.CappedPosition.balanceOf(s.BobVault.address)

        //mint second position
        //approvals
        await s.WBTC.connect(s.Bob).approve(s.nfpManager.address, s.wBTC_Amount)
        await s.WETH.connect(s.Bob).approve(s.nfpManager.address, s.WETH_AMOUNT)

        const [fee, tickSpacing, slot0] =
            await Promise.all([
                s.POOL.fee(),
                s.POOL.tickSpacing(),
                s.POOL.slot0(),
            ])
        const nut = nearestUsableTick(slot0[1], tickSpacing)
        const tickLower = nut - (tickSpacing * 2)
        const tickUpper = nut + (tickSpacing * 2)

        const block = await currentBlock()

        const params: MintParams = {
            token0: s.WBTC.address,
            token1: s.WETH.address,
            fee: fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: s.wBTC_Amount,
            amount1Desired: s.WETH_AMOUNT,
            amount0Min: BN("0"),
            amount1Min: BN("0"),
            recipient: s.Bob.address,
            deadline: block.timestamp + 500
        }
        const result = await s.nfpManager.connect(s.Bob).mint(params)
        await hardhat_mine_timed(500, 15)
        const args = await getArgs(result)

        const positionId = args.tokenId
        const amount0 = args.amount0
        const amount1 = args.amount1

        //deposit
        await s.nfpManager.connect(s.Bob).approve(s.CappedPosition.address, positionId)
        const deposit = await s.CappedPosition.connect(s.Bob).deposit(positionId, s.BobVaultID)

        //check value
        let p0: BigNumber = (await s.wbtcOracle.currentValue()).div(BN("1e10"))
        let p1: BigNumber = await s.wethOracle.currentValue()

        let v0: BigNumber = (p0.mul(BN(amount0))).div(BN("1e8"))//decimal 8 because wbtc
        let v1: BigNumber = (p1.mul(BN(amount1))).div(BN("1e18"))
        const targetAmount = v1.add(v0)
  
        const endingValue = await s.CappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(endingValue)).to.be.closeTo(await toNumber(startingValue.add(targetAmount)), 0.5, "Value increased as expected")

    })

    it("Check weth/wbtc pool valuation - Carol", async () => {
        //derive value based on price
        let p0: BigNumber = (await s.wbtcOracle.currentValue()).div(BN("1e10"))
        let p1: BigNumber = await s.wethOracle.currentValue()

        let v0: BigNumber = (p0.mul(BN(s.CarolAmount0))).div(BN("1e8"))//decimal 8 because wbtc
        let v1: BigNumber = (p1.mul(BN(s.CarolAmount1))).div(BN("1e18"))
        const targetAmount = v1.add(v0)
        const actual = await s.CappedPosition.balanceOf(s.CarolVault.address)
   
        expect(await toNumber(targetAmount)).to.be.closeTo(await toNumber(actual), 1, "Value is correct")

    })
})