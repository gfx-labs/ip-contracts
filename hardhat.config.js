require("@nomiclabs/hardhat-waffle");
require('dotenv').config()
const accounts = [...Array(50).keys()].map(x=>{return "ACCOUNT"+x}).map(x=>{return process.env[x]}).filter((x)=>{return x!==undefined})

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more



/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "localhost",
  networks: {
    hardhat: {
      forking: {
        url: process.env.NODE_URL,
      }
    },
    ropstein: {
      url: process.env.NODE_URL,
      accounts,
      gasPrice:2000000000,
    },
    localhost:{
      url:"http://127.0.0.1:8545"
    },
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: false,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000000
  }
}

