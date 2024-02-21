import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-watcher";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-docgen";
//import "@tenderly/hardhat-tenderly";

import { HardhatUserConfig } from "hardhat/types";
import * as dotenv from "dotenv";

dotenv.config();
const zaddr =
  "0000000000000000000000000000000000000000000000000000000000000000";
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET_URL ? process.env.MAINNET_URL : zaddr,
        blockNumber: 14546835,
      },
      mining: {
        auto: true,
      },
    },
    tenderly: {
      chainId: 10,
      url: "https://rpc.tenderly.co/fork/5b75ab39-e152-416e-99ae-683c2c60b996"
    },
    mainnet: {
      url: process.env.MAINNET_URL ? process.env.MAINNET_URL : zaddr,
      accounts: [
        process.env.MAINNET_PRIVATE_KEY
          ? process.env.MAINNET_PRIVATE_KEY
          : zaddr,
        process.env.PERSONAL_PRIVATE_KEY
          ? process.env.PERSONAL_PRIVATE_KEY
          : zaddr
      ],
      minGasPrice: 32000000000,
    },
    op: {
      url: process.env.OP_URL ? process.env.OP_URL : zaddr,
      accounts: [
        process.env.MAINNET_PRIVATE_KEY
          ? process.env.MAINNET_PRIVATE_KEY
          : zaddr,
        process.env.PERSONAL_PRIVATE_KEY
          ? process.env.PERSONAL_PRIVATE_KEY
          : zaddr
      ],
      minGasPrice: 32000000000,
      chainId: 10

    },
    ropsten: {
      url: process.env.ROPSTEN_URL ? process.env.ROPSTEN_URL : zaddr,
      accounts: [
        process.env.ROPSTEN_PRIVATE_KEY
          ? process.env.ROPSTEN_PRIVATE_KEY
          : zaddr,
      ],
      chainId: 3, // Ropsten's id
      gas: 8000000, // Ropsten has a lower block limit than mainnet
      gasPrice: 53000000000,
      //gasPrice: 2000000000
    },
    rinkeby: {
      url: process.env.RINKEBY_URL ? process.env.RINKEBY_URL : zaddr,
      accounts: [
        process.env.RINKEBY_PRIVATE_KEY
          ? process.env.RINKEBY_PRIVATE_KEY
          : zaddr,
      ],
      chainId: 4, // Ropsten's id
    },
    polygon: {
      url: process.env.POLYGON_URL ? process.env.POLYGON_URL : zaddr,
      accounts: [
        process.env.POLYGON_PRIVATE_KEY
          ? process.env.POLYGON_PRIVATE_KEY
          : zaddr,
      ],
      chainId: 137, // Polygon's id
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
    enabled: false,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.API_KEY!,
      ropsten: process.env.API_KEY!,
      polygon: process.env.ETHERSCAN_POLYGON_KEY!,
      optimisticEthereum: process.env.OP_KEY!
    },
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v5",
    alwaysGenerateOverloads: true, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
  }
};

export default config;
