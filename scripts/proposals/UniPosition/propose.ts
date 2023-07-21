import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, NftVaultController__factory, OracleMaster__factory,
    ProxyAdmin__factory,
    V3PositionValuator__factory,
    VaultController__factory,
    VotingVaultController__factory
} from "../../../typechain-types";
import { ProposalContext } from "../suite/proposal";
import { a, c, d } from "../../../util/addresser"
import { showBodyCyan } from "../../../util/format";
import * as fs from 'fs';
import { currentBlock, fastForward, hardhat_mine, resetCurrent } from "../../../util/block";
import hre from 'hardhat';
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { ceaseImpersonation } from "../../../util/impersonator";
import { run } from "./deploy"
const { ethers, network } = require("hardhat");

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

/*****************************CHANGE THESE/*****************************/
const proposerAddr = "0x958892b4a0512b28AaAC890FC938868BBD42f064"

//if true: 
//proposerAddr must have proposal power
//if true && running on a live network:
//PRIVATE KEY MUST BE IN .env as PERSONAL_PRIVATE_KEY=42bb...
const proposeFromScript = true

let PositionValuator = ""
let WrappedPosition = ""
let NftVaultController = ""
let newVcImplementation = ""

const POOL_ADDR = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD"
const nfpManagerAddr = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'

const LTV = BN("65e16")
const LiquidationIncentive = BN("8e16")



/***********************************************************************/

const proposeTOKEN = async (proposer: SignerWithAddress) => {
    const proposal = new ProposalContext("Wrapped Uni Position")

    const addOracle = await new OracleMaster__factory(proposer).
        attach(d.Oracle).
        populateTransaction.setRelay(
            WrappedPosition,
            PositionValuator
        )

    const list = await new VaultController__factory(proposer).
        attach(d.VaultController).
        populateTransaction.registerErc20(
            WrappedPosition,
            LTV,
            WrappedPosition,
            LiquidationIncentive
        )

    const registerNftController = await new NftVaultController__factory(proposer).
        attach(NftVaultController).
        populateTransaction.registerUnderlying(WrappedPosition, nfpManagerAddr)

    //upgrade vault controller
    const upgrade = await new ProxyAdmin__factory(proposer).attach(d.ProxyAdmin).
        populateTransaction.upgrade(d.VaultController, newVcImplementation)


    //set position wrapper on vault controller
    const setPositionWrapper = await new VaultController__factory(proposer).
        attach(d.VaultController).populateTransaction.
        setPositionWrapperAddress(WrappedPosition)
    
    const registerPool = await new V3PositionValuator__factory(proposer).
    attach(PositionValuator).populateTransaction.registerPool(
        POOL_ADDR,
        d.WBTCOracle,
        d.EthOracle
    )


    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerNftController, "registerUnderlying(address,address)")
    proposal.addStep(upgrade, "upgrade(address,address)")
    proposal.addStep(setPositionWrapper, "setPositionWrapperAddress(address)")
    proposal.addStep(registerPool, "registerPool(address,address,address)")

    let out = proposal.populateProposal()

    const proposalText = fs.readFileSync('./scripts/proposals/UniPosition/txt.md', 'utf8');

    let gov: GovernorCharlieDelegate;
    gov = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    );

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
        console.log(out)
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
        //fwriteFileSync('./scripts/proposals/MKR/proposalHexData.txt', JSON.stringify(data))
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
    showBodyCyan("Advancing a lot of blocks..")
    await hardhat_mine(votingDelay.toNumber())

    await gov.connect(proposer).castVote(proposal, 1)

    /**
     await ceaseImpersonation(proposerAddr)
    const whale = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
    const prop = ethers.provider.getSigner(whale)
    await impersonateAccount(whale)
    await gov.connect(prop).castVote(proposal, 1)
     */

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber())

    await gov.connect(proposer).queue(proposal)

    await fastForward(timelock.toNumber())

    const result = await gov.connect(proposer).execute(proposal)
    await result.wait()
    showBodyCyan("EXECUTION COMPLETE")

    //await ceaseImpersonation(whale)
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
        if (proposeFromScript) {
            console.log("PROPOSING ON MAINNET AS: ", proposer.address)
        } else {
            console.log("GENERATING PROPOSAL TRANSACTION DATA")
        }
    }

    await preDeployTesting(proposer)
    //await proposeTOKEN(proposer)

}

const preDeployTesting = async (proposer: SignerWithAddress) => {

    //this will deploy the things and then test the proposal in one go


    console.log("Running")
    const data = await run(proposer)
    PositionValuator = data[0]
    WrappedPosition = data[1]
    NftVaultController = data[2]
    newVcImplementation = data[3]

    console.log("Got data")

    //transfer ownerships
    const pv = new V3PositionValuator__factory(proposer).attach(PositionValuator)
    const nvc = new NftVaultController__factory(proposer).attach(NftVaultController)

    await pv.connect(proposer).transferOwnership(govAddress)
    await nvc.connect(proposer).transferOwnership(govAddress)

    await proposeTOKEN(proposer)


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

