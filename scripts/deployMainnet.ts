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
    // start external contracts
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
    // end external contracts
    // start new contracts
    ProxyAdmin: "0x74Cf9087AD26D541930BaC724B7ab21bA8F00a27",
    VaultController: "0xaca81583840B1bf2dDF6CDe824ada250C1936B4D",
    USDI: "0xA56F946D6398Dd7d9D4D9B337Cf9E0F68982ca5B",
    Curve: "0xaB7B4c595d3cE8C85e16DA86630f2fc223B05057",
    ThreeLines: "0x045857BDEAE7C1c7252d611eB24eB55564198b4C",
    Oracle: "0x02df3a3F960393F5B349E40A599FEda91a7cc1A7",
    EthOracle: "0x71089Ba41e478702e1904692385Be3972B2cBf9e",
    UniOracle: "0xaC47e91215fb80462139756f43438402998E4A3a",
    WBTCOracle: "0x38A70c040CA5F5439ad52d0e821063b0EC0B52b6",
    CharlieDelegator: "0xe039608E695D21aB11675EBBA00261A0e750526c",
    CharlieDelegate: "0x56D13Eb21a625EdA8438F55DF2C31dC3632034f5",
    IPTDelegator: "0xE8addD62feD354203d079926a8e563BC1A7FE81e",
    IPTDelegate: "0xd9140951d8aE6E5F625a02F5908535e16e3af964",
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

  // transfer ownership of
  //
  // PROXYADMIN
  // VAULTCONTROLLER
  // USDI
  // CURVEMASTER
  // ORACLEMASTER
  // OTHER CONTRACTS ARE NOT OWNABLE OR HAVE THE CORRECT OWNER SET

  console.log(d.Info);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
