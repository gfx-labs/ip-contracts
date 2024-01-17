import { s } from "../scope";
import { expect } from "chai";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator";

import {
  IVault__factory, InterestProtocolToken__factory,
  InterestProtocolTokenDelegate__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory,
  BPTstablePoolOracle__factory,
  IOracleRelay,
  VaultController__factory,
  OracleMaster__factory
} from "../../../../typechain-types";
import {
  mineBlock, currentBlock, hardhat_mine, fastForward
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";
import { ethers } from "hardhat";
import { ProposalContext } from "../../../../scripts/proposals/suite/proposal";
import { MainnetBPTaddresses, a, d } from "../../../../util/addresser"
import { BN } from "../../../../util/number";
import { showBody, showBodyCyan } from "../../../../util/format";
import { BigNumber } from "ethers";
import { IERC20 } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { IERC20__factory } from "../../../../typechain-types/factories/contracts/IPTsale/SlowRoll.sol";

describe("Perform Upgrade", () => {

  let updatedOracle: IOracleRelay
  const addrs = new MainnetBPTaddresses()
  let bpt: IERC20

  it("Deploy new oracle", async () => {
    //get data for existing deploy
    let poolAddress: string
    let balancerVault: string
    let tokens: string[] = [a.wstethAddress, a.wethAddress]
    let oracles: string[]
    let num: BigNumber
    let den: BigNumber

    const oracle = BPTstablePoolOracle__factory.connect(addrs.B_stETH_STABLEPOOL_ORACLE, s.Frank)
    poolAddress = await oracle._priceFeed()
    balancerVault = await oracle.VAULT()
    oracles = [await oracle.assetOracles(tokens[0]), await oracle.assetOracles(tokens[1])]
    num = await oracle._widthNumerator()
    den = await oracle._widthDenominator()

    updatedOracle = await new BPTstablePoolOracle__factory(s.Frank).deploy(
      poolAddress,
      balancerVault,
      tokens,
      oracles,
      num,
      den
    )
    await updatedOracle.deployed()

    //new oracle reads price successfully
    showBodyCyan("PRICE: ", await toNumber(await updatedOracle.currentValue()))

    bpt = IERC20__factory.connect("0x32296969Ef14EB0c6d29669C550D4a0449130230", s.Frank)
    showBody("Total Supply: ", await toNumber(await bpt.totalSupply()))
  })


  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
  const proposer = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"//"0x5fee8d7d02B0cfC08f0205ffd6d6B41877c86558"
  const whale = "0x5fee8d7d02B0cfC08f0205ffd6d6B41877c86558"
  const prop = ethers.provider.getSigner(proposer)
  let proposalId: number
  let out: any
  it("setup the proposal", async () => {


    await impersonateAccount(proposer)

    const proposal = new ProposalContext("update bpt oracle")

    const updateOracle = await new OracleMaster__factory(prop).
      attach(d.Oracle).populateTransaction.
      setRelay(
        addrs.CappedB_stETH_STABLE,
        updatedOracle.address
      )

    proposal.addStep(updateOracle, "setRelay(address,address)")


    await ceaseImpersonation(proposer)
    out = proposal.populateProposal()

  })

  it("propose, queue, execute", async () => {
    let gov: GovernorCharlieDelegate = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    )
    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()
    const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)

    await impersonateAccount(proposer)
    await gov.connect(prop).propose(
      out.targets,
      out.values,
      out.signatures,
      out.calldatas,
      "upgrade",
      false
    )
    proposalId = Number(await gov.proposalCount())

    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber())

    //proposer votes
    await gov.connect(prop).castVote(proposalId, 1)

    //whale votes to get enough votes to pass
    await impersonateAccount(whale)
    const whaleVoter = ethers.provider.getSigner(whale)
    await gov.connect(whaleVoter).castVote(proposalId, 1)
    await ceaseImpersonation(whale)

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber())

    await gov.connect(prop).queue(proposalId)

    await fastForward(timelock.toNumber())

    //price read should revert before execution
    await expect(s.Oracle.getLivePrice(addrs.CappedB_stETH_STABLE)).to.be.reverted

    await gov.execute(proposalId)

    await ceaseImpersonation(proposer)

  })

  it("Verify", async () => {

    //we should get a good price now
    showBodyCyan("Price: ", await toNumber(await s.Oracle.getLivePrice(addrs.CappedB_stETH_STABLE)))

  })

})