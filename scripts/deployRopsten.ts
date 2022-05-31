import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Deployment, DeploymentInfo } from "./deployment/deployment";
import {
  CurveMaster__factory,
  OracleMaster__factory,
  ThreeLines0_100__factory,
  UniswapV3OracleRelay__factory,
  VaultController__factory,
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

//ropsten addresses

async function main() {
  //enable this for testing on hardhat network, disable for testnet/mainnet deploy
  //await network.provider.send("evm_setAutomine", [true])

  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  console.log("Deployer: ", deployer.address);
  let info: DeploymentInfo = {
    USDC: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
    WETH: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
    UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    WBTC: "0x442Be68395613bDCD19778e761f03261ec46C06D",
    USDC_UNI_POOL: "0xee815CDC6322031952a095C6cc6FEd036Cb1F70d",
    USDC_ETH_POOL: "0xee815CDC6322031952a095C6cc6FEd036Cb1F70d",
    USDC_WBTC_POOL: "0x4Fb7Ad8ebBEd0cb2877E8908E9EFb180F8208E08",
    ProxyAdmin: "0xF00a28c82735DB37a133E16ed2859549868983Ec",
    VaultController: "0x9ebd1DB32790b8D7a9dd3ccd5ebe191A7EA8Ec8D",
    USDI: "0x12F4E7C4E7993d724eaC73eF99f2Fca36F1FA921",
    EthOracle: "0xCB7B3EA1F8aDe7e1281f66701B10cA792f8c70a9",
    Curve: "0x15B7D3D7795442CcC923D709201ac826521EB38b",
    Oracle: "0xEef7c040FA40B2d03Ba17E5cE2277b324969b78b",
    ThreeLines: "0x1bCFe05d326d1BbC9D5e7CB2385a9cC1A02E051e",
    UniOracle: "0xa9e08769Ba8fC02e2790D9422ad2321d455D3646",
  };

  const d = new Deployment(deployer, info);
  await d.ensure();
  console.log("Contracts deployed");
  console.log(info);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
