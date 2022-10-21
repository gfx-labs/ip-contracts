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
    CappedGovToken__factory,
    IOracleRelay__factory
} from "../typechain-types";
import { utils, BigNumber } from "ethers";

import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { showBody } from "../util/format";
import { reset, currentBlock } from "../util/block"
import { stealMoney } from "../util/money"
import exp from "constants";
import { expect } from "chai";
import * as readline from 'node:readline';
import { stdin, stdout } from 'process';
import { mergeLists } from "../util/math"
import { each } from "underscore";
import { min } from "bn.js";
import { writeFileSync } from "fs";
import { json } from "stream/consumers";

const { ethers, network, upgrades } = require("hardhat");

//LPS: JSON, borrowers: JSON
async function main() {

    const abi = ethers.utils.defaultAbiCoder;

    const data = "0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000034f4c440000000000000000000000000000000000000000000000000000000000"
    const data2 = "0x90b7649900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000055"
    const result = abi.decode(["uint96", "uint96"], data) //ethers.utils.hexDataSlice(data2, 2))

    console.log(result)

}


/**
 {
  reason: 'OLD',
  code: 'CALL_EXCEPTION',
  method: 'vaultSummaries(uint96,uint96)',
  data: '0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000034f4c440000000000000000000000000000000000000000000000000000000000',
  errorArgs: [ 'OLD' ],
  errorName: 'Error',
  errorSignature: 'Error(string)',
  address: '0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3',
  args: [ 1, BigNumber { _hex: '0x55', _isBigNumber: true } ],
  transaction: {
    data: '0x90b7649900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000055',
    to: '0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3'
  }
}
 */


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
