import { s } from "./scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber, BigNumberish } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
import { currentBlock, reset, hardhat_mine } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { start } from "repl";
import {
    IVault__factory,
    VotingVault__factory,
    VotingVault,
    IVault,
    CappedGovToken__factory,
    CappedGovToken,
    VaultNft__factory
} from "../../../typechain-types"
import { JsxEmit } from "typescript";
import { stealMoney } from "../../../util/money";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
import { IERC20__factory } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { PromiseOrValue } from "../../../typechain-types/common";
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
        expect(await toNumber(balance)).to.be.closeTo(2000, 300, "BalanceOf on og vault returns value")
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
        expect(await toNumber(balance)).to.be.closeTo(2000, 300, "BalanceOf on og vault returns value")
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
        expect(await toNumber(balance)).to.be.closeTo(2000, 300, "BalanceOf on og vault returns value")
    })

    it("Try to deposit unregistered position", async () => {

        await s.nfpManager.connect(s.Carol).approve(s.CappedPosition.address, s.CarolIllegalPositionId)
        expect(s.CappedPosition.connect(s.Carol).deposit(s.CarolIllegalPositionId, s.CaroLVaultID)).to.be.revertedWith("Pool not registered")

    })


    //todo
    it("Check collection of income", async () => {
        //do a swap

        //elapse time?

        //check amounts owed

        //add these amounts to collateral value while not collected? 
    })

})

describe("Check valuations", async () => {
    it("Check weth/wbtc pool valuation", async () => {
        //derive value based on price
        let p0: BigNumber = (await s.wbtcOracle.currentValue()).div(BN("1e10"))
        let p1: BigNumber = await s.wethOracle.currentValue()
   
        let v0: BigNumber = (p0.mul(BN(s.BobAmount0))).div(BN("1e18"))
        let v1: BigNumber = (p1.mul(BN(s.BobAmount1))).div(BN("1e18"))
        const targetAmount = v1.add(v0)
        const actual = await s.CappedPosition.balanceOf(s.BobVault.address)
        showBodyCyan("Target: ", await toNumber(targetAmount))//todo improve accuracy?
        showBodyCyan("Balanc: ", await toNumber(actual))
        showBodyCyan("Delta: ", ((await toNumber(actual) - await toNumber(targetAmount)) / await toNumber(targetAmount)) * 100, "%")
    })

    it("Check weth/wbtc pool valuation - Carol", async () => {
        //derive value based on price
        let p0: BigNumber = (await s.wbtcOracle.currentValue()).div(BN("1e10"))
        let p1: BigNumber = await s.wethOracle.currentValue()
   
        let v0: BigNumber = (p0.mul(BN(s.CarolAmount0))).div(BN("1e18"))
        let v1: BigNumber = (p1.mul(BN(s.CarolAmount1))).div(BN("1e18"))
        const targetAmount = v1.add(v0)
        const actual = await s.CappedPosition.balanceOf(s.CarolVault.address)
        showBodyCyan("Target: ", await toNumber(targetAmount))//todo improve accuracy?
        showBodyCyan("Balanc: ", await toNumber(actual))
        showBodyCyan("Delta: ", ((await toNumber(actual) - await toNumber(targetAmount)) / await toNumber(targetAmount)) * 100, "%")
    })
})


/**
type DecreaseLiquidityParams = {
        tokenId: PromiseOrValue<BigNumberish>,
        liquidity: PromiseOrValue<BigNumberish>,
        amount0Min: PromiseOrValue<BigNumberish>,
        amount1Min: PromiseOrValue<BigNumberish>,
        deadline: PromiseOrValue<BigNumberish>,
    }

    type CollectParams = {
        tokenId: PromiseOrValue<BigNumberish>,
        recipient: PromiseOrValue<string>,
        amount0Max: PromiseOrValue<BigNumberish>,
        amount1Max: PromiseOrValue<BigNumberish>
    }

    it("return Carol's illegal position", async () => {

        const startWeth = await s.WETH.balanceOf(s.Carol.address)
        const startUSDC = await s.USDC.balanceOf(s.Carol.address)

        showBody("Start weth: ", await toNumber(startWeth))
        showBody("Start usdc: ", startUSDC)

        let [, , , , , , , liquidity, , , ,] = await s.nfpManager.positions(s.CarolIllegalPositionId)
        showBody("Liq: ", liquidity)
        const block = await currentBlock()

        //decrease liquidity 
        const decreaseParams: DecreaseLiquidityParams = {
            tokenId: s.CarolIllegalPositionId,
            liquidity: liquidity,
            amount0Min: BN("0"),
            amount1Min: BN("0"),
            deadline: block.timestamp + 120
        }

        await s.nfpManager.connect(s.Carol).decreaseLiquidity(decreaseParams)

        const endWeth = await s.WETH.balanceOf(s.Carol.address)
        const endUSDC = await s.USDC.balanceOf(s.Carol.address)
        const [
            nonce,
            operator,
            token0,
            token1,
            _fee,
            tLow,
            tUp,
            endLiquidity,
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128,
            tokensOwed0,
            tokensOwed1
        ] = await s.nfpManager.positions(s.CarolIllegalPositionId)
        showBody("tokensOwed0: ", tokensOwed0)
        showBody("tokensOwed1: ", tokensOwed1)

        const collectParams: CollectParams = {
            tokenId: s.CarolIllegalPositionId,
            recipient: s.Carol.address,
            amount0Max: tokensOwed0,
            amount1Max: tokensOwed1
        }
        await s.nfpManager.connect(s.Carol).collect(collectParams)

        showBody("End weth: ", await toNumber(endWeth))
        showBody("End usdc: ", endUSDC)



        showBody("End Liquidity: ", endLiquidity)
        showBody("Delta weth: ", endWeth.sub(startWeth))
        showBody("Delta usdc: ", endUSDC.sub(startUSDC))


    })
 */