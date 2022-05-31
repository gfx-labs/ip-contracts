import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-watcher";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "@tenderly/hardhat-tenderly";
import "@nomiclabs/hardhat-etherscan";

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
    rinkeby: {
      url: process.env.RINKEBY_URL!,
      accounts: [process.env.RINKEBY_PRIVATE_KEY!],
      chainId: 4, // Ropsten's id
    },
    polygon: {
      url: process.env.POLYGON_URL!,
      accounts: [process.env.POLYGON_PRIVATE_KEY!],
      chainId: 137, // Ropsten's id
    },
    localhost: {
      url: "http://localhost:8545",
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              orderLiterals: true,
              deduplicate: true,
              cse: true,
              yul: true,
            },
          },
        },
      },
    ],
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
    runOnCompile: false,
  },
  gasReporter: {
    enabled: true,
  },
  etherscan: {
    apiKey: {
      polygon: process.env.ETHERSCAN_POLYGON_KEY!,
    },
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v5",
    alwaysGenerateOverloads: true, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
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
