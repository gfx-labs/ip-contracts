import { expect } from "chai"
import { network, ethers } from "hardhat"
import { stealMoney } from "../../../../util/money"
import { s } from "../scope"
import { MainnetCappedTokens, MainnetDeploys } from "../../../../util/addresser"
import { mineBlock, hardhat_mine_timed, currentBlock, hardhat_mine, fastForward, resetCurrent } from "../../../../util/block"
import {
    IERC20__factory,
    OracleMaster__factory,
    ProxyAdmin__factory,
    USDI__factory,
    MKRVotingVaultController__factory,
    VaultController__factory,
    IVOTE__factory, MKRVotingVaultController,
    MKRVotingVault,
    IVault__factory,
    MKRVotingVault__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    CappedMkrToken__factory,
    IOracleRelay,
    CappedGovToken__factory,
    UniswapV3TokenOracleRelay__factory,
    ChainlinkOracleRelay__factory,
    AnchoredViewRelay__factory,
    VotingVaultController__factory,
    VotingVault__factory
} from "../../../../typechain-types"
import { JsonRpcSigner } from "@ethersproject/providers"
import { BigNumber } from "ethers"
import { showBody, showBodyCyan } from "../../../../util/format"
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers"
import { ceaseImpersonation } from "../../../../util/impersonator"
import { BN } from "../../../../util/number"
import { toNumber } from "../../../../util/math"
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal"
import { DeployContract, DeployNewProxyContract } from "../../../../util/deploy"

require("chai").should()

const d = new MainnetDeploys()
const c = new MainnetCappedTokens()

let MKRVotingVaultController: MKRVotingVaultController

const mkrCap = BN("1000e18")
const rplCap = BN("21000e18")

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await resetCurrent()).to.not.throw
        console.log("Testing @ block: ", (await currentBlock()).number)
    })
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw
    })
})

describe("Initial Setup", () => {
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

describe("Deploy, Propose, Execute", async () => {

    let imp:string
    let gov: GovernorCharlieDelegate

    const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
    const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"
    let proposer: JsonRpcSigner

    let rplOracle: IOracleRelay
    const uniFeed = "0x632E675672F2657F227da8D9bB3fE9177838e726" //RPL/wETH @ 3k ~$30k liquidity 
    const clFeed = "0x4e155ed98afe9034b7a5962f6c84c86d869daa9d"
    const RPL_LTV = BN("6e17")
    const RPL_LIQINC = BN("1e17")



    before(async () => {
        proposer = ethers.provider.getSigner(proposerAddr)
        gov = new GovernorCharlieDelegate__factory(s.Frank).attach(
            govAddress
        )
        s.RPL = IERC20__factory.connect("0xB4EFd85c19999D84251304bDA99E90B92300Bd93", s.Frank)
    })

    it("Deploy capped RPL", async () => {

        s.CappedRPL = await DeployNewProxyContract(
            new CappedGovToken__factory(s.Frank),
            s.Frank,
            s.ProxyAdmin.address,
            c.CappedGovTokenImplementation,
            "Capped RPL",
            "cRPL",
            s.RPL.address,
            s.VaultController.address,
            d.VotingVaultController
        )
        await s.CappedRPL.deployed()

        await s.CappedRPL.setCap(rplCap)

    })

    it("Deploy oracle system for RPL", async () => {
        const anchor = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
            14400,
            uniFeed,
            false,
            BN("1"),
            BN("1")
        )
        await anchor.deployed()
        //showBodyCyan("anchor: ", await toNumber(await anchor.currentValue()))

        const main = await new ChainlinkOracleRelay__factory(s.Frank).deploy(
            clFeed,
            BN("1e10"),
            BN("1")
        )
        await main.deployed()
        //showBodyCyan("main: ", await toNumber(await main.currentValue()))

        rplOracle = await new AnchoredViewRelay__factory(s.Frank).deploy(
            anchor.address,
            main.address,
            BN("10"),
            BN("100")
        )
        await rplOracle.deployed()
        showBodyCyan("rplOracle: ", await toNumber(await rplOracle.currentValue()))
    })

    it("Deploy new implementation", async () => {
        //already deployed
        imp = d.MKRVotingVaultControllerImplementation
    })

    it("Make proposal", async () => {


        const proposal = new ProposalContext("RPL + Housekeeping")

        const addOracle = await new OracleMaster__factory(s.Frank).
            attach(d.Oracle).populateTransaction.
            setRelay(
                s.CappedRPL.address,
                rplOracle.address
            )

        const list = await new VaultController__factory(s.Frank).
            attach(s.VaultController.address).
            populateTransaction.registerErc20(
                s.CappedRPL.address,
                RPL_LTV,
                s.CappedRPL.address,
                RPL_LIQINC
            )

        const register = await new VotingVaultController__factory(s.Frank).
            attach(d.VotingVaultController).
            populateTransaction.registerUnderlying(
                s.RPL.address,
                s.CappedRPL.address
            )

        const updateCap = await new CappedMkrToken__factory(s.Frank).attach(c.CappedMKR).
            populateTransaction.setCap(mkrCap)

        const upgrade = await new ProxyAdmin__factory(s.Frank).attach(s.ProxyAdmin.address).
            populateTransaction.upgrade(s.MKRVotingVaultController.address, imp)

        proposal.addStep(addOracle, "setRelay(address,address)")
        proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
        proposal.addStep(register, "registerUnderlying(address,address)")
        proposal.addStep(updateCap, "setCap(uint256)")
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



let mkrVault: MKRVotingVault

const delegatee = "0x4C28d8402ac01E5d623e4A5438535369770Fe407"
let startBal: BigNumber

const MKR = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2"
describe("Verify", () => {
    before(async () => {
        s.VotingVaultController = VotingVaultController__factory.connect(d.VotingVaultController, s.Frank)
        s.CappedMKR = CappedMkrToken__factory.connect(c.CappedMKR, s.Frank)
        s.MKR = IERC20__factory.connect(s.mkrAddress, s.Frank)
        MKRVotingVaultController = MKRVotingVaultController__factory.connect(d.MKRVotingVaultController, s.Frank)
    })

    it("Verify mkr cap", async () => {
        const cap = await s.CappedMKR.getCap()
        expect(cap).to.eq(mkrCap, "Cap is set")
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

        await s.VotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
        s.BobVotingVault = VotingVault__factory.connect(await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID), s.Frank)

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

describe("Verify borrow power", async () => {

    const amount = BN("10e18")
    before(async () => {
        const minter = "0x167B4F090Ab1c8c0a7478bEdEe2A194c6B182e8D"
        await stealMoney(minter, s.Bob.address, s.RPL.address, amount)
    })

    it("deposit", async () => {

        const startBp = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

        await s.RPL.connect(s.Bob).approve(s.CappedRPL.address, amount)
        await s.CappedRPL.connect(s.Bob).deposit(amount, s.BobVaultID)

        const endBp = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

        const dif = endBp.sub(startBp)

        showBody("Borrow Power increase: ", await toNumber(dif))
    })
})



