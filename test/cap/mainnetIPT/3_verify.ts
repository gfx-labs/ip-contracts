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
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
require("chai").should();


describe("Verify setup", () => {
    it("Bob's Voting Vault setup correctly", async () => {
        const vaultInfo = await s.BobVotingVault._vaultInfo()
        const parentVault = await s.BobVotingVault.parentVault()

        expect(parentVault.toUpperCase()).to.eq(vaultInfo.vault_address.toUpperCase(), "Parent Vault matches vault info")

        expect(vaultInfo.id).to.eq(s.BobVaultID, "Voting Vault ID is correct")
        expect(vaultInfo.vault_address).to.eq(s.BobVault.address, "Vault address is correct")
    })
    it("Carol's Voting Vault setup correctly", async () => {
        const vaultInfo = await s.CarolVotingVault._vaultInfo()

        expect(vaultInfo.id).to.eq(s.CaroLVaultID, "Voting Vault ID is correct")
        expect(vaultInfo.vault_address).to.eq(s.CarolVault.address, "Vault address is correct")
    })
})

//mint voting vault from an account that does not yet have a regular vault
describe("Testing CappedToken functions", () => {
    const depositAmount = BN("500e18")
    let gusVaultId: BigNumber
    let gusVault: IVault
    let gusVotingVault: VotingVault

    it("Check token destinations", async () => {

        let balance = await s.IPT.balanceOf(s.DeployerVotingVault.address)
        expect(balance).to.eq(69, "Voting vault holds the underlying")

        balance = await s.cIPT.balanceOf(s.DeployerVault.address)
        expect(balance).to.eq(69, "regular vault holds the wrapped capTokens")

    })

 
     it("Try to transfer", async () => {
        expect(s.cIPT.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
    })

    it("Deposit underlying", async () => {

        expect(await s.IPT.balanceOf(s.Bob.address)).to.eq(s.aaveAmount, "Bob has the expected amount of IPT")
        expect(await s.IPT.balanceOf(s.Bob.address)).to.be.gt(depositAmount, "Bob has enough IPT")

        let caBalance = await s.cIPT.balanceOf(s.Bob.address)
        expect(caBalance).to.eq(0, "Bob holds 0 capped IPT at the start")

        caBalance = await s.cIPT.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped IPT at the start")


        await s.IPT.connect(s.Bob).approve(s.cIPT.address, depositAmount)
        await s.cIPT.connect(s.Bob).deposit(depositAmount, s.BobVaultID)
        await mineBlock()


        caBalance = await s.cIPT.balanceOf(s.Bob.address)
        expect(caBalance).to.eq(0, "Bob holds 0 capped IPT after deposit")

        caBalance = await s.cIPT.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(depositAmount, "Bob's vault received the capped IPT tokens")


    })



    it("Try to exceed the cap", async () => {
        const cap = await s.cIPT.getCap()
        expect(cap).to.eq(s.AaveCap.add(69), "Cap is still correct")
        expect(await s.cIPT.totalSupply()).to.eq(cap, "Cap reached")

        await s.IPT.connect(s.Bob).approve(s.cIPT.address, 1)
        await mineBlock()
        expect(s.cIPT.connect(s.Bob).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")
    })
   
    it("Try to transfer", async () => {
        expect(s.cIPT.connect(s.Bob).transfer(s.Frank.address, BN("10e18"))).to.be.revertedWith("only vaults")
    })

    it("No vault", async () => {
        const amount = BN("5e18")
        const startBal = await s.IPT.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.aaveAmount, "Balance correct")

        await s.IPT.connect(s.Gus).approve(s.cIPT.address, amount)
        expect(s.cIPT.connect(s.Gus).deposit(amount, 99999)).to.be.revertedWith("invalid vault")
    })

    it("Deposit with no voting vault", async () => {
        const amount = BN("5e18")

        const startBal = await s.IPT.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.aaveAmount, "Balance correct")


        //mint regular vault for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted;
        await mineBlock();
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus);
        expect(await gusVault.minter()).to.eq(s.Gus.address);

        await s.IPT.connect(s.Gus).approve(s.cIPT.address, amount)
        expect(s.cIPT.connect(s.Gus).deposit(amount, gusVaultId)).to.be.revertedWith("invalid voting vault")
    })

    it("Eronious transfer and then withdraw with no voting vault", async () => {
        //transfer some underlying to cap contract instead of deposit?
        const transferAmount = BN("5e18")
        let balance = await s.IPT.balanceOf(s.Gus.address)
        expect(balance).to.eq(s.aaveAmount, "Starting IPT amount correct")
        await s.IPT.connect(s.Gus).transfer(s.cIPT.address, transferAmount)
        await mineBlock()

        //try to withdraw - no voting vault
        expect(gusVault.connect(s.Gus).withdrawErc20(s.cIPT.address, transferAmount)).to.be.revertedWith("only vaults")

    })

    it("Try to withdraw eronious transfer after minting a voting vault", async () => {
        const transferAmount = BN("5e18")

        //mint a voting vault
        await s.VotingVaultController.connect(s.Gus).mintVault(gusVaultId)
        await mineBlock()

        expect(gusVault.connect(s.Gus).withdrawErc20(s.cIPT.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")
    })

    it("Try to withdraw more than is possible given some cap tokens", async () => {

        await impersonateAccount(s.DEPLOYER._address)

        await s.cIPT.connect(s.DEPLOYER).setCap(BN("501e18").add(69))
        await mineBlock()

        await ceaseImpersonation(s.DEPLOYER._address)


        await s.cIPT.connect(s.Gus).deposit(BN("1e18"), gusVaultId)
        await mineBlock()

        let balance = await s.cIPT.balanceOf(gusVault.address)
        expect(balance).to.eq(BN("1e18"), "Balance is correct")

        expect(gusVault.connect(s.Gus).withdrawErc20(s.cIPT.address, BN("5e18"))).to.be.revertedWith("ERC20: burn amount exceeds balance")

        //Withdraw the amount that was deposited
        await gusVault.connect(s.Gus).withdrawErc20(s.cIPT.address, BN("1e18"))
        await mineBlock()

        //return cap to expected amount
        await impersonateAccount(s.DEPLOYER._address)

        await s.cIPT.connect(s.DEPLOYER).setCap(BN("500e18").add(69))
        await mineBlock()

        await ceaseImpersonation(s.DEPLOYER._address)


    })

    it("Try to withdraw from a vault that is not yours", async () => {
        const amount = BN("250e18")

        expect(s.BobVault.connect(s.Carol).withdrawErc20(s.cIPT.address, amount)).to.be.revertedWith("sender not minter")
    })


    it("Withdraw Underlying", async () => {

        const amount = BN("250e18")

        const startIPT = await s.IPT.balanceOf(s.Bob.address)
        const startCapIPT = await s.cIPT.balanceOf(s.BobVault.address)

        expect(startCapIPT).to.be.gt(amount, "Enough Capped IPT")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.cIPT.address, amount)
        await mineBlock()

        let balance = await s.IPT.balanceOf(s.Bob.address)
        expect(balance).to.eq(startIPT.add(amount), "IPT balance changed as expected")

        balance = await s.cIPT.balanceOf(s.BobVault.address)
        expect(balance).to.eq(startCapIPT.sub(amount), "cIPT balance changed as expected")

        //Deposit again to reset for further tests
        await s.IPT.connect(s.Bob).approve(s.cIPT.address, amount)
        await s.cIPT.connect(s.Bob).deposit(amount, s.BobVaultID)
        await mineBlock()
    })
     
})



 
describe("More checks", () => {
    it("Try to retrieveUnderlying", async () => {
        await expect(s.VotingVaultController.connect(s.Dave).retrieveUnderlying(BN("1e18"), s.BobVotingVault.address, s.Dave.address)).to.be.revertedWith("only capped token")
    })

    it("try to mint a second voting vault", async () => {

        let _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
        expect(_vaultId_votingVaultAddress).to.not.eq("0x0000000000000000000000000000000000000000", "Voting vault exists already")

        const ogVaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
        const ogVault = VotingVault__factory.connect(ogVaultAddr, s.Bob)
        const expectedBalance = await s.IPT.balanceOf(s.BobVotingVault.address)

        let balance = await s.IPT.balanceOf(ogVault.address)
        expect(balance).to.eq(expectedBalance, "Bob's voting vault holds the correct balance of gov tokens")


        const result = await s.VotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to mintVault on an ID that exists already: ", gas)

        let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
        let dupeVault = VotingVault__factory.connect(vaultAddr, s.Bob)

        expect(ogVaultAddr.toUpperCase()).to.eq(vaultAddr.toUpperCase(), "Bob's voting vault address did not change")

        let dupeBalance = await s.IPT.balanceOf(dupeVault.address)
        expect(dupeBalance).to.eq(balance).to.eq(expectedBalance, "No new vault was minted")



    })


})