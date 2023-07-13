import { BN } from "../../../util/number"
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    OracleMaster__factory,
    VaultController__factory,
    MKRVotingVaultController__factory
} from "../../../typechain-types"
import { ProposalContext } from "../../../scripts/proposals/suite/proposal"
import { d } from "../DeploymentInfo"
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
            d.CappedMKR,
            d.MKRAnchorView
        )
    const list = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            d.CappedMKR,
            BN("70e16"),
            d.CappedMKR,
            BN("15e16")
        )
    const register = await new MKRVotingVaultController__factory().
        attach(d.MKRVotingVaultController).
        populateTransaction.registerUnderlying(
            d.mkrAddress,
            d.CappedMKR
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
