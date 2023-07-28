import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    CappedNonStandardToken__factory,
    CrossChainAccount__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, ILayer1Messenger, ILayer1Messenger__factory, OracleMaster__factory,
    ProxyAdmin__factory,
    VaultController__factory,
    VotingVaultController__factory
} from "../../../typechain-types"
import { ProposalContext } from "../suite/proposal"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { showBody, showBodyCyan } from "../../../util/format"
import * as fs from 'fs'
import { currentBlock, fastForward, hardhat_mine, reset, resetCurrent, resetCurrentOP } from "../../../util/block"
import hre from 'hardhat'
import { OptimisimAddresses, OptimisimDeploys, MainnetAddresses } from "../../../util/addresser";
import { BytesLike } from "ethers"
const a = new OptimisimAddresses()
const d = new OptimisimDeploys()
const m = new MainnetAddresses()
const { ethers, network } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

/*****************************CHANGE THESE/*****************************/
const proposeFromScript = true //IF TRUE, PRIVATE KEY MUST BE IN .env as PERSONAL_PRIVATE_KEY=42bb...
const SnxLTV = BN("70e16")
const SnxLiqInc = BN("75e15")


const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"

const proposestEthSTABLE = async (proposer: SignerWithAddress) => {
    console.log("STARTING")

    let gov: GovernorCharlieDelegate = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    )

    const proposal = new ProposalContext("SNX on OP")

    //set cap for cwBTC
    const setCapData = await new CappedNonStandardToken__factory().attach(d.CappedWbtc).populateTransaction
        .setCap(BN("190e18"))
    const setCapForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).populateTransaction.
        forward(d.CappedWbtc, setCapData.data!)
    const setCap = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, setCapForward.data!, 1000000)

    //set relay
    const addOracleData = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedSNX,
            d.SnxOracle
        )
    const addOracleForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).populateTransaction.
        forward(d.Oracle, addOracleData.data!)
    const addOracle = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, addOracleForward.data!, 1000000)

    //register erc20
    const listData = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            d.CappedSNX,
            SnxLTV,
            d.CappedSNX,
            SnxLiqInc
        )
    const listForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).
        populateTransaction.forward(d.VaultController, listData.data!)
    const list = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, listForward.data!, 1000000)

    //register vvc
    const registerData = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            a.snxAddress,
            d.CappedSNX
        )
    const registerForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).
        populateTransaction.forward(d.VotingVaultController, registerData.data!)
    const register = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, registerForward.data!, 1000000)

    proposal.addStep(setCap, "sendMessage(address,bytes,uint32)")
    proposal.addStep(addOracle, "sendMessage(address,bytes,uint32)")
    proposal.addStep(list, "sendMessage(address,bytes,uint32)")
    proposal.addStep(register, "sendMessage(address,bytes,uint32)")


    let out = proposal.populateProposal()

    const proposalText = fs.readFileSync('./scripts/proposals/SNX_OP/txt.md', 'utf8')

    if (proposeFromScript) {
        console.log("Sending proposal")
        console.log("Data: ", out)
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
    console.log("Testing execution")

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
        console.log("TEST PROPOSAL")
        await network.provider.send("evm_setAutomine", [true])
        //await resetCurrent()
        await reset(17696267)
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

    await proposestEthSTABLE(proposer)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

