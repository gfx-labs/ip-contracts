import { s } from "./scope"
import { expect, assert } from "chai"
import { showBody, showBodyCyan } from "../../../util/format"
import { BN } from "../../../util/number"
import { currentBlock, mineBlock } from "../../../util/block"
import { toNumber } from "../../../util/math"
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy"
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";

import { AnchoredViewRelay__factory, CappedGovToken__factory, ChainlinkOracleRelay__factory, GovernorCharlieDelegate, GovernorCharlieDelegate__factory, IOracleRelay, OracleMaster__factory, ProxyAdmin__factory, UniswapV3OPTokenOracleRelay__factory, UniswapV3TokenOracleRelay__factory, VaultController__factory, VotingVaultController__factory } from "../../../typechain-types"
import { ethers } from "hardhat";

let snxOracle: IOracleRelay

/**
 * Deploy contracts on op
 * Make proposal on mainnet 
 * Proposal sends hex data for proposal to the L1 op messenger 0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1 ? 
 */

describe("Deploy Cap Tokens and Oracles", () => {

    it("Deploy Capped SNX", async () => {
        s.CappedSNX = await DeployContractWithProxy(
            new CappedGovToken__factory(s.Frank),
            s.Frank,
            s.ProxyAdmin,
            "CappedSNX",
            "cSNX",
            s.snxAddress,
            s.d.VaultController,
            s.d.VotingVaultController
        )
        await s.CappedSNX.deployed()
        await s.CappedSNX.setCap(s.SnxCap)
    })

    it("Deploy oracle system", async () => {
        const clFeed = await new ChainlinkOracleRelay__factory(s.Frank).deploy(
            s.SNX_CL_FEED,
            BN("1e10"),
            BN("1")
        )
        await clFeed.deployed()
        //showBodyCyan("cl price: ", await toNumber(await clFeed.currentValue()))

        const uniFeed = await new UniswapV3OPTokenOracleRelay__factory(s.Frank).deploy(
            500,
            s.d.EthOracle,
            s.SNX_UNI_POOL,
            true,
            BN("1"),
            BN("1")
        )
        await uniFeed.deployed()
        //showBodyCyan("uni price: ", await toNumber(await uniFeed.currentValue()))

        snxOracle = await new AnchoredViewRelay__factory(s.Frank).deploy(
            uniFeed.address,
            clFeed.address,
            BN("10"),
            BN('100')
        )
        await snxOracle.deployed()
        showBodyCyan("SNX oracle price: ", await toNumber(await snxOracle.currentValue()))
    })
})

describe("Propose, Vote, Queue, and Execute proposal", () => {
    const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
    const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
    const prop = ethers.provider.getSigner(proposer)

    let gov: GovernorCharlieDelegate;

    let proposal: number

    let out: any

    before(async () => {
        gov = new GovernorCharlieDelegate__factory(prop).attach(
            governorAddress
        )
    })

    it("make the proposal", async () => {
        const proposal = new ProposalContext("SNX ON OP")

        const addOracle = await new OracleMaster__factory(prop).
            attach(s.Oracle.address).
            populateTransaction.setRelay(
                s.CappedSNX.address,
                snxOracle.address
            )

        const list = await new VaultController__factory(prop).
            attach(s.VaultController.address).
            populateTransaction.registerErc20(
                s.CappedSNX.address,
                s.SnxLTV,
                s.CappedSNX.address,
                s.SnxLiqInc
            )

        const register_VVC = await new VotingVaultController__factory(prop).
            attach(s.VotingVaultController.address).
            populateTransaction.registerUnderlying(
                s.snxAddress,
                s.CappedSNX.address
            )
        proposal.addStep(addOracle, "setRelay(address,address)")
        proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
        proposal.addStep(register_VVC, "registerUnderlying(address,address)")
        out = proposal.populateProposal()

    })

    it("propose, vote, queue, and execute", async () => {
        const votingPeriod = await gov.votingPeriod()
        const votingDelay = await gov.votingDelay()
        const timelock = await gov.proposalTimelockDelay()

        showBody(timelock)

    })

})