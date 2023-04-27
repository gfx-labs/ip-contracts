import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../../util/impersonator"

import { BN } from "../../../../../util/number";
import {
    IVault__factory,
    VotingVault,
    IVault,
    VotingVault__factory,
    CurveMaster__factory,
    curve,
    VaultController__factory,
    VaultBPT__factory
} from "../../../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    hardhat_mine,
    hardhat_mine_timed,
    mineBlock,
    OneWeek,
    OneYear,
} from "../../../../../util/block";
import { toNumber, getGas } from "../../../../../util/math";
import { IERC20__factory } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";

const usdcAmount = BN("50e6")
const usdiAmount = BN("50e18")

const USDC_BORROW = BN("1000e6")//1k USDC
const USDI_BORROW = BN("100e18")//500 USDI



require("chai").should();

describe("Verify Upgraded Contracts", () => {

    it("Mint voting vault for Bob", async () => {

        let _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
        expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

        const result = await s.VotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
        await mineBlock()

        let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
        s.BobVotingVault = VotingVault__factory.connect(vaultAddr, s.Bob)

        expect(s.BobVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Bob's voting vault setup complete")
    })
    it("Mint voting vault for Carol", async () => {

        let _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(s.CaroLVaultID)
        expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

        const result = await s.VotingVaultController.connect(s.Carol).mintVault(s.CaroLVaultID)
        await mineBlock()

        let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.CaroLVaultID)
        s.CarolVotingVault = VotingVault__factory.connect(vaultAddr, s.Carol)

        expect(s.CarolVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Carol's voting vault setup complete")
    })

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

    it("Mint BPT vaults", async () => {
        const result = await s.VotingVaultController.connect(s.Bob).mintBptVault(s.BobVaultID)
        const gas = await getGas(result)
        showBodyCyan("Gas to mint BPT vault: ", gas)

        s.BobBptVault = VaultBPT__factory.connect(await s.VotingVaultController.BPTvaultAddress(s.BobVaultID), s.Bob)

        let info = await s.BobBptVault._vaultInfo()
        expect(info.id).to.eq(s.BobVaultID, "ID is correct, vault minted successfully")

        await s.VotingVaultController.connect(s.Carol).mintBptVault(s.CaroLVaultID)
        await mineBlock()
        s.CarolBptVault = VaultBPT__factory.connect(await s.VotingVaultController.BPTvaultAddress(s.CaroLVaultID), s.Carol)

        info = await s.CarolBptVault._vaultInfo()
        expect(info.id).to.eq(s.CaroLVaultID, "ID is correct, vault minted successfully")
    })

})

describe("Deposit and verify functions", () => {
    it("deposit BPT", async () => {
        await s.AuraBal.connect(s.Bob).approve(s.CappedAuraBal.address, s.BPT_AMOUNT)
        const result = await s.CappedAuraBal.connect(s.Bob).deposit(s.BPT_AMOUNT, s.BobVaultID, true)
        const gas = await getGas(result)
        showBodyCyan("Gas to deposit and stake: ", gas)

        //confirm staked
        let staked = await s.BobBptVault.isStaked(s.AuraBal.address)
        expect(staked).to.eq(true, "BPT is staked")

        //check destinations
        //BPT should be staked and reward tokens in vault (not gauge tokens)
        let balance = await s.AuraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "All BPTs staked, balance 0")

        balance = await s.rewardToken.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.BPT_AMOUNT, "Reward tokens in BPT vault")
    })

    it("advance time", async () => {
        await hardhat_mine_timed(500, 15)
    })



    it("Claim rewards", async () => {

        //confirm staked
        let staked = await s.BobBptVault.isStaked(s.AuraBal.address)
        expect(staked).to.eq(true, "BPT is staked")

        let startBAL = await s.BAL.balanceOf(s.Bob.address)
        expect(startBAL).to.eq(0, "Bob starts with 0 BAL")

        //extra rewards turned on: bb-a-usd 0xA13a9247ea42D743238089903570127DdA72fE44
        let extraRewardToken = IERC20__factory.connect("0xA13a9247ea42D743238089903570127DdA72fE44", s.Frank)
        let balance = await extraRewardToken.balanceOf(s.Bob.address)
        expect(balance).to.eq(0, "Bob starts with 0 reward tokens")

        let result = await s.BobBptVault.claimAuraLpRewards(s.AuraBal.address, true)
        const receipt = await result.wait()
        //showBody(receipt)
        let gas = await getGas(result)
        showBodyCyan("Gas to claim rewards: ", gas)

        let balRewards = await s.BAL.balanceOf(s.Bob.address)
        showBody("Bal rewards: ", balRewards)
        //expect(balRewards).to.be.gt(0, "Received BAL rewards")

        let newExtraRewardsBalance = await extraRewardToken.balanceOf(s.Bob.address)
        showBody("Extra rewards: ", newExtraRewardsBalance)
        //expect(newExtraRewardsBalance).to.be.gt(0, "Received more extra rewards")

    })

    it("withdraw staked BPT", async () => {

        //withdraw staked tokens
        const result = await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedAuraBal.address, s.BPT_AMOUNT)
        const gas = await getGas(result)
        showBodyCyan("Gas to withdraw and unstake: ", gas)

        //check destinations
        let totalSupply = await s.CappedAuraBal.totalSupply()
        expect(totalSupply).to.eq(0, "All cap tokens redeemed for underlying")

        let balance = await s.AuraBal.balanceOf(s.Bob.address)
        expect(balance).to.eq(s.BPT_AMOUNT, "Bob received correct amount of BPT")

        balance = await s.rewardToken.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "All reward tokens unstaked")

        balance = await s.AuraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "All BPT withdrawn")

    })

    it("Deposit and stake for future tests", async () => {
        await s.AuraBal.connect(s.Bob).approve(s.CappedAuraBal.address, s.BPT_AMOUNT)
        const result = await s.CappedAuraBal.connect(s.Bob).deposit(s.BPT_AMOUNT, s.BobVaultID, false)
        const gas = await getGas(result)
        showBodyCyan("Gas to deposit without stake: ", gas)


        //BPT should be in BPT vault (not gauge tokens nor reward token)
        let balance = await s.AuraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.BPT_AMOUNT, "BPT amount in vault is correct")

        balance = await s.rewardToken.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "Not yet any reward tokens in BPT vault")

        //cap tokens should be in standard vault
        balance = await s.CappedAuraBal.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.BPT_AMOUNT, "Cap tokens in standard vault")
    })
    it("Stake", async () => {

        const result = await s.BobBptVault.stakeAuraLP(s.AuraBal.address)
        const gas = await getGas(result)
        showBodyCyan("Gas to stake only: ", gas)

        //confirm staked
        let staked = await s.BobBptVault.isStaked(s.AuraBal.address)
        expect(staked).to.eq(true, "BPT is staked")

        //check destinations
        //BPT should be staked and reward tokens in vault (not gauge tokens)
        let balance = await s.AuraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "All BPTs staked, balance 0")

        balance = await s.rewardToken.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.BPT_AMOUNT, "Reward tokens in BPT vault")


    })

    //test for breaking the rules
    it("Try to transfer", async () => {
        await expect(s.CappedAuraBal.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
    })

    it("Try to withdraw from a vault that is not yours", async () => {
        await expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedAuraBal.address, s.BPT_AMOUNT)).to.be.revertedWith("sender not minter")
    })

    it("Try to exceed the cap", async () => {
        await expect(s.CappedAuraBal.connect(s.Carol).deposit(BN("1e18"), s.CaroLVaultID, true)).to.be.revertedWith("cap reached")
    })

    it("Try to withdraw cap tokens you don't own", async () => {
        await expect(s.CarolVault.connect(s.Carol).withdrawErc20(s.CappedAuraBal.address, BN("1e18"))).to.be.reverted
    })
})

