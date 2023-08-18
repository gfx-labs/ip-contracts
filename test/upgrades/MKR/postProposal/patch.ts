import { expect } from "chai"
import { ethers, network } from "hardhat"
import { stealMoney } from "../../../../util/money"
import { s } from "../scope"
import { MainnetAddresses, MainnetCappedTokens, MainnetDeploys } from "../../../../util/addresser"
import { reset, mineBlock, hardhat_mine_timed, currentBlock, hardhat_mine, fastForward } from "../../../../util/block"
import {
    IERC20__factory,
    OracleMaster__factory,
    ProxyAdmin__factory,
    USDI__factory,
    MKRVotingVaultController__factory,
    VaultController__factory,
    IVOTE__factory,
    IVault,
    MKRVotingVaultController,
    MKRVotingVault,
    IVault__factory,
    MKRVotingVault__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    CappedMkrToken__factory,
} from "../../../../typechain-types"
import { JsonRpcSigner } from "@ethersproject/providers"
import { BigNumber } from "ethers"
import { showBody, showBodyCyan } from "../../../../util/format"
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers"
import { ceaseImpersonation } from "../../../../util/impersonator"
import { BN } from "../../../../util/number"
import { toNumber } from "../../../../util/math"
import { IERC20 } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts"
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal"

require("chai").should()

const d = new MainnetDeploys()
const c = new MainnetCappedTokens()

let MKRVotingVaultController: MKRVotingVaultController
let mkrVault: MKRVotingVault

const delegatee = "0x4C28d8402ac01E5d623e4A5438535369770Fe407"
let startBal: BigNumber

const MKR = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2"

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(17943761)).to.not.throw
    })
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw
    })
})

describe("Initial Setup - MKR - mainnet deploys", () => {
    it("connect to signers", async () => {
        s.accounts = await ethers.getSigners()
        s.Frank = s.accounts[0]
        s.Eric = s.accounts[5]
        s.Andy = s.accounts[6]
        s.Bob = s.accounts[7]
        s.Carol = s.accounts[8]
        s.Dave = s.accounts[9]
        s.Gus = s.accounts[10]
    })

    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank)
        s.WETH = IERC20__factory.connect(s.wethAddress, s.Frank)

        s.UNI = IVOTE__factory.connect(s.uniAddress, s.Frank)
        s.MKR = IERC20__factory.connect(MKR, s.Frank)
    })

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)
        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)

        const vvc = d.MKRVotingVaultController
        s.MKRVotingVaultController = MKRVotingVaultController__factory.connect(vvc, s.Frank)
    })
})

describe("upgrade and fix", async () => {

    let imp: MKRVotingVaultController
    let gov: GovernorCharlieDelegate

    const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
    const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"
    let proposer: JsonRpcSigner

    before(async () => {
        proposer = ethers.provider.getSigner(proposerAddr)
        gov = new GovernorCharlieDelegate__factory(s.Frank).attach(
            govAddress
        )
    })

    it("Deploy new implementation", async () => {
        imp = await new MKRVotingVaultController__factory(s.Frank).deploy()
    })

    it("Make proposal", async () => {

        const proposal = new ProposalContext("Patch MKR")
        const upgrade = await new ProxyAdmin__factory(s.Frank).attach(s.ProxyAdmin.address).
            populateTransaction.upgrade(s.MKRVotingVaultController.address, imp.address)

        proposal.addStep(upgrade, "upgrade(address,address)")

        let out = proposal.populateProposal()

        await impersonateAccount(proposer._address)

        await gov.connect(proposer).propose(
            out.targets,
            out.values,
            out.signatures,
            out.calldatas,
            "txt",
            false
        )


    })

    it("queue and execute", async () => {
        const votingPeriod = await gov.votingPeriod()
        const votingDelay = await gov.votingDelay()
        const timelock = await gov.proposalTimelockDelay()

        const block = await currentBlock()

        const proposal = Number(await gov.proposalCount())
        showBodyCyan("Advancing a lot of blocks...")
        await hardhat_mine(votingDelay.toNumber())

        await gov.connect(proposer).castVote(proposal, 1)

        await ceaseImpersonation(proposerAddr)
        const whale = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
        const prop = ethers.provider.getSigner(whale)
        await impersonateAccount(whale)
        await gov.connect(prop).castVote(proposal, 1)

        showBodyCyan("Advancing a lot of blocks again...")
        await hardhat_mine(votingPeriod.toNumber())

        await gov.connect(prop).queue(proposal)

        await fastForward(timelock.toNumber())

        const result = await gov.connect(prop).execute(proposal)
        await result.wait()
        showBodyCyan("EXECUTION COMPLETE")

        await ceaseImpersonation(whale)
    })

})



describe("Verify", () => {
    before(async () => {
        s.CappedMKR = CappedMkrToken__factory.connect(c.CappedMKR, s.Frank)
        s.MKR = IERC20__factory.connect(s.mkrAddress, s.Frank)
        MKRVotingVaultController = MKRVotingVaultController__factory.connect(d.MKRVotingVaultController, s.Frank)
    })

    it("Steal money", async () => {
        const bank = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
        await stealMoney(bank, s.Bob.address, s.MKR.address, BN("1e17"))
    })

    it("Mint Vaults and deposit", async () => {
        await expect(s.VaultController.connect(s.Bob).mintVault()).to.not.reverted
        await mineBlock()
        s.BobVaultID = await s.VaultController.vaultsMinted()
        const vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
        s.BobVault = IVault__factory.connect(vaultAddress, s.Bob)

        await s.MKRVotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
        mkrVault = MKRVotingVault__factory.connect(await s.MKRVotingVaultController.votingVaultAddress(s.BobVaultID), s.Frank)

        //deposit
        await s.MKR.connect(s.Bob).approve(s.CappedMKR.address, await s.MKR.balanceOf(s.Bob.address))
        await s.CappedMKR.connect(s.Bob).deposit(await s.MKR.balanceOf(s.Bob.address), s.BobVaultID)
    })



    it("Check delegation", async () => {

        startBal = await s.MKR.balanceOf(mkrVault.address)
        showBody("Start Bal: ", await toNumber(startBal))

        await mkrVault.connect(s.Bob).
            delegateMKRLikeTo(delegatee, s.mkrAddress)

        const endBal = await s.MKR.balanceOf(mkrVault.address)
        showBody("Endng Bal: ", await toNumber(endBal))

    })

    it("Undelegate", async () => {

        await mkrVault.connect(s.Bob).undelegateMKRLike(delegatee)

        const endBal = await s.MKR.balanceOf(mkrVault.address)
        showBody("Endng Bal: ", await toNumber(endBal))

    })

})



describe("liquidation while delegated", () => {

    it("delegate and withdraw", async () => {
        let balance = await s.MKR.balanceOf(mkrVault.address)
        expect(balance).to.not.eq(0, "mkrs not yet delegated")

        await mkrVault.connect(s.Bob).
            delegateMKRLikeTo(delegatee, s.mkrAddress)

        balance = await s.MKR.balanceOf(mkrVault.address)
        expect(balance).to.eq(0, "All mkrs delegated")

        let status = await mkrVault.delegationStatus(s.MKR.address)
        expect(status.delegatee).to.not.eq(ethers.constants.AddressZero, "delegatee set")
        expect(status.delegated).to.not.eq(false, "delegated true")

        const amount = await s.CappedMKR.balanceOf(s.BobVault.address)
        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedMKR.address, amount)

        status = await mkrVault.delegationStatus(s.MKR.address)
        expect(status.delegatee).to.eq(ethers.constants.AddressZero, "delegatee deleted")
        expect(status.delegated).to.eq(false, "delegated false")

        //deposit again for future tests
        await s.MKR.connect(s.Bob).approve(s.CappedMKR.address, await s.MKR.balanceOf(s.Bob.address))
        await s.CappedMKR.connect(s.Bob).deposit(await s.MKR.balanceOf(s.Bob.address), s.BobVaultID)

    })


    it("Borrow max", async () => {
        const bp = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, bp)
        const vl = await s.VaultController.vaultLiability(s.BobVaultID)

        expect(await toNumber(vl)).to.be.closeTo(await toNumber(bp), 0.0001, "liability == borrow power")

    })

    it("Verify status", async () => {
        const status = await mkrVault.delegationStatus(s.MKR.address)
        expect(status.delegatee).to.eq(ethers.constants.AddressZero, "delegatee not yet set")
        expect(status.delegated).to.eq(false, "delegated false")
    })

    it("Delegate", async () => {
        let balance = await s.MKR.balanceOf(mkrVault.address)
        expect(balance).to.not.eq(0, "mkrs not yet delegated")

        await mkrVault.connect(s.Bob).
            delegateMKRLikeTo(delegatee, s.mkrAddress)

        balance = await s.MKR.balanceOf(mkrVault.address)
        expect(balance).to.eq(0, "All mkrs delegated")
    })

    it("Verify status", async () => {
        const status = await mkrVault.delegationStatus(s.MKR.address)
        expect(status.delegatee).to.not.eq(ethers.constants.AddressZero, "delegatee set")
        expect(status.delegated).to.not.eq(false, "delegated true")
    })

    it("Elapse time", async () => {

        await hardhat_mine_timed(50, 15)
        await s.VaultController.calculateInterest()

        const status = await s.VaultController.checkVault(s.BobVaultID)
        expect(status).to.eq(false, "vault underwater")

    })

    it("Liquidate while delegated", async () => {
        //fund liquidator
        const bank = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
        await stealMoney(bank, s.Dave.address, s.USDC.address, BN("1000e6"))
        await s.USDC.connect(s.Dave).approve(s.USDI.address, await s.USDC.balanceOf(s.Dave.address))
        await s.USDI.connect(s.Dave).deposit(await s.USDC.balanceOf(s.Dave.address))

        //revert?
        await s.VaultController.connect(s.Dave).liquidateVault(s.BobVaultID, c.CappedMKR, BN("999999e18"))


    })

    it("Verify status", async () => {
        const status = await mkrVault.delegationStatus(s.MKR.address)
        expect(status.delegatee).to.eq(ethers.constants.AddressZero, "delegatee deleted")
        expect(status.delegated).to.eq(false, "delegated false")
    })

})


