import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    IL2CrossDomainMessenger,
    IL2CrossDomainMessenger__factory,
    VaultController__factory
} from "../../../typechain-types"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { currentBlock, resetCurrentOP } from "../../../util/block"
import hre from 'hardhat'
import { OptimisimAddresses, OptimisimDeploys, MainnetAddresses, od } from "../../../util/addresser"
import { PopulatedTransaction } from "ethers"
import { smock } from "@defi-wonderland/smock";

const a = new OptimisimAddresses()
const d = new OptimisimDeploys()
const m = new MainnetAddresses()
const { ethers, network } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"

const listSNXdata: PopulatedTransaction = {
    data: '0x7158092600000000000000000000000045b265c7919d7fd8a0d673d7acaa8f5a7abb430d00000000000000000000000000000000000000000000000009b6e64a8ec6000000000000000000000000000045b265c7919d7fd8a0d673d7acaa8f5a7abb430d000000000000000000000000000000000000000000000000010a741a46278000',
    to: '0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85'
}

const listSNXForward: PopulatedTransaction = {
    data: '0x6fadcf7200000000000000000000000005498574bd0fa99eecb01e1241661e7ee58f8a85000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000847158092600000000000000000000000045b265c7919d7fd8a0d673d7acaa8f5a7abb430d00000000000000000000000000000000000000000000000009b6e64a8ec6000000000000000000000000000045b265c7919d7fd8a0d673d7acaa8f5a7abb430d000000000000000000000000000000000000000000000000010a741a4627800000000000000000000000000000000000000000000000000000000000',
    to: '0x48fa7528bFD6164DdF09dF0Ed22451cF59c84130'
}

//0x48fa7528bFD6164DdF09dF0Ed22451cF59c84130
const test = async (data: PopulatedTransaction) => {

    //mock the bridge contract 0x4200000000000000000000000000000000000007
    const mockFactory = await smock.mock('IL2CrossDomainMessenger')
    //const mock = mockFactory.deploy()
    //console.log(mock)
    //impersonate the bridge

    //call forward on the cca



   /**
 //impersonate crossChainAccount
    const cca = ethers.provider.getSigner(od.optimismMessenger)
    await impersonateAccount(cca._address)
    //console.log(data)

    //pass data to contract
    const vc = VaultController__factory.connect(od.VaultController, cca)
    console.log(vc.address)

    const owner = await vc.owner()
    console.log(owner)


    const args = {
        gasLimit: 0,
        gasPrice: 0,
        to: data.to,
        from: cca._address,
        value: 0,
        data: data.data
    }
    await cca.sendTransaction(args)



    //await cca.sendTransaction()


    //verify

    await ceaseImpersonation(cca._address)
    */

}

async function main() {

    let proposer: SignerWithAddress


    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST PROPOSAL")
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        const block = await currentBlock()
        console.log("Testing on OP @ block:", block.number)
        await impersonateAccount(proposerAddr)
        console.log("Impersonated ", proposerAddr)
        proposer = ethers.provider.getSigner(proposerAddr)

    } else {
        const accounts = await ethers.getSigners()
        proposer = accounts[1]
        console.log("PROPOSING ON MAINNET AS: ", proposer.address)
    }


    await test(listSNXdata)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

