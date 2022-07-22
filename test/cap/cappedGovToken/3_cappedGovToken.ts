import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { start } from "repl";
require("chai").should();


describe("Testing CappedToken functions", () => {
    it("Deposit underlying", async () => {

        expect(await s.AAVE.balanceOf(s.Bob.address)).to.eq(s.aaveAmount, "Bob has the expected amount of aave")


    })

    it("Deposit underlying to another address", async () => {


    })

    it("Check things", async () => {
      
    })

    it("Withdraw underlying", async () => {

    })

    it("Withdraw underlying to another address", async () => {

    })
    
})