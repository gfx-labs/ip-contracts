import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
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
import { currentBlock, fastForward, hardhat_mine, resetCurrent } from "../../../util/block"
import hre from 'hardhat'
import { OptimisimAddresses, OptimisimDeploys, MainnetAddresses } from "../../../util/addresser";
import { PromiseOrValue } from "../../../typechain-types/common"
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
    const L1Messenger: ILayer1Messenger = ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer)

    const proposal = new ProposalContext("SNX on OP - PAYLOAD")


    //get contract message payloads
    let abi = ["function setRelay(address token_address, address relay_address)"]
    let iface = new ethers.utils.Interface(abi)
    const addOracleMessage = iface.encodeFunctionData("setRelay", [a.snxAddress, d.CappedSNX])

    abi = ["function registerErc20(address token_address, uint256 LTV, address oracle_address, uint256 liquidationIncentive)"]
    iface = new ethers.utils.Interface(abi)
    const listMessage = iface.encodeFunctionData("registerErc20", [d.CappedSNX, SnxLTV, d.CappedSNX, SnxLiqInc])

    abi = ["function registerUnderlying(address underlying_address, address capped_token)"]
    iface = new ethers.utils.Interface(abi)
    const registerVvcMessage = iface.encodeFunctionData("registerUnderlying", [a.snxAddress, d.CappedSNX])

    //nest with calls to forward on the L2 messenger
    abi = ["function forward(address target, bytes memory data)"]
    iface = new ethers.utils.Interface(abi)
    const addOracleStep = iface.encodeFunctionData("forward", [d.Oracle, addOracleMessage])

    abi = ["function forward(address target, bytes memory data)"]
    iface = new ethers.utils.Interface(abi)
    const listStep = iface.encodeFunctionData("forward", [d.VaultController, listMessage])

    abi = ["function forward(address target, bytes memory data)"]
    iface = new ethers.utils.Interface(abi)
    const registerVVCStep = iface.encodeFunctionData("forward", [d.VotingVaultController, registerVvcMessage])



    //set up calls to L1 messenger that governance will actually call
    const addOracle = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).populateTransaction.
        sendMessage(
            d.optimismMessenger,
            addOracleStep,
            BN("10000000")
        )

    const list = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).populateTransaction.
        sendMessage(
            d.optimismMessenger,
            listStep,
            BN("10000000")
        )

    const registerVVC = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).populateTransaction.
        sendMessage(
            d.optimismMessenger,
            registerVVCStep,
            BN("10000000")
        )

    //set up steps for proposal
    proposal.addStep(addOracle, "sendMessage(address,bytes,uint256)")
    proposal.addStep(list, "sendMessage(address,bytes,uint256)")
    proposal.addStep(registerVVC, "sendMessage(address,bytes,uint256)")

    //test 


    
    const owner = ethers.provider.getSigner("0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89")
    await impersonateAccount(owner._address)


    const OracleMaster = await OracleMaster__factory.connect(d.Oracle, owner)
    console.log(await OracleMaster.owner())
    await OracleMaster.connect(owner).transferOwnership(d.optimismMessenger)





    await ceaseImpersonation(owner._address)
















    let out = proposal.populateProposal()

    const proposalText = fs.readFileSync('./scripts/proposals/SNX_OP/txt.md', 'utf8')

    console.log("Populating proposal tx")
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
        console.log("Proposal sent: ", receipt.transactionHash)
        const networkName = hre.network.name
        if (networkName == "hardhat" || networkName == "localhost") {
            //test execution if on test network 
            //await quickTest(proposer, out)
        }
    } else {
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


    const result = await gov.connect(prop).execute(proposal, {
        gasPrice: 200000000000,
        gasLimit: 2000000
    })
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
        await resetCurrent()
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

