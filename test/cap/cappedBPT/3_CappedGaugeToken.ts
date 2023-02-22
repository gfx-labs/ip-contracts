import { s } from "../scope";
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
    CappedGovToken
} from "../../../typechain-types"
import { JsxEmit } from "typescript";
import { stealMoney } from "../../../util/money";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
import { IERC20__factory } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
require("chai").should();


describe("Verify setup", () => {
    it("Bob's Voting Vault setup correctly", async () => {
        const vaultInfo = await s.BobBptVault._vaultInfo()
        const parentVault = await s.BobBptVault.parentVault()

        expect(parentVault.toUpperCase()).to.eq(vaultInfo.vault_address.toUpperCase(), "Parent Vault matches vault info")

        expect(vaultInfo.id).to.eq(s.BobVaultID, "Voting Vault ID is correct")
        expect(vaultInfo.vault_address).to.eq(s.BobVault.address, "Vault address is correct")
    })
    it("Carol's Voting Vault setup correctly", async () => {
        const vaultInfo = await s.CarolBptVault._vaultInfo()

        expect(vaultInfo.id).to.eq(s.CaroLVaultID, "Voting Vault ID is correct")
        expect(vaultInfo.vault_address).to.eq(s.CarolVault.address, "Vault address is correct")
    })
})

describe("Deposit and verify functions", () => {

    before(async () => {
        //register aura LP data to vvc
        await impersonateAccount(s.owner._address)

        await s.VotingVaultController.connect(s.owner).registerAuraBooster("0xA57b8d98dAE62B26Ec3bcC4a365338157060B234")

        // call pid on reward token to get pid
        await s.VotingVaultController.connect(s.owner).registerAuraLpData(s.primeAuraBalLP.address, s.primeAuraBalRewardToken.address, 1)
        await s.VotingVaultController.connect(s.owner).registerAuraLpData(s.auraBal.address, s.auraBalRewards.address, 0)

        //register gauge token
        //await s.VotingVaultController.connect(s.owner).registerAuraLpData(s.stETH_Gauge.address, "", 29)

        await ceaseImpersonation(s.owner._address)
    })
    it("Deposit naked gauge token", async () => {
        await s.stETH_Gauge.connect(s.Bob).approve(s.CappedStethGauge.address, s.stETH_Gauge_Amount)
        await s.CappedStethGauge.connect(s.Bob).deposit(s.stETH_Gauge_Amount, s.BobVaultID, false)

    })

    it("Claim gauge token rewards", async () => {

        await expect(s.BobBptVault.claimRewards(s.stETH_Gauge.address)).to.not.reverted

    })

    it("deposit and stake auraBal in a single TX", async () => {
        await s.auraBal.connect(s.Bob).approve(s.CappedAuraBal.address, s.AuraBalAmount)
        await s.CappedAuraBal.connect(s.Bob).deposit(s.AuraBalAmount, s.BobVaultID, true)

        //check destinations
        let balance = await s.CappedAuraBal.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Cap tokens minted to standard vault")

        //balance = await s.auraBal.balanceOf(s.BobBptVault.address)
        //expect(balance).to.eq(s.AuraBalAmount, "Underlying sent to BPT vault")

        balance = await s.auraBalRewards.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Correct amount staked")
        balance = await s.auraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "0 auraBal remaining unstaked")

    })

    it("deposit and stake aura lp token in a single TX", async () => {
        await s.primeAuraBalLP.connect(s.Bob).approve(s.CappedAuraLP.address, s.AuraLPamount)
        await s.CappedAuraLP.connect(s.Bob).deposit(s.AuraLPamount, s.BobVaultID, true)

        //check destinations
        let balance = await s.CappedAuraLP.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.AuraLPamount, "Cap tokens minted to standard vault")

        //balance = await s.primeAuraBalLP.balanceOf(s.BobBptVault.address)
        //expect(balance).to.eq(s.AuraLPamount, "Underlying sent to BPT vault")

        //stake aura LP
        //await s.BobBptVault.stakeAuraLP(s.primeAuraBalLP.address)
        balance = await s.primeAuraBalRewardToken.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraLPamount, "Correct amount staked")
        balance = await s.primeAuraBalLP.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "0 LPs remaining unstaked")
    })



    it("Claim auraBal and aura LP rewards", async () => {
        let startBAL = await s.BAL.balanceOf(s.Bob.address)
        expect(startBAL).to.eq(0, "Bob starts with 0 BAL")

        let extraRewardToken = IERC20__factory.connect("0xA13a9247ea42D743238089903570127DdA72fE44", s.Frank)
        let balance = await extraRewardToken.balanceOf(s.Bob.address)
        expect(balance).to.eq(0, "Bob starts with 0 reward tokens")

        await s.BobBptVault.claimAuraLpRewards(s.auraBal.address, true)
        let balRewards = await s.BAL.balanceOf(s.Bob.address)
        expect(balRewards).to.be.gt(0, "Received BAL rewards")
        balance = await extraRewardToken.balanceOf(s.Bob.address)
        expect(balance).to.be.gt(0, "Received extra rewards")

        //AURA token
        extraRewardToken = IERC20__factory.connect("0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF", s.Frank)
        balance = await extraRewardToken.balanceOf(s.Bob.address)
        expect(balance).to.eq(0, "Bob starts with 0 reward tokens")

        await s.BobBptVault.claimAuraLpRewards(s.primeAuraBalLP.address, true)

        let newbalance = await s.BAL.balanceOf(s.Bob.address)
        expect(newbalance.sub(balRewards)).to.be.gt(0, "Received more BAL rewards")

        let newExtraRewardsBalance = await extraRewardToken.balanceOf(s.Bob.address)
        expect(newExtraRewardsBalance).to.be.gt(0, "Received more extra rewards")

    })

    it("Withdraw staked aura LP tokens / auraBal", async () => {
        let balance = await s.auraBal.balanceOf(s.Bob.address)
        expect(balance).to.eq(0, "Bob holds 0 auraBals as they are all on the protocol before withdraw")
        balance = await s.auraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "Bob's vault also holds 0 auraBals as they are all staked")

        //confirm staked
        let staked = await s.BobBptVault.isStaked(s.auraBal.address)
        expect(staked).to.eq(true, "auraBal is staked")

        staked = await s.BobBptVault.isStaked(s.primeAuraBalLP.address)
        expect(staked).to.eq(true, "aura LP is staked")

        balance = await s.auraBalRewards.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Bob's vault holds the correct amount of reward tokens")

        //withdraw staked tokens
        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedAuraBal.address, await s.CappedAuraBal.balanceOf(s.BobVault.address))

        balance = await s.auraBal.balanceOf(s.Bob.address)
        expect(balance).to.eq(s.AuraBalAmount, "Bob now holds the expected number of auraBals")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedAuraLP.address, await s.CappedAuraLP.balanceOf(s.BobVault.address))

        balance = await s.primeAuraBalLP.balanceOf(s.Bob.address)
        expect(balance).to.eq(s.AuraLPamount, "Bob now holds the expected number of aura LPs")
    })

    it("Withdraw gauge token", async () => {
        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedStethGauge.address, await s.CappedStethGauge.balanceOf(s.BobVault.address))

        let balance = await s.stETH_Gauge.balanceOf(s.Bob.address)
        expect(balance).to.eq(s.stETH_Gauge_Amount, "Received the correct amount of gauge tokens")
    })

    
     it("Deposit tokens again for future tests", async () => {
        await s.auraBal.connect(s.Bob).approve(s.CappedAuraBal.address, s.AuraBalAmount)
        await s.CappedAuraBal.connect(s.Bob).deposit(s.AuraBalAmount, s.BobVaultID, true)

        await s.primeAuraBalLP.connect(s.Bob).approve(s.CappedAuraLP.address, s.AuraLPamount)
        await s.CappedAuraLP.connect(s.Bob).deposit(s.AuraLPamount, s.BobVaultID, true)
        
        await s.stETH_Gauge.connect(s.Bob).approve(s.CappedStethGauge.address, s.stETH_Gauge_Amount)
        await s.CappedStethGauge.connect(s.Bob).deposit(s.stETH_Gauge_Amount, s.BobVaultID, false)

        //check destinations
        let balance = await s.CappedAuraBal.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Cap tokens minted to standard vault")

        balance = await s.CappedAuraLP.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.AuraLPamount, "Cap tokens minted to standard vault")

        balance = await s.CappedStethGauge.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.stETH_Gauge_Amount, "Cap tokens minted to standard vault")

        balance = await s.auraBalRewards.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Underlying sent to BPT vault and staked")

        balance = await s.primeAuraBalRewardToken.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraLPamount, "Underlying sent to BPT vault and staked")

        balance = await s.stETH_Gauge.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.stETH_Gauge_Amount, "Underlying sent to BPT vault")

    })
     

})
