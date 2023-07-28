import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    CrossChainAccount__factory,
    FromL1_ControlL2Greeter__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, ILayer1Messenger, ILayer1Messenger__factory, IOracleMaster__factory, OracleMaster__factory,
    ProxyAdmin__factory,
    VaultController__factory,
    VotingVaultController__factory
} from "../../../typechain-types"
import { ProposalContext } from "../suite/proposal"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { showBody, showBodyCyan } from "../../../util/format"
import * as fs from 'fs'
import { currentBlock, fastForward, hardhat_mine, hardhat_mine_timed, resetCurrent, resetCurrentOP } from "../../../util/block"
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

    await resetCurrentOP()
    const block = await currentBlock()
    console.log("Switched to OP as of block: ", block.number)
    const owner = await ethers.provider.getSigner("0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89")
    await impersonateAccount(owner._address)


    const testCrossChainAccount = await new CrossChainAccount__factory(owner).deploy(
        "0x4200000000000000000000000000000000000007",
        owner._address
    )
    await testCrossChainAccount.deployed()


    const addOracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedSNX,
            d.SnxOracle
        )

    const forward = await new CrossChainAccount__factory().attach(testCrossChainAccount.address).
        populateTransaction.forward(d.Oracle, addOracle.data!)
    console.log("Forward data: ", forward.data)

    /**
     const L1Messenger = ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, owner)
    await L1Messenger.sendMessage(
        d.optimismMessenger,
        forward.data!,
        1000000
    )
     */
     

    const oracle = OracleMaster__factory.connect(d.Oracle, owner)
    const startResult = await oracle._relays(d.CappedSNX)
    console.log("Start result: ", startResult)

    await oracle.connect(owner).transferOwnership(testCrossChainAccount.address)

    await hardhat_mine(1)

    const tx = {
        to: testCrossChainAccount.address,
        value: BN("0"),
        data: forward.data
    }

    //this will revert as we are not sending from the right place
    const result = await owner.sendTransaction(tx)

    const endResult = await oracle._relays(d.CappedSNX)
    console.log("End result: ", endResult)

    /**
     * This works
    const tx = {
        to: d.Oracle,
        value: BN("0"),
        data: addOracle.data
    }
    await owner.sendTransaction(tx)
    await hardhat_mine_timed(5, 2)
     */



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

