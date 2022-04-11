import { expect } from "chai";
import { ethers } from "hardhat";
import { Mainnet } from "../util/addresser";
import { Deployment } from "../util/contractor";

let contracts = Deployment;

const first = async () => {
  let accounts = await ethers.getSigners();
  await contracts.deploy(accounts[0]).catch(console.log);
};

describe("ORACLE-RELAY-UNISWAP:", () => {
  before("deploy contracts", first);
  it("fetch eth price", async () => {
    let dog = await contracts.UniswapRelayEthUsdc!.currentValue();
    console.log(dog.toString())
    console.log("eth price:", dog.div(1e4).toNumber() / 100);
    expect(1).to.eq(1);
    //expect(await usdi.owner()).to.eq(await deployer.getAddress())
  });
});

describe("ORACLE-MASTER:", () => {
  before("deploy contracts", first);
  it("fetch eth price", async () => {
    let dog = await contracts.Oracle!.get_live_price(Mainnet.wethAddress);
    console.log("eth price:", dog.div(1e4).toNumber() / 100);
    expect(1).to.eq(1);
    //expect(await usdi.owner()).to.eq(await deployer.getAddress())
  });

  it("Checks mainnet price", async () => {
    let test = await contracts.Oracle!.get_live_price(Mainnet.compAddress)
    console.log("price: ", test.toString())
    expect(1).to.eq(1);
  })
});
