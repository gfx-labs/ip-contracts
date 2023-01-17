import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    ChainlinkOracleRelay__factory,
    UniswapV3OracleRelay__factory,
    CurveMaster__factory,
    ThreeLines0_100__factory,
    OracleMaster__factory,
    OracleMaster,
    ProxyAdmin__factory,
    USDI__factory,
    VaultController__factory,
    ProxyAdmin,
    InterestProtocolToken,
    ITokenDelegator__factory
} from "../typechain-types";
import { TokenDelegatorStorage__factory } from "../typechain-types/factories/governance/token/TokenStorage.sol/TokenDelegatorStorage__factory";
import { InterestProtocolToken__factory } from "../typechain-types/factories/governance/token/TokenDelegator.sol/InterestProtocolToken__factory";
import { ceaseImpersonation, impersonateAccount } from "../util/impersonator";
import { s } from "../test/mainnet/scope";
import { reset } from "../util/block";
import { deploy } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { read } from "fs";

const { ethers, network, upgrades } = require("hardhat");

const IPTaddr = "0xd909C5862Cdb164aDB949D92622082f0092eFC3d"

const pool = "0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6"
const omAddr = "0x90a972d9b53659150F1412E885E27fb7c2E49110"
const wbtc = "0xa8A6d7c39270ddc658DC53ECbd0500a4C64C9Cc9"

const owner = ethers.provider.getSigner("0x958892b4a0512b28AaAC890FC938868BBD42f064")


/**
found OracleMaster at 0x90a972d9b53659150F1412E885E27fb7c2E49110
Live price:  295655760787400000000000000000000
Relays  0x4FdC91D86743C5A47A2739a1Abb9F85e589589AB
wbtc relay:  0x4FdC91D86743C5A47A2739a1Abb9F85e589589AB
found chainlinkRelay at 0x339a153B0dEa50f45821405F7b3deE9355B3769F
Chainlink value:  295655760787400000000000000000000
Anchor:  0xAC1Da37a0405E455b9fe271E8A6b99281a661027
Univ3 value:  294040003320381704797000000000000
 */



const upgrade = async (deployer:SignerWithAddress, IPT:InterestProtocolToken) => {

    console.log("UPGRADE")

    //deploy new implementation
    const factory = await ethers.getContractFactory("InterestProtocolTokenDelegate")
    const implementation = await factory.deploy()
    console.log("implementaion deployed to: ", implementation.address)

    //upgrade
    
    let readOwner = await IPT.owner()
    console.log("Owner: ", readOwner)


    await IPT.connect(deployer)._setImplementation(implementation.address)
    
    //verify
    console.log("Upgrade complete")

}


async function main() {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    
    //await reset(16428171)


    console.log("Contract upgrade complete")


    const CharlieDelegator = "0x3389d29e457345e4f22731292d9c10ddfc78088f"

    const VaultController = await new VaultController__factory(deployer).attach("0x385E2C6b5777Bc5ED960508E774E4807DDe6618c")
    const USDi = await new USDI__factory(deployer).attach("0x203c05ACb6FC02F5fA31bd7bE371E7B213e59Ff7")
    const ProxyAdmin = await new ProxyAdmin__factory(deployer).attach("0xafDBA0899A00ca07D36d019eF7649803b70a9c08")
    const Curve = await new CurveMaster__factory(deployer).attach("0x52b2De5e0b5A9B2aF71FF61F1ef2EFB89d2138Af")

    const IPT = await new InterestProtocolToken__factory(deployer).attach(IPTaddr)
    console.log("Got contracts")
    await upgrade(deployer, IPT)


    const result = await IPT.connect(deployer)._setOwner("0x266d1020A84B9E8B0ed320831838152075F8C4cA")    
    const receipt = await result.wait()

    console.log("Owner is now ", await IPT.owner())

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
