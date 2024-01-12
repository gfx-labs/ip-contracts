import { BN } from "../../../util/number"
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    OracleMaster__factory,
    VaultController__factory,
    MKRVotingVaultController__factory,
    CappedMkrToken__factory,
    ProxyAdmin__factory,
    InterestProtocolTokenDelegate__factory,
    InterestProtocolToken__factory
} from "../../../typechain-types"
import { ProposalContext } from "../suite/proposal"
import { a, c, d } from "../../../util/addresser"
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
const proposerAddr = "0x5fee8d7d02B0cfC08f0205ffd6d6B41877c86558" //account with proposal power
const illegalAddr = "0x41173311aB332fb08d2B0bB9398aE6d178B3aDAf"
const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const newImpAddr = "0x387EedD357836A73eCEf07067E6360A95C254b17"
const existingImplementation = "0x384542D720A765aE399CFDDF079CBE515731F044"
//if true: 
//proposerAddr must have proposal power
//if true && running on a live network:
//PRIVATE KEY MUST BE IN .env as PERSONAL_PRIVATE_KEY=42bb...
const proposeFromScript = true


const propose = async (proposer: SignerWithAddress) => {
    
    const IPT = InterestProtocolTokenDelegate__factory.connect(d.IPT, proposer)
    const amount = await IPT.balanceOf(illegalAddr)

    const proposal = new ProposalContext("eminent domain")

    //set new implementation
    const setImp = await new InterestProtocolToken__factory(proposer).
      attach(d.IPT).
      populateTransaction._setImplementation(newImpAddr)

    //do the transfer
    const eminentDomain = await new InterestProtocolTokenDelegate__factory(proposer).
      attach(d.IPT).
      populateTransaction.eminentDomain(illegalAddr, governorAddress, amount)

    //revert to old implementation
    const revertImp = await new InterestProtocolToken__factory(proposer).
      attach(d.IPT).
      populateTransaction._setImplementation(existingImplementation)

    proposal.addStep(setImp, "_setImplementation(address)")
    proposal.addStep(eminentDomain, "eminentDomain(address,address,uint96)")
    proposal.addStep(revertImp, "_setImplementation(address)")


    let out = proposal.populateProposal()

    //console.log(out)
    const proposalText = fs.readFileSync('./scripts/proposals/iptFix/txt.md', 'utf8')

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

    const networkName = hre.network.name
    if (proposeFromScript || networkName == "hardhat" || networkName == "localhost") {
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
        if (networkName == "hardhat" || networkName == "localhost") {
            //test execution if on test network 
            console.log("Testing execution")
            await quickTest(proposer)
            console.log("TRANSACTION DATA: \n", data.data)

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

    /**
     *     await ceaseImpersonation(proposerAddr)

    const whale = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
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
/**
{
  targets: [
    '0xf4818813045E954f5Dc55a40c9B60Def0ba3D477',
    '0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3',
    '0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2',
    '0xbb5578c08bC08c15AcE5cd09c6683CcCcB2A9148',
    '0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5'
  ],
  values: [ 0, 0, 0, 0, 0 ],
  signatures: [
    'setRelay(address,address)',
    'registerErc20(address,uint256,address,uint256)',
    'registerUnderlying(address,address)',
    'setCap(uint256)',
    'upgrade(address,address)'
  ],
  calldatas: [
    '0x0000000000000000000000006b68c5708daffd0393acc6a8cc92f8c2146346ae000000000000000000000000d3ced54e5f5d950b1b8711a178e4eab2de5db3ec',
    '0x0000000000000000000000006b68c5708daffd0393acc6a8cc92f8c2146346ae0000000000000000000000000000000000000000000000000853a0d2313c00000000000000000000000000006b68c5708daffd0393acc6a8cc92f8c2146346ae000000000000000000000000000000000000000000000000016345785d8a0000',
    '0x000000000000000000000000d33526068d116ce69f19a9ee46f0bd304f21a51f0000000000000000000000006b68c5708daffd0393acc6a8cc92f8c2146346ae',
    '0x00000000000000000000000000000000000000000000003635c9adc5dea00000',
    '0x000000000000000000000000491397f7eb6f5d9b82b15cecabff835ba31f217f0000000000000000000000007b6160a0c3963903c2a050c6637009e2c1c60137'
  ]
}
 */