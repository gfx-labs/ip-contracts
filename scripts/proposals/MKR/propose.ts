import { BN } from "../../../util/number"
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    OracleMaster__factory,
    VaultController__factory,
    MKRVotingVaultController__factory
} from "../../../typechain-types"
import { ProposalContext } from "../../../scripts/proposals/suite/proposal"
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
const TOKEN_LiqInc = BN("1e17")
const TOKEN_LTV = BN("70e17")

const propose = async (proposer: SignerWithAddress) => {

    const proposal = new ProposalContext("MKR Listing and Contracts")

    const addOracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            c.CappedMKR,
            c.MkrAnchorView
        )
    const list = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            c.CappedMKR,
            BN("70e16"),
            c.CappedMKR,
            BN("15e16")
        )
    const register = await new MKRVotingVaultController__factory().
        attach(d.MKRVotingVaultController).
        populateTransaction.registerUnderlying(
            a.mkrAddress,
            c.CappedMKR
        )

    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(register, "registerUnderlying(address,address)")

    let out = proposal.populateProposal()

    console.log(out)
    const proposalText = fs.readFileSync('./scripts/proposals/MKR/txt.md', 'utf8')

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

    if (proposeFromScript) {
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
        const networkName = hre.network.name
        if (networkName == "hardhat" || networkName == "localhost") {
            //test execution if on test network 
            console.log("Testing execution")
            await quickTest(proposer)
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
    '0x491397f7eb6f5d9B82B15cEcaBFf835bA31f217F'
  ],
  values: [ 0, 0, 0 ],
  signatures: [
    'setRelay(address,address)',
    'registerErc20(address,uint256,address,uint256)',
    'registerUnderlying(address,address)'
  ],
  calldatas: [
    '0x000000000000000000000000bb5578c08bc08c15ace5cd09c6683ccccb2a9148000000000000000000000000cf2fcd9b87113139e809d5f9ea6f4d571bb1c12a',
    '0x000000000000000000000000bb5578c08bc08c15ace5cd09c6683ccccb2a914800000000000000000000000000000000000000000000000009b6e64a8ec60000000000000000000000000000bb5578c08bc08c15ace5cd09c6683ccccb2a91480000000000000000000000000000000000000000000000000214e8348c4f0000',
    '0x0000000000000000000000009f8f72aa9304c8b593d555f12ef6589cc3a579a2000000000000000000000000bb5578c08bc08c15ace5cd09c6683ccccb2a9148'
  ]
}
//Proposal sent:  0xfab9b08df0a8034d8c9fa2b212c21cef2700c0783cc0e0e0fead6c06e50df932
 */