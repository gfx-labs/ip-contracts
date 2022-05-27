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
    USDC_WBTC_CL: "0xa338e0492b2f944e9f8c0653d3ad1484f2657a37",
    USDC_UNI_POOL: "0x74d3c85df4dbd03c7c12f7649faa6457610e7604",
    USDC_ETH_POOL: "0x45dda9cb7c25131df268515131f647d726f50608",
    USDC_WBTC_POOL: "0x847b64f9d3a95e977d157866447a5c0a5dfa0ee5",
    USDC: "0xC5c4B3320A086422bee1c5428a284400C6488A0a",
    WETH: "0x46f7992A77caF17Ab423D831f2BB5A282948D885",
    WBTC: "0xDc99563e556AA258eF00C2f3B851B6154637AeB3",
    UNI: "0xde6bD5afCDCCA4dD5DA8e3904345Ed02dC735374",
    ProxyAdmin: "0xB7D159Ad9Fe300C6FB7384B8F188531071A89a85",
    VaultController: "0xF59F545142D3236F3db84BB15E6193e7f89a7c04",
    USDI: "0x1b23B531f7F176C30E0800D58EFC845660FA290E",
    Curve: "0x39809682546c37d4062ad8fC82fBC181b15fFce3",
    Oracle: "0xd5c997e2778cC290F44FD6FF87372BBC939305Bd",
    ThreeLines: "0xf73D63C3eB97389cB5A28C4aD5e8AC428cb16417",
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
