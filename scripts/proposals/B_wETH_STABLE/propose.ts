import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, OracleMaster__factory,
    ProxyAdmin__factory,
    VaultController__factory,
    VotingVaultController__factory
} from "../../../typechain-types"
import { ProposalContext } from "../suite/proposal"
import { d } from "../DeploymentInfo"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { showBody, showBodyCyan } from "../../../util/format"
import * as fs from 'fs'
import { currentBlock, fastForward, hardhat_mine, resetCurrent } from "../../../util/block"
import hre from 'hardhat'
const { ethers, network } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

/**
 * Use this script to make the proposal
 * Deployment of the Cap stEthSTABLE proxy and Anchored View Relay should already be complete
 * and testing with these deployments should have been done
 * 
 * If the first param proposeFromScript == false, the hex data that is output to the console
 * can be pasted into MetaMask as hex data 
 * when sending a transaction to Interest Protocol Governance 0x266d1020A84B9E8B0ed320831838152075F8C4cA
 * 
 * If proposeFromScript is true, the private key of the proposer must be
 * in .env as PERSONAL_PRIVATE_KEY=42bb...
 */

/*****************************CHANGE THESE/*****************************/
const proposeFromScript = true //IF TRUE, PRIVATE KEY MUST BE IN .env as PERSONAL_PRIVATE_KEY=42bb...
const CappedB_stETH_STABLE = "0x7d3CD037aE7efA9eBed7432c11c9DFa73519303d"
const B_stETH_STABLEPOOL_ORACLE = "0xD6B002316D4e13d2b7eAff3fa5Fc6c20D2CeF4be"
const B_stETH_STABLE = "0x32296969Ef14EB0c6d29669C550D4a0449130230"
const vvcImplementation = "0x17B7bD832666Ac28A6Ad35a93d4efF4eB9A07a17"
const rewardsAddress = "0x59D66C58E83A26d6a0E35114323f65c3945c89c1"
const booster = "0xA57b8d98dAE62B26Ec3bcC4a365338157060B234"
const auraBalAddr = "0x616e8BfA43F920657B3497DBf40D6b1A02D4608d"
const PID = "115"
const stEthSTABLE_LiqInc = BN("8e16")
const stEthSTABLE_LTV = BN("60e16")

const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"


const proposestEthSTABLE = async (proposer: SignerWithAddress) => {
    let gov: GovernorCharlieDelegate
    gov = new GovernorCharlieDelegate__factory(proposer).attach(
        govAddress
    )

    const proposal = new ProposalContext("B-stETH-STABLE")

    //upgrade VVC
    const upgradeVVC = await new ProxyAdmin__factory(proposer).
        attach(d.ProxyAdmin).
        populateTransaction.upgrade(
            d.VotingVaultController,
            vvcImplementation
        )

    const addOracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            CappedB_stETH_STABLE,
            B_stETH_STABLEPOOL_ORACLE
        )

    const list = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            CappedB_stETH_STABLE,
            stEthSTABLE_LTV,
            CappedB_stETH_STABLE,
            stEthSTABLE_LiqInc
        )

    const register_VVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            B_stETH_STABLE,
            CappedB_stETH_STABLE
        )

    //first time setup for VotingVault controller for BPTs
    const registerAuraBal = await new VotingVaultController__factory(proposer).
        attach(d.VotingVaultController).
        populateTransaction.registerAuraBal(auraBalAddr)

    const registerAuraBooster = await new VotingVaultController__factory(proposer).attach(d.VotingVaultController).
        populateTransaction.registerAuraBooster(booster)

    const populateAuraLpData = await new VotingVaultController__factory(proposer).attach(d.VotingVaultController).
        populateTransaction.registerAuraLpData(B_stETH_STABLE, rewardsAddress, PID)



    proposal.addStep(upgradeVVC, "upgrade(address,address)")
    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(register_VVC, "registerUnderlying(address,address)")
    proposal.addStep(registerAuraBal, "registerAuraBal(address)")
    proposal.addStep(registerAuraBooster, "registerAuraBooster(address)")
    proposal.addStep(populateAuraLpData, "registerAuraLpData(address,address,uint256)")

    let out = proposal.populateProposal()

    const proposalText = fs.readFileSync('./scripts/proposals/B_wETH_STABLE/txt.md', 'utf8')



    const data = await gov.connect(proposer).populateTransaction.propose(
        out.targets,
        out.values,
        out.signatures,
        out.calldatas,
        proposalText,
        false
    )
    const prp = Number(await gov.proposalCount())
    console.log("Start count", prp)
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
            console.log("Testing execution")
            await quickTest(proposer, out)
        }
    } else {
        console.log("TRANSACTION DATA: \n", data.data)
    }
}

const quickTest = async (proposer: SignerWithAddress, out: any) => {
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

    await proposestEthSTABLE(proposer)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

