import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  CurveMaster__factory,
  ThreeLines0_100__factory,
  InterestProtocolTokenDelegate,
  WavePool,
  WavePool__factory,
} from "../typechain-types";
import { utils, BigNumber } from "ethers";
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { currentBlock, OneWeek, reset } from "../util/block";
import { wave1 } from "./deployment/wave1";
import { wave2 } from "./deployment/wave2";

const { ethers, network, upgrades } = require("hardhat");

async function sleep(milliseconds: number) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if (new Date().getTime() - start > milliseconds) {
      break;
    }
  }
}

const USDC_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const compAddress = "0xc00e94cb662c3520282e6f5717214004a7f26888";
const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const usdcCompPool = "0x4786bb29a1589854204a4e62dcbe26a571224c0f";
const usdcWETHpool = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";

const LiquidationIncentive = BN("5e16");
const wETH_LTV = BN("5e17");
const COMP_LTV = BN("4e17");

let IPT: InterestProtocolTokenDelegate;

let disableTime: number;

let root1: string;
let root2: string;
let merkleTree1: MerkleTree;
let merkleTree2: MerkleTree;
const key1 = BN("1000000e6"); //1,000,000 USDC
const key2 = BN("500000e6"); //500,000 USDC
const totalReward = utils.parseEther("35000000"); //30,000,000 IPT

let Wave: WavePool;

const whitelist1 = Array.from(wave1);
const whitelist2 = Array.from(wave2);

const initMerkle = () => {
  let leafNodes = whitelist1.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, key1])
  );
  merkleTree1 = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  root1 = merkleTree1.getHexRoot();

  leafNodes = whitelist2.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, key2])
  );
  merkleTree2 = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  root2 = merkleTree2.getHexRoot();
};

const deployWave = async (deployer: SignerWithAddress) => {
  const disableTime = 1655658000;

  const startTime1 = 1655139600;
  const startTime2 = 1655312400;
  const startTime3 = 1655485200;

  const receiver = "0xa6e8772af29b29b9202a073f8e36f447689beef6";

  console.log("Deploying Wave...");

  console.log(receiver);
  console.log(totalReward);
  console.log("0xaF239a6fab6a873c779F3F33dbd34104287b93e1");
  console.log("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  console.log(disableTime);
  console.log(root1);
  console.log(startTime1);
  console.log(root2);
  console.log(startTime2);
  console.log("0x" + "00".repeat(32));
  console.log(startTime3);
  await sleep(1000000);
  Wave = (await new WavePool__factory(deployer).deploy(
    receiver,
    totalReward,
    "0xaF239a6fab6a873c779F3F33dbd34104287b93e1",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // mainnet usdc
    disableTime, //time when claiming points for all is disabled
    root1,
    startTime1, //time when claiming points for wave 1 is enabled
    root2,
    startTime2, //time when claiming points for wave 2 is enabled (wave1 + oneWeek)
    Array(32).fill(0),
    startTime3 //time when claiming points for wave 3 is enabled (wave1 + oneWeek * 2)
  )) as any;
  await Wave.deployed();
  console.log("Wave deployed: ", Wave.address);
};

//0xA9a4292a99A1DE8952A3e62e3c7Bf33463b412A7
//0x786cb85de17ad952B9b4b888A0e5187a05EF1FD2 -- GOOD DEPLOYMENT
//hh verify --network polygon --constructor-args ./scripts/arguments.js 0x0078f8795Ba94FCc90c6553E6Cb4674F48DD3a5A

async function main() {
  //enable this for testing on hardhat network, disable for testnet/mainnet deploy
  //await network.provider.send("evm_setAutomine", [true])

  const accounts = await ethers.getSigners();
  const deployer = accounts[0];

  console.log("Deployer: ", deployer.address);
  //await deployCharlie(deployer)
  initMerkle();
  await deployWave(deployer);

  console.log("Contracts deployed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
