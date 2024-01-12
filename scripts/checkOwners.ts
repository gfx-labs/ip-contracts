import { BN } from "../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    CappedNonStandardToken__factory,
    CrossChainAccount__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, ILayer1Messenger, ILayer1Messenger__factory, IOwner, IOwner__factory, OracleMaster__factory,
    ProxyAdmin__factory,
    VaultController__factory,
    VotingVaultController__factory
} from "../typechain-types"
import { ProposalContext } from "../suite/proposal"
import { impersonateAccount, ceaseImpersonation } from "../util/impersonator"
import { showBody, showBodyCyan } from "../util/format"
import * as fs from 'fs'
import { currentBlock, fastForward, hardhat_mine, reset, resetCurrent, resetCurrentOP } from "../util/block"
import hre from 'hardhat'
import { OptimisimAddresses, OptimisimDeploys, MainnetAddresses, MainnetDeploys, d, od } from "../util/addresser";
import { TransactionRequest } from "@ethersproject/providers"
import { BigNumber, Contract, Signer } from "ethers"

const { ethers, network } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const compAddr = "0x958892b4a0512b28AaAC890FC938868BBD42f064"



const testMainnet = async (user: SignerWithAddress) => {

    for (const cont in d) {
        const addr = d[cont]

        const contract: IOwner = IOwner__factory.connect(addr.toString(), user)
        //console.log(contract.address)
        console.log(await contract.owner())
    }


}

const testOP = async (user: SignerWithAddress) => {

    await resetCurrentOP()
    await impersonateAccount(compAddr)
    console.log("Impersonated ", compAddr)
    user = ethers.provider.getSigner(compAddr)

    console.log("Testing on OP")
    for (const cont in od) {
        const addr = od[cont]

        const contract: IOwner = IOwner__factory.connect(addr.toString(), user)
        //console.log(contract.address)
        console.log(await contract.owner())
    }


}

async function main() {

    let user: SignerWithAddress


    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST PROPOSAL")
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrent()
        //await reset(17696267)
        const block = await currentBlock()
        console.log("reset to block ", block.number)
        await impersonateAccount(compAddr)
        console.log("Impersonated ", compAddr)
        user = ethers.provider.getSigner(compAddr)

    } else {
        const accounts = await ethers.getSigners()
        user = accounts[1]
        console.log(`PROPOSING ON ${networkName} AS: `, user.address)
    }

    //await testMainnet(user)
    await testOP(user)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

//Proposal sent:  0x4ab79dd0fb8673e6b951494307644977da481b09e68ec7c51f0d6534ebd34a80