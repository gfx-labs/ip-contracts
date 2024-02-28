import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    CrossChainAccount__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, ILayer1Messenger__factory, V3PositionValuator__factory
} from "../../../typechain-types"
import { ProposalContext } from "../suite/proposal"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { showBodyCyan } from "../../../util/format"
import * as fs from 'fs'
import path from 'path'
import { currentBlock, fastForward, hardhat_mine, reset } from "../../../util/block"
import hre from 'hardhat'
import { OptimisimAddresses, OptimisimDeploys, MainnetAddresses, od, d, a } from "../../../util/addresser"
import { getGas } from "../../../util/math"
import { listings } from "./poolData"

const { ethers, network } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
type poolData = {
    addr: string,
    oracle0: string,
    oracle1: string
}

/*****************************CHANGE THESE/*****************************/
const proposeFromScript = true //IF TRUE, PRIVATE KEY MUST BE IN .env as PERSONAL_PRIVATE_KEY=42bb...

const gasLimit = 1500000

const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"

const generate = async (listings: poolData[], proposer: SignerWithAddress) => {

    const proposal = new ProposalContext("Uni V3 listings")

    for (const pool of listings) {
        //console.log(pool)

        const registerPoolData = await new V3PositionValuator__factory(proposer).
            attach(od.V3PositionValuator).populateTransaction.registerPool(
                pool.addr,
                pool.oracle0,
                pool.oracle1
            )
        const registerPoolForward = await new CrossChainAccount__factory().attach(od.optimismMessenger).
            populateTransaction.forward(od.V3PositionValuator, registerPoolData.data!)
        console.log("Forward Data: ", registerPoolForward)
        const registerPool = await ILayer1Messenger__factory.connect(a.OPcrossChainMessenger, proposer).
            populateTransaction.sendMessage(od.optimismMessenger, registerPoolForward.data!, gasLimit)

        proposal.addStep(registerPool, "sendMessage(address,bytes,uint32)")
    }

    let out = proposal.populateProposal()

    return out
}

const makeProposal = async (proposer: SignerWithAddress) => {

    let gov: GovernorCharlieDelegate = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    )

    let out = await generate(listings, proposer)

    const proposalText = fs.readFileSync(path.resolve(__dirname, "./txt.md"), 'utf8')

    if (proposeFromScript) {
        //console.log("Sending proposal")
        //console.log("Data: ", out)
        const result = await gov.connect(proposer).propose(
            out.targets,
            out.values,
            out.signatures,
            out.calldatas,
            proposalText,
            false
        )
        const receipt = await result.wait()
        //console.log("Gas: ", await getGas(result))
        console.log("Proposal sent: ", receipt.transactionHash)
        const networkName = hre.network.name
        if (networkName == "hardhat" || networkName == "localhost") {
            //test execution if on test network 
            await quickTest(proposer, out)
        }
    } else {
        console.log("Populating proposal tx")
        const data = await gov.connect(proposer).populateTransaction.propose(
            out.targets,
            out.values,
            out.signatures,
            out.calldatas,
            proposalText,
            false
        )
        console.log("TRANSACTION DATA: \n", data.data)
    }
}

const quickTest = async (proposer: SignerWithAddress, out: any) => {
    //console.log("Testing execution")

    const gov = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    )

    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber())

    await gov.connect(proposer).castVote(proposal, 1)

    await ceaseImpersonation(proposerAddr)
    const whale = "0x5fee8d7d02B0cfC08f0205ffd6d6B41877c86558"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
    const prop = ethers.provider.getSigner(whale)
    await impersonateAccount(whale)
    await gov.connect(prop).castVote(proposal, 1)

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber())

    await gov.connect(prop).queue(proposal)

    await fastForward(timelock.toNumber())

    const result = await gov.connect(prop).execute(proposal)
    await result.wait()
    showBodyCyan("Gas to execute: ", await getGas(result))
    showBodyCyan("EXECUTION COMPLETE")

    await ceaseImpersonation(whale)

}

async function main() {

    let proposer: SignerWithAddress


    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST PROPOSAL")
        await network.provider.send("evm_setAutomine", [true])
        //await resetCurrent()
        await reset(18971281)
        const block = await currentBlock()
        console.log("reset to block ", block.number)
        await impersonateAccount(proposerAddr)
        console.log("Impersonated ", proposerAddr)
        proposer = ethers.provider.getSigner(proposerAddr)

    } else {
        const accounts = await ethers.getSigners()
        proposer = accounts[1]
        console.log("PROPOSING ON MAINNET AS: ", proposer.address)
    }

    await makeProposal(proposer)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

