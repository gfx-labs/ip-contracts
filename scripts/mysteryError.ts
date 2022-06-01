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
    OracleMaster
} from "../typechain-types";

const { ethers, network, upgrades } = require("hardhat");

const pool = "0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6"
const omAddr = "0x90a972d9b53659150F1412E885E27fb7c2E49110"
const wbtc = "0xa8A6d7c39270ddc658DC53ECbd0500a4C64C9Cc9"

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


async function main() {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    /**
     
    const oracle = new OracleMaster__factory(deployer).attach(omAddr)
    console.log(`found OracleMaster at ${omAddr}`);
    
    const livePrice = await oracle.getLivePrice(wbtc)
    console.log("Live price: ", livePrice.toString())

    const relay = await oracle._relays(wbtc)
    console.log("Relays ", relay)

    const wbtcRelay = new AnchoredViewRelay__factory(deployer).attach(relay)
    console.log("wbtc relay: ", wbtcRelay.address)

    //main addr - chain
    const mainAddr = await wbtcRelay._mainAddress()

    const chainlinkRelay = new ChainlinkOracleRelay__factory(deployer).attach(mainAddr)
    console.log(`found chainlinkRelay at ${chainlinkRelay.address}`);
    let currentValue = await chainlinkRelay.currentValue()
    console.log("Chainlink value: ", currentValue.toString())
     */

    //anchor addr - uni

    const wbtcRelay = new AnchoredViewRelay__factory(deployer).attach("0x4FdC91D86743C5A47A2739a1Abb9F85e589589AB")

    const anchor = await wbtcRelay._anchorRelay()

    const uniV3Relay = new UniswapV3OracleRelay__factory(deployer).attach(anchor)
    console.log("got uni relay: ", uniV3Relay.address)

    const pool = await uniV3Relay._pool()
    console.log("POOL: ", pool)
    const backup = "0x847b64f9d3A95e977D157866447a5C0A5dFa0Ee5"






    let currentValue = await uniV3Relay.currentValue()
    console.log("Univ3 value: ", currentValue.toString())


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
