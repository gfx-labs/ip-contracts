import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  CurveMaster__factory,
  ThreeLines0_100__factory,
} from "../typechain-types";

const { ethers, network, upgrades } = require("hardhat");

async function sleep(milliseconds: number) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if (new Date().getTime() - start > milliseconds) {
      break;
    }
  }
}

const deployCharlie = async (deployer: SignerWithAddress) => {

  const govAddress = "0xF5010a6787EF0ee6669D646Ea227b6E03f8974a2"
  const IPTAddress = "0x416a2337D150D01C4656D6232E2d2abe959D4654"

   const InterestProtocolTokenDelegateFactory = await ethers.getContractFactory(
    "InterestProtocolTokenDelegate"
  );

  const IPTdelegate = InterestProtocolTokenDelegateFactory.attach(IPTAddress);

  const IPTfactory = await ethers.getContractFactory("InterestProtocolToken");

  const charlieFactory = await ethers.getContractFactory("GovernorCharlieDelegator");
  
};

async function main() {
  //enable this for testing on hardhat network, disable for testnet/mainnet deploy
  //await network.provider.send("evm_setAutomine", [true])

  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  console.log("Deployer: ", deployer.address);

  await deployProtocol(deployer);
  await sleep(15000);
  await deployCharlie(deployer);

  console.log("Contracts deployed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
