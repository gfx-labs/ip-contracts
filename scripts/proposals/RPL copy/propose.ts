import { BN } from "../../../util/number"
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    OracleMaster__factory,
    VaultController__factory,
    MKRVotingVaultController__factory,
    CappedMkrToken__factory,
    ProxyAdmin__factory,
    VotingVaultController__factory
} from "../../../typechain-types"
import { ProposalContext } from "../suite/proposal"
import { a, c, d } from "../../../util/addresser"
import { currentBlock, fastForward, hardhat_mine, resetCurrent } from "../../../util/block"
import * as fs from 'fs'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { network } from "hardhat"
import hre from 'hardhat'
import { showBodyCyan } from "../../../util/format"
import { ceaseImpersonation } from "../../../util/impersonator"
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers"

const { ethers } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908" //account with proposal power

//if true: 
//proposerAddr must have proposal power
//if true && running on a live network:
//PRIVATE KEY MUST BE IN .env as PERSONAL_PRIVATE_KEY=42bb...
const proposeFromScript = true
const RPL_LTV = BN("6e17")
const RPL_LIQINC = BN("1e17")
const mkrCap = BN("1000e18")

const propose = async (proposer: SignerWithAddress) => {

    const proposal = new ProposalContext("MKR Listing and Contracts")

    const addOracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            c.CappedRPL,
            c.RplAnchorView
        )
    const list = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            c.CappedRPL,
            RPL_LTV,
            c.CappedRPL,
            RPL_LIQINC
        )
    const register = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            a.rplAddress,
            c.CappedRPL
        )

    const updateCap = await new CappedMkrToken__factory(proposer).attach(c.CappedMKR).
        populateTransaction.setCap(mkrCap)

    const upgrade = await new ProxyAdmin__factory(proposer).attach(d.ProxyAdmin).
        populateTransaction.upgrade(d.MKRVotingVaultController, d.MKRVotingVaultControllerImplementation)

    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(register, "registerUnderlying(address,address)")
    proposal.addStep(updateCap, "setCap(uint256)")
    proposal.addStep(upgrade, "upgrade(address,address)")


    let out = proposal.populateProposal()

    console.log(out)
    const proposalText = fs.readFileSync('./scripts/proposals/RPL/txt.md', 'utf8')

    let gov: GovernorCharlieDelegate
    gov = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    )

    const data = await gov.connect(proposer).populateTransaction.propose(
        out.targets,
        out.values,
        out.signatures,
        out.calldatas,
        proposalText,
        false
    )

    const networkName = hre.network.name
    if (proposeFromScript || networkName == "hardhat" || networkName == "localhost") {
        console.log("Sending proposal")
        const result = await gov.connect(proposer).propose(
            out.targets,
            out.values,
            out.signatures,
            out.calldatas,
            proposalText,
            false
        )
        const receipt = await result.wait()
        console.log("Proposal sent: ", receipt.transactionHash)
        if (networkName == "hardhat" || networkName == "localhost") {
            //test execution if on test network 
            console.log("Testing execution")
            await quickTest(proposer)
            console.log("TRANSACTION DATA: \n", data.data)

        }
    } else {
        console.log("TRANSACTION DATA: \n", data.data)
        //fs.writeFileSync('./scripts/proposals/MKR/proposalHexData.txt', JSON.stringify(data))
    }

}

const quickTest = async (proposer: SignerWithAddress) => {
    const gov = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    )

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
}


async function main() {
    let proposer: SignerWithAddress


    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrent()
        await impersonateAccount(proposerAddr)
        proposer = ethers.provider.getSigner(proposerAddr)
        console.log("TEST PROPOSAL AT BLOCK: ", await (await currentBlock()).number)

    } else {
        const accounts = await ethers.getSigners()
        proposer = accounts[1]
        console.log("PROPOSING ON MAINNET AS: ", proposer.address)
    }

    await propose(proposer)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
/**
{
  targets: [
    '0xf4818813045E954f5Dc55a40c9B60Def0ba3D477',
    '0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3',
    '0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2',
    '0xbb5578c08bC08c15AcE5cd09c6683CcCcB2A9148',
    '0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5'
  ],
  values: [ 0, 0, 0, 0, 0 ],
  signatures: [
    'setRelay(address,address)',
    'registerErc20(address,uint256,address,uint256)',
    'registerUnderlying(address,address)',
    'setCap(uint256)',
    'upgrade(address,address)'
  ],
  calldatas: [
    '0x0000000000000000000000006b68c5708daffd0393acc6a8cc92f8c2146346ae000000000000000000000000d3ced54e5f5d950b1b8711a178e4eab2de5db3ec',
    '0x0000000000000000000000006b68c5708daffd0393acc6a8cc92f8c2146346ae0000000000000000000000000000000000000000000000000853a0d2313c00000000000000000000000000006b68c5708daffd0393acc6a8cc92f8c2146346ae000000000000000000000000000000000000000000000000016345785d8a0000',
    '0x000000000000000000000000d33526068d116ce69f19a9ee46f0bd304f21a51f0000000000000000000000006b68c5708daffd0393acc6a8cc92f8c2146346ae',
    '0x00000000000000000000000000000000000000000000003635c9adc5dea00000',
    '0x000000000000000000000000491397f7eb6f5d9b82b15cecabff835ba31f217f0000000000000000000000007b6160a0c3963903c2a050c6637009e2c1c60137'
  ]
}
 */