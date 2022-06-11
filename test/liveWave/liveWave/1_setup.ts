import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { reset, mineBlock } from "../../../util/block";
import { IERC20__factory, IVOTE__factory } from "../../../typechain-types";


require("chai").should();


// configurable variables
let usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";
let comp_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let wbtc_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let uni_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let dydx_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let ens_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let aave_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let tribe_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let weth_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";

let carol_voting_address = "0x1F2AB8Ac759Fb0E3185630277A554Ae3110bF530";

if (process.env.TENDERLY_KEY) {
  if (process.env.TENDERLY_ENABLE == "true") {
    let provider = new ethers.providers.Web3Provider(tenderly.network());
    ethers.provider = provider;
  }
}

const Web3 = require("web3");
const web3 = new Web3(
  new Web3.providers.HttpProvider("https://mainnet.rpc.gfx.xyz/")
);
const isContract = async (address: string) => {
  const res = await web3.eth.getCode(address);
  return res.length > 5;
};

describe("hardhat settings", () => {
  it("reset hardhat network each run", async () => {
    expect(await reset(14945275)).to.not.throw;
  });
  it("set automine OFF", async () => {
    expect(await network.provider.send("evm_setAutomine", [false])).to.not
      .throw;
  });
});

describe("Token Setup", () => {
  it("connect to signers", async () => {
    s.accounts = await ethers.getSigners();
    s.Frank = s.accounts[0];
    s.Andy = s.accounts[1];
    s.Bob = s.accounts[2];
    s.Carol = s.accounts[3];
    s.Dave = s.accounts[4];
    s.Eric = s.accounts[5];
    s.Gus = s.accounts[6];
    s.Hector = s.accounts[7];
    s.Igor = s.accounts[8];
    s.Bank = s.accounts[9];
  });
  it("Connect to existing contracts", async () => {
    s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank);

  });
  it("Should succesfully transfer money to the bank", async () => {

    //showBody(`stealing ${s.Bank_USDC} usdc to Bank from ${s.usdcAddress}`);
    await stealMoney(usdc_minter, s.Bank.address, s.usdcAddress, s.Bank_USDC)
    await mineBlock();
  });

  it("Select accounts at random for wave 1", async () => {
    const length = 50;
    let rl1: any[] = [];
    const prm = [];
    for (let i = 0; i < length; i++) {
      const random = Math.floor(Math.random() * s.whitelist1.length);
      const p = isContract(s.whitelist1[random]).then((x) => {
        if (!x) {
          rl1.push(s.whitelist1[random]);
        }
      });
      prm.push(p);
    }
    await Promise.all(prm);
    s.randomWhitelist1 = rl1;
  })

  it("Select accounts at random for wave 2", async () => {
    const length2 = 75;
    let rl2: any[] = [];
    const prm = [];
    for (let i = 0; i < length2; i++) {
      const random = Math.floor(Math.random() * s.whitelist2.length);
      const p = isContract(s.whitelist2[random]).then((x) => {
        if (!x) {
          rl2.push(s.whitelist2[random]);
        }
      });
      prm.push(p);
    }
    await Promise.all(prm);
    s.randomWhitelist2 = rl2;
  })
  it("Select accounts at random for wave 3", async () => {
    const length2 = 100;
    let rl2: any[] = [];
    const prm = [];
    for (let i = 0; i < length2; i++) {
      const random = Math.floor(Math.random() * s.whitelist2.length);
      const p = isContract(s.whitelist2[random]).then((x) => {
        if (!x) {
          rl2.push(s.whitelist2[random]);
        }
      });
      prm.push(p);
    }
    await Promise.all(prm);
    s.randomWhiteList3 = rl2;
  })
});

