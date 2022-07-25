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


describe("Testing Lending functionality", () => {
    const amount = BN("500e18")
    it("Check starting balance", async () => {
        const startCap = await s.CappedAave.balanceOf(s.BobVault.address)
        expect(startCap).to.eq(amount, "Starting balance is correct")

        let balance = await s.WBTC.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")

        balance = await s.WETH.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")

        balance = await s.UNI.balanceOf(s.BobVault.address)
        expect(balance).to.eq(0, "Bob's vault holds 0")
        let liability = await s.VaultController.vaultLiability(s.BobVaultID)
        expect(liability).to.eq(0, "Bob's vault has no outstanding debt")
    })

    it("Check borrow power", async () => {

        let borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        showBody(await toNumber(borrowPower))

    })

    it("Try to exceed the cap", async () => {
    
    })    
})