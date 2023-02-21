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
        await s.VotingVaultController.connect(s.owner).registerAuraLpData(s.stETH_Gauge.address, "", 29)

        await ceaseImpersonation(s.owner._address)
    })

    const auraBalRewardsPool = "0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2"
    it("Steal money to fund participants", async () => {
        //steal wstEth/weth gauge token
        const stEthGaugeWhale = "0xfF72243C5D7373F8Ac9cCF4ccd226301dC213a70"
        await stealMoney(stEthGaugeWhale, s.Bob.address, s.stETH_Gauge.address, s.stETH_Gauge_Amount)

        //steal auraBal
        const auraBalWhale = "0x0BE2340d942e79DFeF172392429855DE8A4f5b14"
        await stealMoney(auraBalWhale, s.Bob.address, s.auraBal.address, s.AuraBalAmount)



    })

    //seems like gauge tokens are all held by 0xaF52695E1bB01A16D33D7194C28C42b10e0Dbec2 aura voter proxy
    /**
    Another question for you, 
    For staking of balancer LP gauge tokens on aura (such as B-stETH-STABLE-gauge 0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE), it looks like you can  do this through the booster contract, is that the correct way this should happen? 
    This one: 0xA57b8d98dAE62B26Ec3bcC4a365338157060B234

    It looks like most aura LPs are staked this way as well. It seems simple enough to get the reward token / PID from the aura app for the corresponding  aura LP but I'm not sure how to do this for a balancer gauge token. 

    My question is, how is one to know which aura reward token / PID to pass to the booster? I haven't noticed a straight forward way to do this on the aura app but I could be missing something? 

    Is there a function I can call somewhere with an LP token or gauge token that will return the reward token addr? 



    however some are staking the standard BPT through aura via the booster
    see tx approve: 0xcdba867e2542a89cc5f038ddc6cb6de2e0c91f2ee72dcf3c90eb5ef32f6ed050
    and stake: 0x0675e01f6785a27224d1b127182235797aa1e87e1d0888a55fd484a454c34825

    User receives rewards 0xe4683Fe8F53da14cA5DAc4251EaDFb3aa614d528 with PID 29


     */
    it("Deposit gauge token", async () => {

        //register PID 29 for gauge token

    })

    it("deposit auraBal", async () => {
        await s.auraBal.connect(s.Bob).approve(s.CappedAuraBal.address, s.AuraBalAmount)
        await s.CappedAuraBal.connect(s.Bob).deposit(s.AuraBalAmount, s.BobVaultID, true)

        //check destinations
        let balance = await s.CappedAuraBal.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Cap tokens minted to standard vault")

        balance = await s.auraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Underlying sent to BPT vault")

    })

    it("deposit and stake aura lp token", async () => {
        await s.primeAuraBalLP.connect(s.Bob).approve(s.CappedAuraLP.address, s.AuraLPamount)
        await s.CappedAuraLP.connect(s.Bob).deposit(s.AuraLPamount, s.BobVaultID, true)

        //check destinations
        let balance = await s.CappedAuraLP.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.AuraLPamount, "Cap tokens minted to standard vault")

        balance = await s.primeAuraBalLP.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraLPamount, "Underlying sent to BPT vault")

        //stake aura LP
        await s.BobBptVault.stakeAuraLP(s.primeAuraBalLP.address)
        balance = await s.primeAuraBalRewardToken.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraLPamount, "Correct amount staked")
        balance = await s.primeAuraBalLP.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "0 LPs remaining unstaked")
    })

    it("Claim gauge token rewards", async () => {

    })

    it("Stake auraBal", async () => {

        //stake auraBal
        await s.BobBptVault.connect(s.Bob).stakeAuraLP(s.auraBal.address)

        let balance = await s.auraBalRewards.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Correct amount staked")
        balance = await s.auraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "0 auraBal remaining unstaked")

    })

    it("Claim rewards", async () => {
        //auraBal rewards claim doesn't fail
        await expect(s.BobBptVault.claimAuraLpRewards(s.auraBal.address)).to.not.reverted


        await expect(s.BobBptVault.claimAuraLpRewards(s.primeAuraBalLP.address)).to.not.reverted


        //todo verify rewards?
    })

    it("Withdraw all tokens", async () => {
        let balance = await s.auraBal.balanceOf(s.Bob.address)
        expect(balance).to.eq(0, "Bob holds 0 auraBals as they are all on the protocol before withdraw")
        balance = await s.auraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(0, "Bob's vault also holds 0 auraBals as they are all staked")

        balance = await s.auraBalRewards.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Bob's vault holds the correct amount of reward tokens")

        //withdraw staked tokens
        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedAuraBal.address, await s.CappedAuraBal.balanceOf(s.BobVault.address))

        balance = await s.auraBal.balanceOf(s.Bob.address)
        expect(balance).to.eq(s.AuraBalAmount, "Bob now holds the expected number of auraBals")
    })

    it("Deposit tokens again for future tests", async () => {
        await s.auraBal.connect(s.Bob).approve(s.CappedAuraBal.address, s.AuraBalAmount)
        await s.CappedAuraBal.connect(s.Bob).deposit(s.AuraBalAmount, s.BobVaultID, false)

        //check destinations
        let balance = await s.CappedAuraBal.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Cap tokens minted to standard vault")

        balance = await s.auraBal.balanceOf(s.BobBptVault.address)
        expect(balance).to.eq(s.AuraBalAmount, "Underlying sent to BPT vault")
    })

})
