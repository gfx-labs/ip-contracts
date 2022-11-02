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
        expect(s.CappedLDO.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
        expect(s.CappedDYDX.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
        expect(s.CappedCRV.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")

    })


    it("Deposit underlying", async () => {
        expect(await s.LDO.balanceOf(s.Bob.address)).to.eq(s.LDO_Amount, "Bob has the expected amount of LDO")
        expect(await s.DYDX.balanceOf(s.Bob.address)).to.eq(s.DYDX_Amount, "Bob has the expected amount of DYDX")
        expect(await s.CRV.balanceOf(s.Bob.address)).to.eq(s.CRV_Amount, "Bob has the expected amount of CRV")


        let caBalance = await s.CappedLDO.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped LDO at the start")

        caBalance = await s.CappedDYDX.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped DYDX at the start")

        caBalance = await s.CappedCRV.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped CRV at the start")

        await s.LDO.connect(s.Bob).approve(s.CappedLDO.address, s.LDO_Amount)
        await s.CappedLDO.connect(s.Bob).deposit(s.LDO_Amount, s.BobVaultID)
        await mineBlock()

        await s.DYDX.connect(s.Bob).approve(s.CappedDYDX.address, s.DYDX_Amount)
        await s.CappedDYDX.connect(s.Bob).deposit(s.DYDX_Amount, s.BobVaultID)
        await mineBlock()

        await s.CRV.connect(s.Bob).approve(s.CappedCRV.address, s.CRV_Amount)
        await s.CappedCRV.connect(s.Bob).deposit(s.CRV_Amount, s.BobVaultID)
        await mineBlock()

        caBalance = await s.CappedLDO.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.LDO_Amount, "Bob's vault received the capped LDO tokens")

        caBalance = await s.CappedDYDX.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.DYDX_Amount, "Bob's vault received the capped DYDX tokens")

        caBalance = await s.CappedCRV.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.CRV_Amount, "Bob's vault received the capped CRV tokens")
    })

    it("Try to exceed the LDO cap", async () => {

        await impersonateAccount(s.owner._address)
        await s.CappedLDO.connect(s.owner).setCap(s.LDO_Amount)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        const cap = await s.CappedLDO.getCap()
        expect(cap).to.eq(s.LDO_Amount, "Cap is still correct")
        expect(await s.CappedLDO.totalSupply()).to.eq(cap, "Cap reached")

        await s.LDO.connect(s.Gus).approve(s.CappedLDO.address, 1)
        await mineBlock()
        expect(s.CappedLDO.connect(s.Gus).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")

        await impersonateAccount(s.owner._address)
        await s.CappedLDO.connect(s.owner).setCap(s.LDO_Cap)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)
    })

    it("Try to exceed the DYDX cap", async () => {
        await impersonateAccount(s.owner._address)
        await s.CappedDYDX.connect(s.owner).setCap(s.DYDX_Amount)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        const cap = await s.CappedDYDX.getCap()
        expect(cap).to.eq(s.DYDX_Amount, "Cap is still correct")
        expect(await s.CappedDYDX.totalSupply()).to.be.gt(cap.sub(1), "Cap reached")

        await s.DYDX.connect(s.Gus).approve(s.CappedDYDX.address, 1)
        await mineBlock()
        expect(s.CappedDYDX.connect(s.Gus).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")

        await impersonateAccount(s.owner._address)
        await s.CappedDYDX.connect(s.owner).setCap(s.DYDX_Cap)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)
    })

    it("Try to exceed the CRV cap", async () => {
        await impersonateAccount(s.owner._address)
        await s.CappedCRV.connect(s.owner).setCap(s.CRV_Amount)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        const cap = await s.CappedCRV.getCap()
        expect(cap).to.eq(s.CRV_Amount, "Cap is still correct")
        expect(await s.CappedCRV.totalSupply()).to.eq(cap, "Cap reached")

        await s.CRV.connect(s.Gus).approve(s.CappedCRV.address, 1)
        await mineBlock()
        expect(s.CappedCRV.connect(s.Gus).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")

        await impersonateAccount(s.owner._address)
        await s.CappedCRV.connect(s.owner).setCap(s.CRV_Cap)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)
    })

    it("No vault", async () => {
        const amount = BN("5e18")
        const startBal = await s.LDO.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.LDO_Amount, "Balance correct")

        //await s.LDO.connect(s.Gus).approve(s.CappedLDO.address, amount) // LDO is not ERC20 - no approval
        //showBody("Approved")
        expect(s.CappedLDO.connect(s.Gus).deposit(amount, 99999)).to.be.revertedWith("invalid vault")
        expect(s.CappedDYDX.connect(s.Gus).deposit(amount, 99999)).to.be.revertedWith("invalid vault")
        expect(s.CappedCRV.connect(s.Gus).deposit(amount, 99999)).to.be.revertedWith("invalid vault")

    })

    it("Deposit BAL with no voting vault", async () => {
        const amount = BN("5e18")

        const startBal = await s.LDO.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.LDO_Amount, "Balance correct")


        //mint regular vault for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted;
        await mineBlock();
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus);
        expect(await gusVault.minter()).to.eq(s.Gus.address);

        //await s.LDO.connect(s.Gus).approve(s.CappedLDO.address, amount)
        expect(s.CappedLDO.connect(s.Gus).deposit(amount, gusVaultId)).to.be.revertedWith("invalid voting vault")
    })

    it("Deposit DYDX with no voting vault", async () => {
        const amount = BN("5e18")

        const startBal = await s.DYDX.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.DYDX_Amount, "Balance correct")


        //mint regular vault for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted;
        await mineBlock();
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus);
        expect(await gusVault.minter()).to.eq(s.Gus.address);

        await s.DYDX.connect(s.Gus).approve(s.CappedDYDX.address, amount)
        expect(s.CappedDYDX.connect(s.Gus).deposit(amount, gusVaultId)).to.be.revertedWith("invalid voting vault")
    })

    it("Deposit CRV with no voting vault", async () => {
        const amount = BN("5e18")

        const startBal = await s.CRV.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.CRV_Amount, "Balance correct")


        //mint regular vault for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted;
        await mineBlock();
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus);
        expect(await gusVault.minter()).to.eq(s.Gus.address);

        expect(s.CappedCRV.connect(s.Gus).deposit(amount, gusVaultId)).to.be.revertedWith("invalid voting vault")
    })

    it("Eronious transfer of LDO and then withdraw with no voting vault", async () => {
        //transfer some underlying to cap contract instead of deposit?
        const transferAmount = BN("5e18")
        let balance = await s.LDO.balanceOf(s.Gus.address)
        expect(balance).to.eq(s.LDO_Amount, "Starting BAL amount correct")
        await s.LDO.connect(s.Gus).transfer(s.CappedLDO.address, transferAmount)
        await mineBlock()

        //try to withdraw - no voting vault
        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedLDO.address, transferAmount)).to.be.revertedWith("only vaults")

    })
    it("Eronious transfer of DYDX and then withdraw with no voting vault", async () => {
        //transfer some underlying to cap contract instead of deposit?
        const transferAmount = BN("5e18")
        let balance = await s.DYDX.balanceOf(s.Gus.address)
        expect(balance).to.eq(s.DYDX_Amount, "Starting DYDX amount correct")
        await s.LDO.connect(s.Gus).transfer(s.CappedDYDX.address, transferAmount)
        await mineBlock()

        //try to withdraw - no voting vault
        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedDYDX.address, transferAmount)).to.be.revertedWith("only vaults")

    })

    it("Eronious transfer of CRV and then withdraw with no voting vault", async () => {
        //transfer some underlying to cap contract instead of deposit?
        const transferAmount = BN("5e18")
        let balance = await s.CRV.balanceOf(s.Gus.address)
        expect(balance).to.eq(s.CRV_Amount, "Starting CRV amount correct")
        await s.LDO.connect(s.Gus).transfer(s.CappedCRV.address, transferAmount)
        await mineBlock()

        //try to withdraw - no voting vault
        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedCRV.address, transferAmount)).to.be.revertedWith("only vaults")

    })

    it("Try to withdraw eronious transfer after minting a voting vault", async () => {
        const transferAmount = BN("5e18")

        //mint a voting vault
        await s.VotingVaultController.connect(s.Gus).mintVault(gusVaultId)
        await mineBlock()

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedLDO.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")
    })
    it("Try to withdraw eronious transfer after minting a voting vault", async () => {
        const transferAmount = BN("5e18")

        //mint a voting vault
        await s.VotingVaultController.connect(s.Gus).mintVault(gusVaultId)
        await mineBlock()

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedDYDX.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")
    })
    it("Try to withdraw eronious transfer after minting a voting vault", async () => {
        const transferAmount = BN("5e18")

        //mint a voting vault
        await s.VotingVaultController.connect(s.Gus).mintVault(gusVaultId)
        await mineBlock()

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedCRV.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")
    })

    /**
       
       it("Try to withdraw more capped LDO than is possible given some cap tokens", async () => {
  
          await s.CappedLDO.connect(s.Frank).setCap(BN("51e24"))
          await mineBlock()
          showBody("abouda")
          let b = await s.LDO.balanceOf(s.Gus.address)
          showBody("Bal: ", await toNumber(b))
  
          const allowance = await s.LDO.allowance(s.Gus.address, s.CappedLDO.address)
  
          showBody("Allowance: ", await toNumber(allowance))
          showBody("Raw Alowa: ", allowance)
  
          showBody("Dif: ", await toNumber(b.sub(allowance)))
  
          await s.LDO.connect(s.Gus).approve(s.CappedLDO.address, b.sub(allowance))
          await mineBlock()
          showBody("Approved")
  
  
          await s.CappedLDO.connect(s.Gus).deposit(BN("1e18"), gusVaultId)
          await mineBlock()
          showBody("deposited")
  
  
          let balance = await s.CappedLDO.balanceOf(gusVault.address)
          expect(balance).to.eq(BN("1e18"), "Balance is correct")
  
          showBody("trying")
  
  
          expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedLDO.address, BN("5e18"))).to.be.revertedWith("only cap token")
  
          //Withdraw the amount that was deposited
          await gusVault.connect(s.Gus).withdrawErc20(s.CappedLDO.address, BN("1e18"))
          await mineBlock()
          showBody("Withdrawn")
  
          //return cap to expected amount
          await s.CappedLDO.connect(s.Frank).setCap(s.LDO_Cap)
          await mineBlock()
          showBody("returned")
  
      })
       
     */

    it("Try to withdraw more capped DYDX than is possible given some cap tokens", async () => {

        await impersonateAccount(s.owner._address)

        await s.CappedDYDX.connect(s.owner).setCap(BN("51e24"))
        await mineBlock()
        await ceaseImpersonation(s.owner._address)


        await s.CappedDYDX.connect(s.Gus).deposit(BN("1e18"), gusVaultId)
        await mineBlock()

        let balance = await s.CappedDYDX.balanceOf(gusVault.address)
        expect(balance).to.eq(BN("1e18"), "Balance is correct")

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedDYDX.address, BN("5e18"))).to.be.revertedWith("only cap token")

        //Withdraw the amount that was deposited
        await gusVault.connect(s.Gus).withdrawErc20(s.CappedDYDX.address, BN("1e18"))
        await mineBlock()

        //return cap to expected amount
        await impersonateAccount(s.owner._address)
        await s.CappedDYDX.connect(s.owner).setCap(s.DYDX_Cap)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

    })
    it("Try to withdraw more capped CRV than is possible given some cap tokens", async () => {

        await expect(s.VaultController.connect(s.Andy).mintVault()).to.not
            .reverted;
        await mineBlock();
        let andyVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(andyVaultId)
        let andyVault = IVault__factory.connect(vaultAddress, s.Andy);
        expect(await andyVault.minter()).to.eq(s.Andy.address);

        await s.VotingVaultController.connect(s.Andy).mintVault(andyVaultId)
        await mineBlock()

        await impersonateAccount(s.owner._address)
        await s.CappedCRV.connect(s.owner).setCap(BN("51e24"))
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        await s.CRV.connect(s.Andy).approve(s.CappedCRV.address, BN("1e18"))
        await s.CappedCRV.connect(s.Andy).deposit(BN("1e18"), andyVaultId)
        await mineBlock()

        let balance = await s.CappedCRV.balanceOf(andyVault.address)
        expect(balance).to.eq(BN("1e18"), "Balance is correct")

        expect(andyVault.connect(s.Andy).withdrawErc20(s.CappedCRV.address, BN("5e18"))).to.be.revertedWith("only cap token")

        //Withdraw the amount that was deposited
        await andyVault.connect(s.Andy).withdrawErc20(s.CappedCRV.address, BN("1e18"))
        await mineBlock()


        //return cap to expected amount
        await impersonateAccount(s.owner._address)
        await s.CappedCRV.connect(s.owner).setCap(s.CRV_Cap)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

    })

    it("Try to withdraw from a vault that is not yours", async () => {
        const amount = BN("250e18")

        await expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedLDO.address, amount)).to.be.revertedWith("sender not minter")
        await expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedDYDX.address, amount)).to.be.revertedWith("sender not minter")
        await expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedCRV.address, amount)).to.be.revertedWith("sender not minter")

    })


    it("Withdraw Underlying LDO", async () => {

        const amount = BN("250e18")

        const startBal = await s.LDO.balanceOf(s.Bob.address)
        const startCapBal = await s.CappedLDO.balanceOf(s.BobVault.address)

        expect(startCapBal).to.be.gt(amount, "Enough Capped LDO")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedLDO.address, amount).catch(console.log)
        await mineBlock()

        let balance = await s.LDO.balanceOf(s.Bob.address).catch(console.log)
        expect(balance).to.eq(startBal.add(amount), "LDO balance changed as expected")

        balance = await s.CappedLDO.balanceOf(s.BobVault.address).catch(console.log)
        expect(balance).to.eq(startCapBal.sub(amount), "CappedBal balance changed as expected")

        //Deposit again to reset for further tests
        await s.LDO.connect(s.Bob).approve(s.CappedLDO.address, amount)
        await s.CappedLDO.connect(s.Bob).deposit(amount, s.BobVaultID)
        await mineBlock()
    })

    it("Withdraw Underlying DYDX", async () => {

        const amount = BN("250e18")

        const startDYDX = await s.LDO.balanceOf(s.Bob.address)
        const startCapDYDX = await s.CappedDYDX.balanceOf(s.BobVault.address)

        expect(startCapDYDX).to.be.gt(amount, "Enough capped DYDX")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedDYDX.address, amount).catch(console.log)
        await mineBlock()

        let balance = await s.DYDX.balanceOf(s.Bob.address).catch(console.log)
        expect(balance).to.eq(startDYDX.add(amount), "DYDX balance changed as expected")

        balance = await s.CappedDYDX.balanceOf(s.BobVault.address).catch(console.log)
        expect(balance).to.eq(startCapDYDX.sub(amount), "CappedDYDX balance changed as expected")

        //Deposit again to reset for further tests
        await s.DYDX.connect(s.Bob).approve(s.CappedDYDX.address, amount)
        await s.CappedDYDX.connect(s.Bob).deposit(amount, s.BobVaultID)
        await mineBlock()
    })



    it("Withdraw Underlying CRV", async () => {

        const amount = BN("250e18")

        const startCRV = await s.CRV.balanceOf(s.Bob.address)
        const startCapCRV = await s.CappedCRV.balanceOf(s.BobVault.address)

        expect(startCapCRV).to.be.gt(amount, "Enough capped CRV")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedCRV.address, amount).catch(console.log)
        await mineBlock()

        let balance = await s.CRV.balanceOf(s.Bob.address).catch(console.log)
        expect(balance).to.eq(startCRV.add(amount), "CRV balance changed as expected")

        balance = await s.CappedCRV.balanceOf(s.BobVault.address).catch(console.log)
        expect(balance).to.eq(startCapCRV.sub(amount), "CappedCRV balance changed as expected")

        //Deposit again to reset for further tests
        await s.CRV.connect(s.Bob).approve(s.CappedCRV.address, amount)
        await s.CappedCRV.connect(s.Bob).deposit(amount, s.BobVaultID)
        await mineBlock()
    })



})
