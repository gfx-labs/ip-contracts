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
import {
    IVault__factory,
    VotingVault__factory,
    VotingVault,
    IVault,
    CappedGovToken__factory,
    CappedGovToken
} from "../../../typechain-types"
import { JsxEmit } from "typescript";
import { stealMoney } from "../../../util/money";
require("chai").should();


describe("Verify setup", () => {
    it("Bob's Voting Vault setup correctly", async () => {
        const vaultInfo = await s.BobBptVault._vaultInfo()
        const parentVault = await s.BobBptVault.parentVault()

        expect(parentVault.toUpperCase()).to.eq(vaultInfo.vault_address.toUpperCase(), "Parent Vault matches vault info")

        expect(vaultInfo.id).to.eq(s.BobVaultID, "Voting Vault ID is correct")
        expect(vaultInfo.vault_address).to.eq(s.BobVault.address, "Vault address is correct")
    })
    it("Carol's Voting Vault setup correctly", async () => {
        const vaultInfo = await s.CarolBptVault._vaultInfo()

        expect(vaultInfo.id).to.eq(s.CaroLVaultID, "Voting Vault ID is correct")
        expect(vaultInfo.vault_address).to.eq(s.CarolVault.address, "Vault address is correct")
    })
})

describe("Deposit and verify functions", () => {

    it("Steal money to fund participants", async () => {
        //steal wstEth/weth gauge token
        const stEthGaugeWhale = "0xfF72243C5D7373F8Ac9cCF4ccd226301dC213a70"
        await stealMoney(stEthGaugeWhale, s.Bob.address, s.stETH_Gauge.address, s.stETH_Gauge_Amount)

        //steal auraBal
        const auraBalWhale = "0x0BE2340d942e79DFeF172392429855DE8A4f5b14"
        await stealMoney(auraBalWhale, s.Bob.address, s.auraBal.address, s.AuraBalAmount)

        //steal auraBal rewards token
        const auraBalRewardsWhale = "0x1C39BAbd4E0d7BFF33bC27c6Cc5a4f1d74C9F562"
        //await stealMoney(auraBalRewardsWhale, s.Bob.address, s.auraBalRewards.address, s.AuraBalRewardsAmount)


    })

    //seems like gauge tokens are all held by 0xaF52695E1bB01A16D33D7194C28C42b10e0Dbec2 aura voter proxy
    it("Deposit gauge token", async () => {

    })

    it("deposit auraBal", async () => {

    })

    it("deposit auraBal rewards token", async () => {

    })

    it("Claim gauge token rewards", async () => {

    })

    //aura base rewards CRV 0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2
    it("Claim auraBal rewards", async () => {

    })

    it("Claim auraBal rewards token rewards", async () => {

    })

    it("Withdraw all tokens", async () => {

    })

    it("Deposit tokens again for future tests", async () => {

    })

})
