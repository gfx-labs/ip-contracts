import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-watcher";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";

import "@typechain/hardhat";
import "hardhat-docgen";

import { HardhatUserConfig } from "hardhat/types";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET_URL!,
        blockNumber: 14546835,
      },
      mining: {
        auto: false,
      },
    },
    ropsten: {
      url: process.env.ROPSTEN_URL!,
      accounts: [process.env.ROPSTEN_PRIVATE_KEY!],
      chainId: 3, // Ropsten's id
      gas: 8000000, // Ropsten has a lower block limit than mainnet
      gasPrice: 53000000000,
      //gasPrice: 2000000000,
    },
    localhost: {
      url: "http://localhost:8545",
    },
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  watcher: {
    compilation: {
      //npx hardhat watch compilation -- auto compile on change
      tasks: ["compile"],
    },
    test: {
      //npx hardhat watch test -- run test when a file is saved
      tasks: [
        {
          command: "test",
          params: { testFiles: ["./test/presale/oversaturation/index.ts"] },
        },
      ], //test this file
      files: ["./test/presale/oversaturation/*"], //test when this file is saved
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

  docgen: {
    path: "./docs",
    clear: true,
    runOnCompile: true,
  },
  gasReporter: {
    enabled: false,
  },
};

if (process.env.TENDERLY_KEY) {
  if (process.env.TENDERLY_ENABLE == "true") {
    import("@tenderly/hardhat-tenderly").then(() => {
      console.log("enabling tenderly");
      config.tenderly = {
        project: "ip",
        username: "getty",
        forkNetwork: "1", //Network id of the network we want to fork
      };
    });
  }
}

export default config;
