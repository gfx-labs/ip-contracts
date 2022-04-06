import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";

import "@typechain/hardhat";
import { HardhatUserConfig } from "hardhat/types";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: "https://mainnet.rpc.gfx.xyz",
      },
    },
    ropsten: {
      url: "http://ropsten.rpc.gfx.xyz",
      gasPrice: 2000000000,
    },
    localhost: {
      url: "http://localhost:8545",
    },
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 20000000,
  },
};

export default config;
