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

const deployCharlie = async (deployer: SignerWithAddress) => {
  console.log("Deploying governance...");

  let txCount = await deployer.getTransactionCount();
  //console.log("tx count: "+txCount)
  const futureAddressOne = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: txCount,
  });
  //address one is the token delegate
  //console.log("futureAddressOne: "+futureAddressOne)
  const futureAddressTwo = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: txCount + 1,
  });
  //address two is the token delegator
  //console.log("futureAddressTwo: "+futureAddressTwo)
  const futureAddressThree = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: txCount + 2,
  });
  //address three is the gov delegate
  //console.log("futureAddressThree: "+futureAddressThree)
  const futureAddressFour = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: txCount + 3,
  });

  const ipt_ = futureAddressTwo;
  const Govimplementation_ = futureAddressThree;
  const owner_ = futureAddressFour;

  let proxyAdminFactory = await ethers.getContractFactory("ProxyAdmin");
  const transparentFactory = await ethers.getContractFactory(
    "TransparentUpgradeableProxy"
  );

  //Proxy admin
  let proxyAdmin = await proxyAdminFactory.deploy();
  await proxyAdmin.deployed();
  console.log("proxyAdmin address: ", proxyAdmin.address);

  //VaultController implementation
  const InterestProtocolTokenDelegateFactory = await ethers.getContractFactory(
    "InterestProtocolTokenDelegate"
  );
  const uIPTd = await InterestProtocolTokenDelegateFactory.deploy();
  await uIPTd.deployed();
  console.log(
    "InterestProtocolTokenDelegate implementation address: ",
    uIPTd.address
  );

  //InterestProtocolTokenDelegate proxy
  const InterestProtocolTokenDelegate = await transparentFactory.deploy(
    uIPTd.address,
    proxyAdmin.address,
    "0x"
  );
  await InterestProtocolTokenDelegate.deployed();
  console.log(
    "InterestProtocolTokenDelegate proxy address: ",
    InterestProtocolTokenDelegate.address
  );

  //attach
  const IPTdelegate = InterestProtocolTokenDelegateFactory.attach(
    InterestProtocolTokenDelegate.address
  );
  //await IPTdelegate.initialize()
  //console.log("IPT token delegate initialized: ", IPTdelegate.address)

  await sleep(3000);

  console.log("Deploying IPT...");

  const totalSupplyReceiver_ = deployer.address;
  const TokenImplementation_ = IPTdelegate.address;
  const totalSupply_ = BN("1e26");

  const IPTfactory = await ethers.getContractFactory("InterestProtocolToken");
  IPT = await IPTfactory.deploy(
    totalSupplyReceiver_,
    owner_,
    TokenImplementation_,
    totalSupply_
  );
  await IPT.deployed();
  console.log("IPT deployed: ", IPT.address);
  let owner = await IPT.owner();
  console.log("IPT owner: ", owner);

  console.log("Deploying GovernorCharlieDelegator...");

  const votingPeriod_ = BN("19710");
  const votingDelay_ = BN("13140");
  const proposalThreshold_ = BN("250000000000000000000000");
  const proposalTimelockDelay_ = BN("172800");
  const quorumVotes_ = BN("50000000000000000000000000");
  const emergencyQuorumVotes_ = BN("50000000000000000000000000");
  const emergencyVotingPeriod_ = BN("6570");
  const emergencyTimelockDelay_ = BN("86400");

  const charlieFactory = await ethers.getContractFactory(
    "GovernorCharlieDelegator"
  );
  const charlie = await charlieFactory.deploy(
    ipt_,
    Govimplementation_,
    votingPeriod_,
    votingDelay_,
    proposalThreshold_,
    proposalTimelockDelay_,
    quorumVotes_,
    emergencyQuorumVotes_,
    emergencyVotingPeriod_,
    emergencyTimelockDelay_
  );
  await charlie.deployed();
  console.log("Charlie Deployed: ", charlie.address);
};

let disableTime: number;

let root1: string;
let root2: string;
let merkleTree1: MerkleTree;
let merkleTree2: MerkleTree;
const key1 = BN("1000000e6"); //1,000,000 USDC
const key2 = BN("500000e6"); //500,000 USDC
const floor = BN("250000"); //0.5 USDC
const amount = BN("100e6"); //100 USDC
const totalReward = utils.parseEther("35000000"); //30,000,000 IPT

let Wave: WavePool;

const whitelist = [
  "0xad8B917596d9e6A970393F089dCff0A9c9858934",
  "0xA8F5d96E2DDfb5ec3F24B960A5a44EbC620064A3",
  "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908",
  "0x50818e936aB61377A18bCAEc0f1C32cA27E38923",
  "0xbA99c822bb4dd80f046a75EE564f8295D44Da743",
  "0x8bAf8b6Ed0E0ddB6557Af1A7391a86949FAFa3a8",
  "0x0E1456214D8b4FEc597639a475C49c6682D94B09",
  "0x2243b90CCaF4a03F7289502722D8665E3d4f2972",
];

const initMerkle = async () => {
  let leafNodes = whitelist.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, key1])
  );
  merkleTree1 = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  root1 = merkleTree1.getHexRoot();

  leafNodes = whitelist.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, key2])
  );
  merkleTree2 = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  root2 = merkleTree2.getHexRoot();
};

const deployWave = async (deployer: SignerWithAddress) => {
  const block = await currentBlock();
  const enableTime = block.timestamp;
  disableTime = enableTime + 1800; //30 mins   //(OneWeek * 3)

  const receiver = "0x50818e936aB61377A18bCAEc0f1C32cA27E38923";

  //mainnet USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  console.log("Deploying Wave...");

  Wave = (await new WavePool__factory(deployer).deploy(
    receiver,
    totalReward,
    "0xe8504e3B854940818c8F3D61DC155FA9919dd10F", //IPT.address, //reward token POLYGON
    "0xbEed11d5c8c87FaCbf3f81728543eb8cB6CBa939", //points token POLYGON
    disableTime, //time when claiming points for all is disabled
    root1,
    enableTime, //time when claiming points for wave 1 is enabled
    root2,
    enableTime, //time when claiming points for wave 2 is enabled (wave1 + oneWeek)
    Array(32).fill(0),
    enableTime //time when claiming points for wave 3 is enabled (wave1 + oneWeek * 2)
  )) as any;
  await Wave.deployed();

  console.log(receiver);
  console.log(totalReward);
  console.log("0xe8504e3B854940818c8F3D61DC155FA9919dd10F");
  console.log("0xbEed11d5c8c87FaCbf3f81728543eb8cB6CBa939");
  console.log(disableTime);
  console.log(root1);
  console.log(enableTime);
  console.log(root2);
  console.log(enableTime);
  console.log(Array(32).fill(0));
  console.log(enableTime);

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
  await initMerkle();
  await deployWave(deployer);

  console.log("Contracts deployed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
