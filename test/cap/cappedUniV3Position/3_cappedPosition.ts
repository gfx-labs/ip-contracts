import { s } from "./scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber } from "ethers";
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

    it("Carol deposit's the unregistered position", async () => {

        const startBorrowPower = await s.VaultController.vaultBorrowingPower(s.CaroLVaultID)
        showBody("Start borrow power: ", await toNumber(startBorrowPower))

        const startBalance = await s.CappedPosition.balanceOf(s.CarolVault.address)
        showBody("Start Balance amnt: ", await toNumber(startBalance))

        //deposit the illegal position
        await s.nfpManager.connect(s.Carol).approve(s.CappedPosition.address, s.CarolIllegalPositionId)
        const result = await s.CappedPosition.connect(s.Carol).deposit(s.CarolIllegalPositionId, s.CaroLVaultID)
        const gas = await getGas(result)
        showBodyCyan("Gas to deposit unregistered position: ", gas)

        let balance = await s.nfpManager.balanceOf(s.CarolNftVault.address)
        expect(balance).to.eq(2, "2nd uni v3 position minted")

        let endBorrowPower = await s.VaultController.vaultBorrowingPower(s.CaroLVaultID)
        let endBalance = await s.CappedPosition.balanceOf(s.CarolVault.address)
        expect(endBorrowPower).to.eq(startBorrowPower, "Borrow power has not increased")
        expect(endBalance).to.eq(startBalance, "Balance has not increased")

    })


    //todo
    it("Check collection of income", async () => {
        //do a swap

        //elapse time?

        //check amounts owed

        //add these amounts to collateral value while not collected? 
    })

})

