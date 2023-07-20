import { s, MintParams } from "./scope";
import { showBody, showBodyCyan } from "../../../util/format";
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
import { stealMoney } from "../../../util/money";
import { IVault__factory } from "../../../typechain-types/factories/lending/IVault.sol";
import { IVault } from "../../../typechain-types/lending/IVault.sol";
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
        await s.nfpManager.connect(s.Bob).approve(s.WrappedPosition.address, s.BobPositionId)
        const result = await s.WrappedPosition.connect(s.Bob).deposit(s.BobPositionId, s.BobVaultID)
        const gas = await getGas(result)
        showBodyCyan("Gas to deposit a position: ", gas)

        //check destinations
        // nft to vault NFT
        let balance = await s.nfpManager.balanceOf(s.BobNftVault.address)
        expect(balance).to.eq(1, "1 uni v3 position minted")

        // Calling balanceOf on standard vault returns position value
        balance = await s.WrappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.be.gt(0, "BalanceOf on og vault returns value")
    })

    it("Withdraw position", async () => {

        //this withdraws the single position via remove_from_list
        const result = await s.BobVault.connect(s.Bob).withdrawErc20(s.WrappedPosition.address, 0)
        const gas = await getGas(result)
        showBodyCyan("Gas to withdraw position: ", gas)
        /**
         * Gas to withdraw all: 512028
         * Gas to withdraw spc: 512529
         */

        //confirm list is empty
        await expect(s.WrappedPosition._underlyingOwners(s.Bob.address, BN("0"))).to.be.reverted


        //check destinations
        // nft from vault NFT
        let balance = await s.nfpManager.balanceOf(s.Bob.address)
        expect(balance).to.eq(1, "1 uni v3 position returned to Bob")

        // Calling balanceOf on standard vault returns position value
        balance = await s.WrappedPosition.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "BalanceOf is now 0")


    })

    it("Deposit position again for future tests", async () => {
        await s.nfpManager.connect(s.Bob).approve(s.WrappedPosition.address, s.BobPositionId)
        const result = await s.WrappedPosition.connect(s.Bob).deposit(s.BobPositionId, s.BobVaultID)

        //check destinations
        // nft to vault NFT
        let balance = await s.nfpManager.balanceOf(s.BobNftVault.address)
        expect(balance).to.eq(1, "1 uni v3 position minted")

        // Calling balanceOf on standard vault returns position value
        balance = await s.WrappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(balance)).to.be.gt(0, "BalanceOf on og vault returns value")
    })

    it("Carol deposits the registered position", async () => {
        await s.nfpManager.connect(s.Carol).approve(s.WrappedPosition.address, s.CarolPositionId)
        const result = await s.WrappedPosition.connect(s.Carol).deposit(s.CarolPositionId, s.CaroLVaultID)
        const gas = await getGas(result)
        showBodyCyan("Gas to deposit a position: ", gas)

        //check destinations
        // nft to vault NFT
        let balance = await s.nfpManager.balanceOf(s.CarolNftVault.address)
        expect(balance).to.eq(1, "1 uni v3 position minted")

        // Calling balanceOf on standard vault returns position value
        balance = await s.WrappedPosition.balanceOf(s.CarolVault.address)
        expect(await toNumber(balance)).to.be.gt(0, "BalanceOf on og vault returns value")
    })

    it("Try to deposit unregistered position", async () => {

        await s.nfpManager.connect(s.Carol).approve(s.WrappedPosition.address, s.CarolIllegalPositionId)
        expect(s.WrappedPosition.connect(s.Carol).deposit(s.CarolIllegalPositionId, s.CaroLVaultID)).to.be.revertedWith("Pool not registered")

    })


    //todo
    it("Check collection of income", async () => {
        //verify amounts owed are 0
        const data = await s.nfpManager.positions(s.BobPositionId)
        expect(data.tokensOwed0).to.eq(0, "No tokens0 owed yet")
        expect(data.tokensOwed1).to.eq(0, "No tokens1 owed yet")

        //get start balance
        const poolStart0 = await s.WBTC.balanceOf(s.POOL_ADDR)
        const poolStart1 = await s.WETH.balanceOf(s.POOL_ADDR)

        //do a swap
        await doBigSwap()
        await hardhat_mine_timed(15, 15)

        const poolEnd0 = await s.WBTC.balanceOf(s.POOL_ADDR)
        const poolEnd1 = await s.WETH.balanceOf(s.POOL_ADDR)
        expect(poolEnd0).not.eq(poolStart0, "pool balance has changed, swaps occured")
        expect(poolEnd1).not.eq(poolStart1, "pool balance has changed, swaps occured")

        const startBalWBTC = await s.WBTC.balanceOf(s.Bob.address)
        await s.BobNftVault.connect(s.Bob).collect(s.BobPositionId, s.Bob.address)
        const endBalWBTC = await s.WBTC.balanceOf(s.Bob.address)
        expect(endBalWBTC).to.be.gt(startBalWBTC, "Bob recieved wBTC fees")
    })

    const doBigSwap = async () => {
        const v3RouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
        const ROUTER_ABI = require("../../isolated/uniV3Pool/util/ISwapRouter.json")
        const router = new ethers.Contract(v3RouterAddress, ROUTER_ABI, ethers.provider)

        //steal a lot of money for a big swap
        const swapInputAmount = BN("50e8")
        const wbtc_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
        await stealMoney(wbtc_minter, s.Gus.address, s.WBTC.address, swapInputAmount)

        //approve router for 100 USDi
        await s.WBTC.connect(s.Gus).approve(router.address, swapInputAmount)
        await mineBlock()

        const block = await currentBlock()
        const deadline = block.timestamp + 500

        const swapParams = [
            s.WBTC.address.toString(), //tokenIn
            s.WETH.address.toString(), //tokenOut
            await s.POOL.fee(), //fee
            s.Gus.address.toString(), //recipient
            deadline.toString(),
            swapInputAmount.toString(), //amountIn
            "0", //amountOutMinimum
            "0", //sqrtPriceLimitX96
        ]
        //do the swap router
        await router.connect(s.Gus).exactInputSingle(swapParams)
    }
})

describe("Check valuations", async () => {
    let bobSecondPositionID: BigNumber

    it("Check weth/wbtc pool valuation", async () => {
        //derive value based on price
        let p0: BigNumber = (await s.wbtcOracle.currentValue()).div(BN("1e10"))
        let p1: BigNumber = await s.wethOracle.currentValue()

        let v0: BigNumber = (p0.mul(BN(s.BobAmount0))).div(BN("1e8"))//decimal 8 because wbtc
        let v1: BigNumber = (p1.mul(BN(s.BobAmount1))).div(BN("1e18"))
        const targetAmount = v1.add(v0)
        const actual = await s.WrappedPosition.balanceOf(s.BobVault.address)

        expect(await toNumber(targetAmount)).to.be.closeTo(await toNumber(actual), 1, "Value is correct")

    })

    it("Bob deposits a second position", async () => {
        const startingValue = await s.WrappedPosition.balanceOf(s.BobVault.address)

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
        //mint with different tick spacing
        const nut = nearestUsableTick(slot0[1], tickSpacing)
        const tickLower = nut - (tickSpacing)
        const tickUpper = nut + (tickSpacing)

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

        bobSecondPositionID = args.tokenId
        const amount0 = args.amount0
        const amount1 = args.amount1

        //deposit
        await s.nfpManager.connect(s.Bob).approve(s.WrappedPosition.address, bobSecondPositionID)
        const deposit = await s.WrappedPosition.connect(s.Bob).deposit(bobSecondPositionID, s.BobVaultID)

        //check value
        let p0: BigNumber = (await s.wbtcOracle.currentValue()).div(BN("1e10"))
        let p1: BigNumber = await s.wethOracle.currentValue()

        let v0: BigNumber = (p0.mul(BN(amount0))).div(BN("1e8"))//decimal 8 because wbtc
        let v1: BigNumber = (p1.mul(BN(amount1))).div(BN("1e18"))
        const targetAmount = v1.add(v0)

        const endingValue = await s.WrappedPosition.balanceOf(s.BobVault.address)
        expect(await toNumber(endingValue)).to.be.closeTo(await toNumber(startingValue.add(targetAmount)), 0.5, "Value increased as expected")

    })



    it("withdraw a single specific position", async () => {
        const position0 = await s.WrappedPosition._underlyingOwners(s.Bob.address, BN("0"))
        const position1 = await s.WrappedPosition._underlyingOwners(s.Bob.address, BN("1"))
        expect(s.WrappedPosition._underlyingOwners(s.Bob.address, BN("2"))).to.be.reverted

        const result = await s.BobVault.connect(s.Bob).withdrawErc20(s.WrappedPosition.address, 0)
        const gas = await getGas(result)
        showBodyCyan("Gas to withdraw a specific position: ", gas)//721k

        //check that the list was mutated correctly
        const newPosition0 = await s.WrappedPosition._underlyingOwners(s.Bob.address, BN("0"))
        expect(newPosition0).to.eq(position1, "Position 1 is now in index 0, as 0 was removed")

        //no position 1 anymore
        expect(s.WrappedPosition._underlyingOwners(s.Bob.address, BN("1"))).to.be.reverted

        //bob has position 0
        expect(await s.nfpManager.ownerOf(position0)).to.eq(s.Bob.address, "Bob has position idx 0")

        //deposit position again for future tests
        await s.nfpManager.connect(s.Bob).approve(s.WrappedPosition.address, position0)
        await s.WrappedPosition.connect(s.Bob).deposit(position0, s.BobVaultID)
    })


    it("withdraw when holding >1 position", async () => {
        const startPositionCount = await s.nfpManager.balanceOf(s.Bob.address)
        expect(startPositionCount).to.eq(0, "Bob starts with 0 positions")

        const result = await s.BobVault.connect(s.Bob).withdrawErc20(s.WrappedPosition.address, 9999)//amount arg is not used
        const gas = await getGas(result)
        showBodyCyan("Gas to withdraw all positions: ", gas) //~~580k
        //partial withdrawals not allowed, withdraw receives all positions held by the vault
        const endPositionCount = await s.nfpManager.balanceOf(s.Bob.address)
        expect(endPositionCount).to.eq(2, "Bob recieved both positions")

    })


    it("Deposit both positions again for future testing", async () => {
        await s.nfpManager.connect(s.Bob).approve(s.WrappedPosition.address, s.BobPositionId)
        await s.WrappedPosition.connect(s.Bob).deposit(s.BobPositionId, s.BobVaultID)

        await s.nfpManager.connect(s.Bob).approve(s.WrappedPosition.address, bobSecondPositionID)
        await s.WrappedPosition.connect(s.Bob).deposit(bobSecondPositionID, s.BobVaultID)

        const endPositionCount = await s.nfpManager.balanceOf(s.BobNftVault.address)
        expect(endPositionCount).to.eq(2, "Bob now has both positions in the vault")

    })

    it("Check weth/wbtc pool valuation - Carol", async () => {
        //derive value based on price
        let p0: BigNumber = (await s.wbtcOracle.currentValue()).div(BN("1e10"))
        let p1: BigNumber = await s.wethOracle.currentValue()

        let v0: BigNumber = (p0.mul(BN(s.CarolAmount0))).div(BN("1e8"))//decimal 8 because wbtc
        let v1: BigNumber = (p1.mul(BN(s.CarolAmount1))).div(BN("1e18"))
        const targetAmount = v1.add(v0)
        const actual = await s.WrappedPosition.balanceOf(s.CarolVault.address)

        expect(await toNumber(targetAmount)).to.be.closeTo(await toNumber(actual), 1, "Value is correct")

    })

})

describe("Single position withdraw", () => {

    const positionCount = 5
    let positions: BigNumber[] = new Array(positionCount)
    let gusVaultId: BigNumber
    let gusVault: IVault

    before(async () => {
        //mint vaults for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted
        await mineBlock()
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus)
        expect(await gusVault.minter()).to.eq(s.Gus.address)

        await s.NftVaultController.connect(s.Gus).mintVault(gusVaultId)


        //mint 3 positions for gus
        for (let i = 0; i < positionCount; i++) {
            //mint second position
            //approvals
            await s.WBTC.connect(s.Gus).approve(s.nfpManager.address, s.wBTC_Amount)
            await s.WETH.connect(s.Gus).approve(s.nfpManager.address, s.WETH_AMOUNT)

            const [fee, tickSpacing, slot0] =
                await Promise.all([
                    s.POOL.fee(),
                    s.POOL.tickSpacing(),
                    s.POOL.slot0(),
                ])
            //mint with different tick spacing
            const nut = nearestUsableTick(slot0[1], tickSpacing)
            const tickLower = nut - (tickSpacing)
            const tickUpper = nut + (tickSpacing)

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
                recipient: s.Gus.address,
                deadline: block.timestamp + 500
            }
            const result = await s.nfpManager.connect(s.Gus).mint(params)
            const args = await getArgs(result)
            positions[i] = args.tokenId

            //deposit position
            await s.nfpManager.connect(s.Gus).approve(s.WrappedPosition.address, positions[i])
            await s.WrappedPosition.connect(s.Gus).deposit(positions[i], gusVaultId)
        }

    })

    it("Verify deposits", async () => {
        for (let i = 0; i < positionCount; i++) {
            const position = await s.WrappedPosition._underlyingOwners(s.Gus.address, BN(i))
            expect(position).to.eq(positions[i], `position ${positions[i]} found`)
        }
        expect(s.WrappedPosition._underlyingOwners(s.Bob.address, BN(positionCount + 1))).to.be.reverted

    })

    it("Withdrwa position 0", async () => {
        //before withdraw positions[] in the vault should be: [0,1,2,3,4]
        await gusVault.connect(s.Gus).withdrawErc20(s.WrappedPosition.address, 0)
        //positions[] in the vault should now be: [4,1,2,3]

        //check that the list was mutated correctly
        const newPosition0 = await s.WrappedPosition._underlyingOwners(s.Gus.address, BN("0"))
        expect(newPosition0).to.eq(positions[positions.length - 1], "Final position is now in index 0, as 0 was removed")

        //Gus has position 0
        expect(await s.nfpManager.ownerOf(positions[0])).to.eq(s.Gus.address, "Gus has position idx 0")

        //deposit position again for future tests
        await s.nfpManager.connect(s.Gus).approve(s.WrappedPosition.address, positions[0])
        await s.WrappedPosition.connect(s.Gus).deposit(positions[0], gusVaultId)



    })

    it("Verify state of list", async () => {
        //positions[] in the vault should now be: [4,1,2,3,0]
        let position = await s.WrappedPosition._underlyingOwners(s.Gus.address, BN(0))
        expect(position).to.eq(positions[4], `position 0 in the vault == positions[4]`)

        position = await s.WrappedPosition._underlyingOwners(s.Gus.address, BN(positions.length - 1))
        expect(position).to.eq(positions[0], `Final position in the vault == positions[0]`)
    })

    it("Withdraw a middle index", async () => {

        //positions[] in the vault should now be: [4,1,2,3,0]
        const withdrawPositionIndex = 2

        //this should withdraw position 2
        await gusVault.connect(s.Gus).withdrawErc20(s.WrappedPosition.address, withdrawPositionIndex)
        //positions[] in the vault should now be: [4,1,0,3]

        //check that the list was mutated correctly
        const newPosition0 = await s.WrappedPosition._underlyingOwners(s.Gus.address, withdrawPositionIndex)
        expect(newPosition0).to.eq(positions[0], "correct position replaced")

        //Gus has the position
        expect(await s.nfpManager.ownerOf(positions[withdrawPositionIndex])).to.eq(s.Gus.address, "Gus has the position")

        //deposit position again for future tests
        await s.nfpManager.connect(s.Gus).approve(s.WrappedPosition.address, positions[withdrawPositionIndex])
        await s.WrappedPosition.connect(s.Gus).deposit(positions[withdrawPositionIndex], gusVaultId)
        //positions[] in the vault should now be: [4,1,0,3,2]

    })

    it("remove final index", async () => {
        //positions[] in the vault should now be: [4,1,0,3,2]

        //we should receive position 2
        await gusVault.connect(s.Gus).withdrawErc20(s.WrappedPosition.address, positions.length - 1)
        console.log("Withdraw done")

        //check that the list was mutated correctly
        const newPosition0 = await s.WrappedPosition._underlyingOwners(s.Gus.address, positions.length - 2)
        expect(newPosition0).to.eq(positions[3], "correct position is now the final one")

        //Gus has the position
        expect(await s.nfpManager.ownerOf(positions[positions.length - 1])).to.eq(s.Gus.address, "Gus has the position")

    })



})