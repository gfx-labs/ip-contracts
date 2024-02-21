import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    CrossChainAccount__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, ILayer1Messenger__factory, InterestProtocolTokenDelegate__factory, OracleMaster__factory, V3PositionValuator__factory, VaultController__factory
} from "../../../typechain-types"
import { ProposalContext } from "../suite/proposal"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { showBodyCyan } from "../../../util/format"
import * as fs from 'fs'
import path from 'path'
import { currentBlock, hardhat_mine, hardhat_mine_timed, resetCurrent } from "../../../util/block"
import hre from 'hardhat'
import { od, d, a } from "../../../util/addresser"
import { getGas } from "../../../util/math"
import { BN } from "../../../util/number"

const { ethers, network } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"


/*****************************CHANGE THESE/*****************************/
const proposeFromScript = true //IF TRUE, PRIVATE KEY MUST BE IN .env as PERSONAL_PRIVATE_KEY=42bb...
const gasLimit = 1500000
const proposerAddr = "0x4a470942dd7A44c6574666F8BDa47ce33c19A601"//"0xa6e8772af29b29B9202a073f8E36f447689BEef6"//"0xe75358526Ef4441Db03cCaEB9a87F180fAe80eb9"//"0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"
const LTV = BN("94e16")
const newLTV = BN("3e17")//30% for wrapped v3 positions
const wrappedPositionPenalty = BN("80000000000000000")//8%, current penalty for wrapped position
const PENALTY = BN("5e16")

const delegate = async (prop: SignerWithAddress) => {

    const IPT = InterestProtocolTokenDelegate__factory.connect(d.IPT, prop)
    await impersonateAccount(proposerAddr)
    const signer = ethers.provider.getSigner(proposerAddr)
    await IPT.connect(signer).delegate(proposerAddr)
    await ceaseImpersonation(proposerAddr)

}

const makeProposal = async (proposer: SignerWithAddress) => {

    const proposal = new ProposalContext("")

    let gov: GovernorCharlieDelegate = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    )

    //set relay
    const setRelayData = await new OracleMaster__factory(proposer).
        attach(od.Oracle).populateTransaction.setRelay(
            od.CappedOAUSDC,
            od.UsdcStandardRelay
        )
    const setRelayForward = await new CrossChainAccount__factory().attach(od.optimismMessenger).
        populateTransaction.forward(od.Oracle, setRelayData.data!)
    console.log("Forward Data: ", setRelayForward)
    const setRelay = await ILayer1Messenger__factory.connect(a.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(od.optimismMessenger, setRelayForward.data!, gasLimit)

    //register erc20
    const registerData = await new VaultController__factory(proposer).
        attach(od.VaultController).populateTransaction.registerErc20(
            od.CappedOAUSDC,
            LTV,
            od.CappedOAUSDC,
            PENALTY
        )
    const registerForward = await new CrossChainAccount__factory().attach(od.optimismMessenger).
        populateTransaction.forward(od.VaultController, registerData.data!)
    console.log("Forward Data: ", registerForward)
    const register = await ILayer1Messenger__factory.connect(a.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(od.optimismMessenger, registerForward.data!, gasLimit)


    //reduce LTV on uni positions
    const updateData = await new VaultController__factory(proposer).
        attach(od.VaultController).populateTransaction.updateRegisteredErc20(
            od.WrappedPosition,
            newLTV,
            od.WrappedPosition,
            wrappedPositionPenalty
        )
    const updateForward = await new CrossChainAccount__factory().attach(od.optimismMessenger).
        populateTransaction.forward(od.VaultController, updateData.data!)
    console.log("Forward Data: ", updateForward)
    const update = await ILayer1Messenger__factory.connect(a.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(od.optimismMessenger, updateForward.data!, gasLimit)

    //housekeeping - update scaling for usdc oracle used in Uni v3 position valuation
    const registerPoolData = await new V3PositionValuator__factory(proposer).
        attach(od.V3PositionValuator).populateTransaction.registerPool(
            "0x85149247691df622eaF1a8Bd0CaFd40BC45154a9",
            od.EthOracle,
            od.UsdcRelay//we are simply toggleing this pool off in the first tx
        )
    const registerPoolForward = await new CrossChainAccount__factory().attach(od.optimismMessenger).
        populateTransaction.forward(od.V3PositionValuator, registerPoolData.data!)
    console.log("Forward Data: ", registerPoolForward)
    const registerPool = await ILayer1Messenger__factory.connect(a.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(od.optimismMessenger, registerPoolForward.data!, gasLimit)

    
    //need a second step, as the first will only toggle this pool off
    const registerPoolDataAgain = await new V3PositionValuator__factory(proposer).
        attach(od.V3PositionValuator).populateTransaction.registerPool(
            "0x85149247691df622eaF1a8Bd0CaFd40BC45154a9",
            od.EthOracle,
            od.UsdcStandardRelay//now we set the correct updated oracle as we toggle the pool back on
        )
    const registerPoolForwardAgain = await new CrossChainAccount__factory().attach(od.optimismMessenger).
        populateTransaction.forward(od.V3PositionValuator, registerPoolDataAgain.data!)
    console.log("Forward Data: ", registerPoolForwardAgain)
    const registerPoolAgain = await ILayer1Messenger__factory.connect(a.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(od.optimismMessenger, registerPoolForwardAgain.data!, gasLimit)

    proposal.addStep(setRelay, "sendMessage(address,bytes,uint32)")
    proposal.addStep(register, "sendMessage(address,bytes,uint32)")
    proposal.addStep(update, "sendMessage(address,bytes,uint32)")
    proposal.addStep(registerPool, "sendMessage(address,bytes,uint32)")
    proposal.addStep(registerPoolAgain, "sendMessage(address,bytes,uint32)")//need a second step, as the first will only toggle this pool off

    const out = proposal.populateProposal()
    const proposalText = fs.readFileSync(path.resolve(__dirname, "./txt.md"), 'utf8')

    if (proposeFromScript) {
        console.log("Sending proposal...")
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
    await hardhat_mine_timed(timelock.toNumber(), 1)
    await hardhat_mine_timed(50, 2)
    //await fastForward(timelock.toNumber())
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
        await resetCurrent()
        const block = await currentBlock()
        console.log("reset to block ", block.number)

        proposer = ethers.provider.getSigner(proposerAddr)
        await delegate(proposer)
        await impersonateAccount(proposerAddr)
        console.log("Impersonated ", proposerAddr)

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

