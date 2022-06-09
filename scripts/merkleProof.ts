import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Deployment, DeploymentInfo } from "./deployment/deployment";
import {
  CurveMaster__factory,
  OracleMaster__factory,
  ThreeLines0_100__factory,
  UniswapV3OracleRelay__factory,
  VaultController__factory,
} from "../typechain-types";

import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";

const { ethers, network, upgrades } = require("hardhat");

async function sleep(milliseconds: number) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if (new Date().getTime() - start > milliseconds) {
      break;
    }
  }
}

//ropsten addresses
const keyAmount = BN("5e5");
let root1: string;
let merkleTree1: MerkleTree;
const initMerkle = async () => {
  const whitelist1 = [
    "0x50818e936aB61377A18bCAEc0f1C32cA27E38923",
    "0xA8F5d96E2DDfb5ec3F24B960A5a44EbC620064A3",
    "0x9C3744f033563a5fC6e38B79eD316972961a400F",
    "0xad8b917596d9e6a970393f089dcff0a9c9858934",
    "0x1b05DF9509080D94d6BF74814E54a9e727F7b402",
    "0x6739dCb4fe0B31f5E93c0742ad96386D8A0927A8",
  ];
  let leafNodes = whitelist1.map((addr) =>
    solidityKeccak256(["address", "uint256"], [addr, keyAmount])
  );
  merkleTree1 = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  root1 = merkleTree1.getHexRoot();
};

async function main() {
  await initMerkle();
  console.log(root1);
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];
  const account = "0x50818e936aB61377A18bCAEc0f1C32cA27E38923";

  let leaf = solidityKeccak256(["address", "uint256"], [account, keyAmount]);
  let proof = merkleTree1.getHexProof(leaf);
  console.log(proof);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
