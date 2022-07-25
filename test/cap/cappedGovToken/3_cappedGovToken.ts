import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { start } from "repl";
require("chai").should();


describe("Verify setup", () => {
    it("Bob's Voting Vault setup correctly", async () => {
        const vaultInfo = await s.BobVotingVault._vaultInfo()
        const parentVault = await s.BobVotingVault.parentVault()

        expect(parentVault.toUpperCase()).to.eq(vaultInfo.vault_address.toUpperCase(), "Parent Vault matches vault info")

        expect(vaultInfo.id).to.eq(s.BobVaultID, "Voting Vault ID is correct")
        expect(vaultInfo.vault_address).to.eq(s.BobVault.address, "Vault address is correct")
    })
    it("Carol's Voting Vault setup correctly", async () => {
        const vaultInfo = await s.CarolVotingVault._vaultInfo()

        expect(vaultInfo.id).to.eq(s.CaroLVaultID, "Voting Vault ID is correct")
        expect(vaultInfo.vault_address).to.eq(s.CarolVault.address, "Vault address is correct")
    })
})

//mint voting vault from an account that does not yet have a regular vault
describe("Testing CappedToken functions", () => {
    const depositAmount = BN("500e18")
    it("Deposit underlying", async () => {

        expect(await s.AAVE.balanceOf(s.Bob.address)).to.eq(s.aaveAmount, "Bob has the expected amount of aave")
        expect(await s.AAVE.balanceOf(s.Bob.address)).to.be.gt(depositAmount, "Bob has enough Aave")

        let caBalance = await s.CappedAave.balanceOf(s.Bob.address)
        expect(caBalance).to.eq(0, "Bob holds 0 capped aave at the start")

        caBalance = await s.CappedAave.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped aave at the start")


        await s.AAVE.connect(s.Bob).approve(s.CappedAave.address, depositAmount)
        await s.CappedAave.connect(s.Bob).deposit(depositAmount, s.BobVaultID)
        await mineBlock()


        caBalance = await s.CappedAave.balanceOf(s.Bob.address)
        expect(caBalance).to.eq(0, "Bob holds 0 capped aave after deposit")

        caBalance = await s.CappedAave.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(depositAmount, "Bob's vault received the capped aave tokens")


    })

    it("Try to transfer", async () => {
       expect(s.CappedAave.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
    })

    it("Try to exceed the cap", async () => {
        const cap = await s.CappedAave.getCap()
        expect(cap).to.eq(s.AaveCap, "Cap is still correct")
        expect(await s.CappedAave.totalSupply()).to.eq(cap, "Cap reached")

        await s.AAVE.connect(s.Bob).approve(s.CappedAave.address, 1)
        await mineBlock()
        expect(s.CappedAave.connect(s.Bob).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")
    })    


    it("Withdraw Underlying", async () => {

        const amount = BN("250e18")

        const startAave = await s.AAVE.balanceOf(s.Bob.address)
        const startCapAave = await s.CappedAave.balanceOf(s.BobVault.address)

        expect(startCapAave).to.be.gt(amount, "Enough CapAave")

        //await s.CappedAave.connect(s.Bob).approve(s.VotingVaultController.address, BN("500e18"))
        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedAave.address, amount)
        await mineBlock()

        let balance = await s.AAVE.balanceOf(s.Bob.address)
        expect(balance).to.eq(startAave.add(amount), "Aave balance changed as expected")

        balance = await s.CappedAave.balanceOf(s.BobVault.address)
        expect(balance).to.eq(startCapAave.sub(amount), "CappedAave balance changed as expected")

        //Deposit again to reset for further tests
        await s.AAVE.connect(s.Bob).approve(s.CappedAave.address, amount)
        await s.CappedAave.connect(s.Bob).deposit(amount, s.BobVaultID)
        await mineBlock()
    })
})