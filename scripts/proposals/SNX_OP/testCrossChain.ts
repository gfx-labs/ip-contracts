import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
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

    const L1Messenger: ILayer1Messenger = ILayer1Messenger__factory.connect(m.OPcrossChainMessenger, proposer)

    const crossChainAccount = await new FromL1_ControlL2Greeter__factory(proposer).
        deploy(m.OPcrossChainMessenger, d.Oracle)

    //const result = await crossChainAccount.sendMessage()
    //showBody("result: ", result)

    const setRelayBytes = "0xd083a5a5000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000002a30786438323834333035623532304646353438366162373138444264666534366631383435346165444500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a30783435623236356337393139443746443861304436373344374143614138463541376162623433304400000000000000000000000000000000000000000000"

    //get contract message payloads
    let abi = ["function setRelay(address token_address, address relay_address)"]
    let iface = new ethers.utils.Interface(abi)
    const addOracleMessage = iface.encodeFunctionData("setRelay", [d.CappedSNX, d.SnxOracle])
    const ethersEncodeBytes = "0xd083a5a50000000000000000000000008700daec35af8ff88c16bdf0418774cb3d7599b400000000000000000000000045b265c7919d7fd8a0d673d7acaa8f5a7abb430d"


    const addOracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedSNX,
            d.SnxOracle
        )

    console.log(addOracle)


    await L1Messenger.sendMessage(
        d.Oracle,
        addOracle.data!,
        1000000
    )




    //test by sending bytes to the deployed contract on op

    await resetCurrentOP()
    const block = await currentBlock()
    console.log("Switched to OP as of block: ", block.number)
    const owner = await ethers.provider.getSigner("0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89")
    await impersonateAccount(owner._address)

    const oracle = OracleMaster__factory.connect(d.Oracle, owner)
    const startResult = await oracle._relays(d.CappedSNX)
    console.log("Start result: ", startResult)
    //await oracle.connect(owner).setRelay()


    const tx = {
        to: d.Oracle,
        value: BN("0"),
        data: addOracle.data
    }

    await owner.sendTransaction(tx)

    await hardhat_mine_timed(5, 2)

    const endResult = await oracle._relays(d.CappedSNX)
    console.log("End result: ", endResult)



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

