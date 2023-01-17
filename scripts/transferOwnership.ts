import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    InterestProtocolToken
} from "../typechain-types";
import { TokenDelegatorStorage__factory } from "../typechain-types/factories/governance/token/TokenStorage.sol/TokenDelegatorStorage__factory";
import { InterestProtocolToken__factory } from "../typechain-types/factories/governance/token/TokenDelegator.sol/InterestProtocolToken__factory";
import { ceaseImpersonation, impersonateAccount } from "../util/impersonator";
import { s } from "../test/mainnet/scope";
import { reset } from "../util/block";

import { toNumber } from "../util/math";

const { ethers, network, upgrades } = require("hardhat");

const IPTaddr = "0xd909C5862Cdb164aDB949D92622082f0092eFC3d"

const owner = ethers.provider.getSigner("0x958892b4a0512b28AaAC890FC938868BBD42f064")


const upgrade = async (deployer: SignerWithAddress, IPT: InterestProtocolToken) => {

    //deploy new implementation
    const factory = await ethers.getContractFactory("InterestProtocolTokenDelegate")
    const implementation = await factory.deploy()
    console.log("Implementation deployed to: ", implementation.address)

    //upgrade
    const result = await IPT.connect(deployer)._setImplementation(implementation.address)
    const receipt = await result.wait()

    //verify
    const readImpAddr = await IPT.implementation()
    console.log("Implementation read fr IPT: ", readImpAddr)

    return (receipt.confirmations > 0)

}


async function main() {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    //await reset(16428171)

    //await impersonateAccount(owner._address)

    const IPT = await new InterestProtocolToken__factory(deployer).attach(IPTaddr)
    console.log("Got contracts")

    const confirmed = await upgrade(deployer, IPT)
    console.log("Contract upgrade complete")

    if (confirmed) {
        const result = await IPT.connect(deployer)._setOwner("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
        const receipt = await result.wait()
        console.log("Transfered ownership")
    }

    //await ceaseImpersonation(owner._address)

    console.log("Owner is now ", await IPT.owner())

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
