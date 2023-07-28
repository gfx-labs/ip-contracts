import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    CrossChainAccount__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, ILayer1Messenger, ILayer1Messenger__factory, NftVaultController__factory, OracleMaster__factory,
    ProxyAdmin__factory,
    V3PositionValuator__factory,
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
const LTV = BN("65e16")
const LiquidationIncentive = BN("8e16")

//tennative deploys on op
let PositionValuator = "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF"
let WrappedPosition = "0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00"
let NftVaultController = "0x4c5859f0F772848b2D91F1D83E2Fe57935348029"
let newVcImplementation = "0x5f3f1dBD7B74C6B46e8c44f98792A1dAf8d69154"

const POOL_ADDR = a.wETH_USDC_POOL
const nfpManagerAddr = a.nfpManager


const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"

const proposestEthSTABLE = async (proposer: SignerWithAddress) => {
    console.log("STARTING")

    let gov: GovernorCharlieDelegate = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    )

    const proposal = new ProposalContext("Uni V3 on OP")

    //set relay
    const addOracleData = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            WrappedPosition,
            PositionValuator
        )
    const addOracleForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).populateTransaction.
        forward(d.Oracle, addOracleData.data!)
    const addOracle = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, addOracleForward.data!, 1000000)

    //register erc20
    const listData = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            WrappedPosition,
            LTV,
            WrappedPosition,
            LiquidationIncentive
        )
    const listForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).
        populateTransaction.forward(d.VaultController, listData.data!)
    const list = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, listForward.data!, 1000000)

    //register nft controller
    const registerData = await new NftVaultController__factory(proposer).
        attach(NftVaultController).
        populateTransaction.registerUnderlying(WrappedPosition, nfpManagerAddr)
    const registerForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).
        populateTransaction.forward(NftVaultController, registerData.data!)
    const register = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, registerForward.data!, 1000000)

    //upgrade
    const upgradeData = await new ProxyAdmin__factory(proposer).attach(d.ProxyAdmin).
        populateTransaction.upgrade(d.VaultController, newVcImplementation)
    const upgradeForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).
        populateTransaction.forward(d.ProxyAdmin, upgradeData.data!)
    const upgrade = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, upgradeForward.data!, 1000000)

    //set position wrapper on vault controller
    const setPrData = await new VaultController__factory(proposer).
        attach(d.VaultController).populateTransaction.
        setPositionWrapperAddress(WrappedPosition)
    const setPrForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).
        populateTransaction.forward(d.VaultController, setPrData.data!)
    const setPositionWrapper = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, setPrForward.data!, 1000000)

    //register pool
    const registerPoolData = await new V3PositionValuator__factory(proposer).
        attach(PositionValuator).populateTransaction.registerPool(
            POOL_ADDR,
            d.wBtcOracle,
            d.EthOracle
        )
    const registerPoolForward = await new CrossChainAccount__factory().attach(d.optimismMessenger).
        populateTransaction.forward(PositionValuator, registerPoolData.data!)
    const registerPool = await ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer).
        populateTransaction.sendMessage(d.optimismMessenger, registerPoolForward.data!, 1000000)


    proposal.addStep(addOracle, "sendMessage(address,bytes,uint32)")
    proposal.addStep(list, "sendMessage(address,bytes,uint32)")
    proposal.addStep(register, "sendMessage(address,bytes,uint32)")
    proposal.addStep(upgrade, "sendMessage(address,bytes,uint32)")
    proposal.addStep(setPositionWrapper, "sendMessage(address,bytes,uint32)")
    proposal.addStep(registerPool, "sendMessage(address,bytes,uint32)")

    let out = proposal.populateProposal()

    const proposalText = fs.readFileSync('./scripts/proposals/UniPosition_OP/txt.md', 'utf8')

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
