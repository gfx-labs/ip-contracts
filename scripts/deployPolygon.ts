import { Deployment, DeploymentInfo } from "./deployment/deployment";

const { ethers } = require("hardhat");

async function sleep(milliseconds: number) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if (new Date().getTime() - start > milliseconds) {
      break;
    }
  }
}

async function main() {
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  console.log("Deployer: ", deployer.address);
  let info: DeploymentInfo = {
    USDC_UNI_CL: "0xdf0fb4e4f928d2dcb76f438575fdd8682386e13c",
    USDC_ETH_CL: "0xf9680d99d6c9589e2a93a78a04a279e509205945",
    USDC_WBTC_CL: "0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6",
    USDC_UNI_POOL: "0x74d3c85df4dbd03c7c12f7649faa6457610e7604",
    USDC_ETH_POOL: "0x45dda9cb7c25131df268515131f647d726f50608",
    USDC_WBTC_POOL: "0x847b64f9d3a95e977d157866447a5c0a5dfa0ee5",
    USDC: "0x11C953690E50060cE1926F0bD1712E12FD814593",
    WETH: "0x4cC3289720e447534a611ce6D44c9Da3028a5c3e",
    WBTC: "0x2D37b5B78CdDc6eA7BeAC2ceeeaE0E66f287f57F",
    UNI: "0xcEE42719abBDeCc99F1d98C8A47E35610Ce31b10",
    ProxyAdmin: "0x7c21f5a54B4E6A9f5A8898e292ec336cf8A9871a",
    VaultController: "0xC11E1107Bc49dd077034032E91EA2481d8bAA19D",
    USDI: "0x711771cddf715064d14005dbeeF91203aFF72c28",
    Curve: "0xfA3BD58D53c8a72A965418F282E7699d4f292afa",
    ThreeLines: "0x9dD3F00FfeC833B231374aaf042324973fD73335",
    Oracle: "0x5a9855c6813ABd110DFF5A3B3EEb07200F5715D5",
    EthOracle: "0xBbBFb84b345021905AD2cf4C41A3C91C98718f57",
    UniOracle: "0x4Bf87FA180DeD055BCc76B387d0d52b66001C7fC",
    WBTCOracle: "0x6eFC9A84CF7e66F767AcbBB7C8e17dDF6BCC0f9D",
    CharlieDelegator: "0xF5010a6787EF0ee6669D646Ea227b6E03f8974a2",
    CharlieDelegate: "0x5ABFDcb41f5b02ff8AaB60f5d8e54a0A480B1f79",
    IPTDelegator: "0x416a2337D150D01C4656D6232E2d2abe959D4654",
    IPTDelegate: "0x31c0842494f35d701410fc53187b0599A880c9Da",
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
