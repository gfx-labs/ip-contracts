import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number";
import {
    IVault__factory,
    VotingVault,
    IVault,
    VotingVault__factory,
    CurveMaster__factory,
    curve
} from "../../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
} from "../../../../util/block";
import { toNumber, getGas } from "../../../../util/math";

const usdcAmount = BN("50e6")
const usdiAmount = BN("50e18")

const USDC_BORROW = BN("1000e6")//1k USDC
const USDI_BORROW = BN("100e18")//500 USDI



require("chai").should();
describe("Verify Upgraded Contracts", () => {

    it("Mint voting vault for Bob", async () => {

        let _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
        expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

        const result = await s.VotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
        await mineBlock()

        let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
        s.BobVotingVault = VotingVault__factory.connect(vaultAddr, s.Bob)

        expect(s.BobVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Bob's voting vault setup complete")
    })
    it("Mint voting vault for Carol", async () => {

        let _vaultId_votingVaultAddress = await s.VotingVaultController._vaultId_votingVaultAddress(s.CaroLVaultID)
        expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

        const result = await s.VotingVaultController.connect(s.Carol).mintVault(s.CaroLVaultID)
        await mineBlock()

        let vaultAddr = await s.VotingVaultController._vaultId_votingVaultAddress(s.CaroLVaultID)
        s.CarolVotingVault = VotingVault__factory.connect(vaultAddr, s.Carol)

        expect(s.CarolVotingVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Carol's voting vault setup complete")
    })

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



describe("Testing CappedToken functions", () => {
    let gusVaultId: BigNumber
    let gusVault: IVault
    let gusVotingVault: VotingVault

    it("Try to transfer", async () => {
        expect(s.CappedRETH.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
        expect(s.CappedRETH.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")

    })


    it("Deposit underlying", async () => {
        expect(await s.rETH.balanceOf(s.Bob.address)).to.eq(s.rETH_Amount, "Bob has the expected amount of rETH")
        expect(await s.cbETH.balanceOf(s.Bob.address)).to.eq(s.cbETH_Amount, "Bob has the expected amount of cbETH")

        let caBalance = await s.CappedRETH.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped rETH at the start")
        caBalance = await s.CappedCBETH.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped cbETH at the start")

        await s.rETH.connect(s.Bob).approve(s.CappedRETH.address, s.rETH_Amount)
        await s.CappedRETH.connect(s.Bob).deposit(s.rETH_Amount, s.BobVaultID)
        await mineBlock()

        await s.cbETH.connect(s.Bob).approve(s.CappedCBETH.address, s.cbETH_Amount)
        await s.CappedCBETH.connect(s.Bob).deposit(s.cbETH_Amount, s.BobVaultID)
        await mineBlock()



        caBalance = await s.CappedRETH.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.rETH_Amount, "Bob's vault received the capped rETH tokens")

        caBalance = await s.CappedCBETH.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.cbETH_Amount, "Bob's vault received the capped cbETH tokens")


    })

    it("Try to exceed the rETH cap", async () => {

        await impersonateAccount(s.owner._address)
        await s.CappedRETH.connect(s.owner).setCap(s.rETH_Amount)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        const cap = await s.CappedRETH.getCap()
        expect(cap).to.eq(s.rETH_Amount, "Cap is still correct")
        expect(await s.CappedRETH.totalSupply()).to.eq(cap, "Cap reached")

        await s.rETH.connect(s.Gus).approve(s.CappedRETH.address, 1)
        await mineBlock()
        expect(s.CappedRETH.connect(s.Gus).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")

        await impersonateAccount(s.owner._address)
        await s.CappedRETH.connect(s.owner).setCap(s.rETH_Cap)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)
    })

    it("Try to exceed the cbETH cap", async () => {

        await impersonateAccount(s.owner._address)
        await s.CappedCBETH.connect(s.owner).setCap(s.cbETH_Amount)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        const cap = await s.CappedCBETH.getCap()
        expect(cap).to.eq(s.cbETH_Amount, "Cap is still correct")
        expect(await s.CappedCBETH.totalSupply()).to.eq(cap, "Cap reached")

        await s.cbETH.connect(s.Gus).approve(s.CappedCBETH.address, 1)
        await mineBlock()
        expect(s.CappedCBETH.connect(s.Gus).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")

        await impersonateAccount(s.owner._address)
        await s.CappedCBETH.connect(s.owner).setCap(s.cbETH_Cap)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)
    })


    it("No vault", async () => {
        const amount = BN("5e18")
        const startBal = await s.rETH.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.rETH_Amount, "Balance correct")

        //await s.rETH.connect(s.Gus).approve(s.CappedRETH.address, amount) // rETH is not ERC20 - no approval
        //showBody("Approved")
        expect(s.CappedRETH.connect(s.Gus).deposit(amount, 99999)).to.be.revertedWith("invalid vault")
        expect(s.CappedCBETH.connect(s.Gus).deposit(amount, 99999)).to.be.revertedWith("invalid vault")


    })

    it("Deposit rETH with no voting vault", async () => {
        const amount = BN("5e18")

        const startBal = await s.rETH.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.rETH_Amount, "Balance correct")


        //mint regular vault for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted;
        await mineBlock();
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus);
        expect(await gusVault.minter()).to.eq(s.Gus.address);

        //await s.rETH.connect(s.Gus).approve(s.CappedRETH.address, amount)
        expect(s.CappedRETH.connect(s.Gus).deposit(amount, gusVaultId)).to.be.revertedWith("invalid voting vault")
    })

    it("Deposit cbETH with no voting vault", async () => {
        const amount = BN("5e18")

        const startBal = await s.cbETH.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.cbETH_Amount, "Balance correct")


        //mint regular vault for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted;
        await mineBlock();
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus);
        expect(await gusVault.minter()).to.eq(s.Gus.address);

        //await s.cbETH.connect(s.Gus).approve(s.CappedCBETH.address, amount)
        expect(s.CappedCBETH.connect(s.Gus).deposit(amount, gusVaultId)).to.be.revertedWith("invalid voting vault")
    })

    it("Eronious transfer of rETH and then withdraw with no voting vault", async () => {
        //transfer some underlying to cap contract instead of deposit?
        const transferAmount = BN("5e18")
        let balance = await s.rETH.balanceOf(s.Gus.address)
        expect(balance).to.eq(s.rETH_Amount, "Starting rETH amount correct")
        await s.rETH.connect(s.Gus).transfer(s.CappedRETH.address, transferAmount)
        await mineBlock()

        //try to withdraw - no voting vault
        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedRETH.address, transferAmount)).to.be.revertedWith("only vaults")

    })

    it("Eronious transfer of cbETH and then withdraw with no voting vault", async () => {
        //transfer some underlying to cap contract instead of deposit?
        const transferAmount = BN("5e18")
        let balance = await s.cbETH.balanceOf(s.Gus.address)
        expect(balance).to.eq(s.cbETH_Amount, "Starting cbETH amount correct")
        await s.cbETH.connect(s.Gus).transfer(s.CappedCBETH.address, transferAmount)
        await mineBlock()

        //try to withdraw - no voting vault
        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedCBETH.address, transferAmount)).to.be.revertedWith("only vaults")

    })

    it("Try to withdraw eronious transfer after minting a voting vault", async () => {
        const transferAmount = BN("5e18")

        //mint a voting vault
        await s.VotingVaultController.connect(s.Gus).mintVault(gusVaultId)
        await mineBlock()

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedRETH.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")
        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedCBETH.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")

    })

    it("Try to withdraw more capped rETH than is possible given some cap tokens", async () => {

        await impersonateAccount(s.owner._address)
        await s.CappedRETH.connect(s.owner).setCap(BN("51e24"))
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        let b = await s.rETH.balanceOf(s.Gus.address)

        const allowance = await s.rETH.allowance(s.Gus.address, s.CappedRETH.address)

        await s.rETH.connect(s.Gus).approve(s.CappedRETH.address, b.sub(allowance))
        await mineBlock()

        await s.CappedRETH.connect(s.Gus).deposit(BN("1e18"), gusVaultId)
        await mineBlock()

        let balance = await s.CappedRETH.balanceOf(gusVault.address)
        expect(balance).to.eq(BN("1e18"), "Balance is correct")

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedRETH.address, BN("5e18"))).to.be.revertedWith("only cap token")

        //Withdraw the amount that was deposited
        await gusVault.connect(s.Gus).withdrawErc20(s.CappedRETH.address, BN("1e18"))
        await mineBlock()

        //return cap to expected amount
        await impersonateAccount(s.owner._address)
        await s.CappedRETH.connect(s.owner).setCap(s.rETH_Cap)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

    })

    it("Try to withdraw more capped cbETH than is possible given some cap tokens", async () => {

        await impersonateAccount(s.owner._address)
        await s.CappedCBETH.connect(s.owner).setCap(BN("51e24"))
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        let b = await s.cbETH.balanceOf(s.Gus.address)

        const allowance = await s.cbETH.allowance(s.Gus.address, s.CappedCBETH.address)

        await s.cbETH.connect(s.Gus).approve(s.CappedCBETH.address, b.sub(allowance))
        await mineBlock()

        await s.CappedCBETH.connect(s.Gus).deposit(BN("1e18"), gusVaultId)
        await mineBlock()

        let balance = await s.CappedCBETH.balanceOf(gusVault.address)
        expect(balance).to.eq(BN("1e18"), "Balance is correct")

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedCBETH.address, BN("5e18"))).to.be.revertedWith("only cap token")

        //Withdraw the amount that was deposited
        await gusVault.connect(s.Gus).withdrawErc20(s.CappedCBETH.address, BN("1e18"))
        await mineBlock()

        //return cap to expected amount
        await impersonateAccount(s.owner._address)
        await s.CappedCBETH.connect(s.owner).setCap(s.cbETH_Cap)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

    })

    it("Try to withdraw from a vault that is not yours", async () => {
        const amount = BN("250e18")

        await expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedRETH.address, amount)).to.be.revertedWith("sender not minter")
        await expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedCBETH.address, amount)).to.be.revertedWith("sender not minter")


    })

    it("Withdraw Underlying rETH", async () => {

        const amount = await s.CappedRETH.balanceOf(s.BobVault.address)

        const startBal = await s.rETH.balanceOf(s.Bob.address)
        const startCapBal = amount

        expect(startCapBal).to.be.gt(s.rETH_Amount.sub(1), "Enough Capped rETH")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedRETH.address, amount).catch(console.log)
        await mineBlock()

        let balance = await s.rETH.balanceOf(s.Bob.address).catch(console.log)
        expect(balance).to.eq(startBal.add(amount), "rETH balance changed as expected")

        balance = await s.CappedRETH.balanceOf(s.BobVault.address).catch(console.log)
        expect(balance).to.eq(startCapBal.sub(amount), "CappedBal balance changed as expected")

        //Deposit again to reset for further tests
        await s.rETH.connect(s.Bob).approve(s.CappedRETH.address, amount)
        await s.CappedRETH.connect(s.Bob).deposit(amount, s.BobVaultID)
        await mineBlock()
    })

    it("Withdraw Underlying cbETH", async () => {

        const amount = await s.CappedCBETH.balanceOf(s.BobVault.address)

        const startBal = await s.cbETH.balanceOf(s.Bob.address)
        const startCapBal = amount

        expect(startCapBal).to.be.gt(s.cbETH_Amount.sub(1), "Enough Capped cbETH")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedCBETH.address, amount).catch(console.log)
        await mineBlock()

        let balance = await s.cbETH.balanceOf(s.Bob.address).catch(console.log)
        expect(balance).to.eq(startBal.add(amount), "cbETH balance changed as expected")

        balance = await s.CappedCBETH.balanceOf(s.BobVault.address).catch(console.log)
        expect(balance).to.eq(startCapBal.sub(amount), "CappedBal balance changed as expected")

        //Deposit again to reset for further tests
        await s.cbETH.connect(s.Bob).approve(s.CappedCBETH.address, amount)
        await s.CappedCBETH.connect(s.Bob).deposit(amount, s.BobVaultID)
        await mineBlock()
    })
})
