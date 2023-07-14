import { BN } from "../../../util/number";
import {
    ThreeLines0_100__factory
} from "../../../typechain-types";

const { ethers, network, upgrades } = require("hardhat");


const newCurveData = {
    r0: BN("2000000000000000000"), //r1 - 200% - 2
    r1: BN("100000000000000000"),  //r2 - 10%  - 0.1
    r2: BN("5000000000000000"),    //r3 - 0.5% - 0.005
    s1: BN("250000000000000000"),  //s1 - 25%  - 0.25
    s2: BN("500000000000000000"),  //s2 - 50%  - 0.50
}



async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await network.provider.send("evm_setAutomine", [true])
    //await reset(15884974)


    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    //deploy new curve contract
    const newCurve = await new ThreeLines0_100__factory(deployer).deploy(
        newCurveData.r0,
        newCurveData.r1,
        newCurveData.r2,
        newCurveData.s1,
        newCurveData.s2
    )
    await newCurve.deployed()
    console.log("Curve deployed to: ", newCurve.address)

    //hh verify --network mainnet 0x482855c43a0869D93C5cA6d9dc9EDdF3DAE031Ea "2000000000000000000" "100000000000000000" "5000000000000000" "250000000000000000" "500000000000000000"

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
