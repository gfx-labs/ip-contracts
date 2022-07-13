import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"

import { utils, BigNumber } from "ethers"
import { ethers, network } from "hardhat";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import { max, red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { start } from "repl";
require("chai").should();
const depositAmount = utils.parseEther("5")

describe("Testing CappedSTETH functions", () => {

    //Bob wraps and later unwraps
    //compare Bob's balance after unwrap to one of the users who did not wrap

    it("Deposit underlying", async () => {

     
    })

    it("elapse time and rebase", async () => {
        await fastForward(OneWeek)
        await mineBlock()
      
    })

    it("Check end state", async () => {
   
    })
})
