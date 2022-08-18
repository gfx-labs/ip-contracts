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
  CappedGovToken__factory
} from "../typechain-types";
import { utils, BigNumber } from "ethers";

import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { showBody } from "../util/format";
import { reset, currentBlock } from "../util/block"

const { ethers, network, upgrades } = require("hardhat");

async function main() {

    await reset(15367344)
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const cappedMattic = CappedGovToken__factory.connect("0x5aC39Ed42e14Cf330A864d7D1B82690B4D1B9E61", deployer)

    console.log(await cappedMattic._underlying())

    
    


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
