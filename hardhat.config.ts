import * as dotenv from "dotenv" 

import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-watcher";
import "@openzeppelin/hardhat-upgrades";

import "@typechain/hardhat";
import { HardhatUserConfig } from "hardhat/types";
dotenv.config();
const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            forking: {
                url: "https://mainnet.rpc.gfx.xyz",
                blockNumber: 14546835
            },
            mining: {
                auto: false,
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
                enabled: true,
                runs: 200,
            },
        },
    },
    watcher: {
        compilation: { //npx hardhat watch compilation -- auto compile on change
            tasks: ["compile"],
        },
        test: {//npx hardhat watch test -- run test when a file is saved
            tasks: [{ command: 'test', params: { testFiles: ['./test/mainnet/10_main.ts'] } }], //test this file
            files: ['./test/mainnet/8_USDI.ts'] //test when this file is saved
        }
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
