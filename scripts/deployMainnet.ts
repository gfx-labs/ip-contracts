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
    USDC_UNI_CL: "0x553303d460EE0afB37EdFf9bE42922D8FF63220e",
    USDC_ETH_CL: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
    USDC_WBTC_CL: "0xf4030086522a5beea4988f8ca5b36dbc97bee88c",
    USDC_UNI_POOL: "0xD0fC8bA7E267f2bc56044A7715A489d851dC6D78",
    USDC_ETH_POOL: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
    USDC_WBTC_POOL: "0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  };

  const d = new Deployment(deployer, info);
  await d
    .ensure()
    .then(() => {
      console.log("Contracts deployed");
    })
    .catch((e) => {
      console.log(e);
    });

  console.log(d.Info);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
