import { s } from "../scope";
import { showBody, showBodyCyan } from "../../../util/format";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { toNumber } from "../../../util/math";
import {
    VotingVault,
    IVault,
    IVault__factory
} from "../../../typechain-types";
import { stealMoney } from "../../../util/money";
import { oa } from "../../../util/addresser";
import { hardhat_mine, hardhat_mine_timed } from "../../../util/block";
import { BN } from "../../../util/number";
require("chai").should();
const aUSDCminter = "0x24a44aef48AEB27C7708DABFccDa14B41FbF0aE1"//"0xC9B826BAD20872EB29f9b1D8af4BefE8460b50c6"//kyberswap exploiter


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
describe("Testing CappedToken functions using aUSDC", () => {
    let wrappedAmount: BigNumber
    let gusVaultId: BigNumber
    let gusVault: IVault
    let gusVotingVault: VotingVault
    before(async () => {
        //steal money now to account for rebase
        showBodyCyan((await s.aUSDC.balanceOf(aUSDCminter)))
        await stealMoney(aUSDCminter, s.Carol.address, oa.aOptUsdcAddress, s.aUSDCamount)
        await stealMoney(aUSDCminter, s.Bob.address, oa.aOptUsdcAddress, s.aUSDCamount)

    })
    it("Deposit underlying", async () => {
        //some appreciation due to rebase of underlying
        expect((await s.aUSDC.balanceOf(s.Bob.address)).toNumber()).to.be.closeTo(s.aUSDCamount.toNumber(), 10, "Bob has the expected amount of aUSDC")

        let caBalance = await s.CappedOAUSDC.balanceOf(s.Bob.address)
        expect(caBalance).to.eq(0, "Bob holds 0 capped aUSDC at the start")

        caBalance = await s.CappedOAUSDC.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped aUSDC at the start")

        await s.aUSDC.connect(s.Bob).approve(s.CappedOAUSDC.address, s.aUSDCamount)
        await s.CappedOAUSDC.connect(s.Bob).deposit(s.aUSDCamount, s.BobVaultID)

        caBalance = await s.aUSDC.balanceOf(s.Bob.address)
        expect(caBalance.toNumber()).to.be.closeTo(0, 100, "Bob holds ~0 capped aUSDC after deposit")

        wrappedAmount = await s.CappedOAUSDC.balanceOf(s.BobVault.address)
        showBodyCyan("Resulting wrapped balance: ", await toNumber(wrappedAmount))
        // expect(caBalance).to.eq(s.aUSDCamount, "Bob's vault received the capped aUSDC tokens")

    })

    it("Check token destinations and verify exchange rate", async () => {

        const initialUnderlying = await s.aUSDC.balanceOf(s.CappedOAUSDC.address)
        expect(initialUnderlying.toNumber()).to.be.closeTo(s.aUSDCamount.toNumber(), 100, "Wrapper contract holds the underlying")

        //balance = await s.CappedOAUSDC.balanceOf(s.BobVault.address)
        //expect(balance).to.eq(s.aUSDCamount, "Bob's regular vault holds the wrapped capTokens")

        //elapse time
        await hardhat_mine_timed(2592000, 2)//~60 days w/ 2 seconds block time on op

        let balance = await s.aUSDC.balanceOf(s.CappedOAUSDC.address)
        let delta = balance.sub(s.aUSDCamount)
        const underlyingBalance = await s.CappedOAUSDC.balanceOfUnderlying(s.BobVault.address)
        expect(delta.toNumber()).to.be.closeTo((underlyingBalance.sub(s.aUSDCamount)).toNumber(), 10, "Reported value is correct")
    })

    it("Elapse more time and withdraw", async () => {
        const underlyingWithdrawAmount = s.aUSDCamount.div(2)

        //elapse time
        await hardhat_mine_timed(2592000, 2)//~60 days w/ 2 seconds block time on op
        const initialUnderlying = await s.aUSDC.balanceOf(s.CappedOAUSDC.address)
        const initialSupply = await s.CappedOAUSDC.totalSupply()


        let balance = await s.aUSDC.balanceOf(s.CappedOAUSDC.address)
        let delta = balance.sub(s.aUSDCamount)
        const underlyingBalance = await s.CappedOAUSDC.balanceOfUnderlying(s.BobVault.address)
        expect(delta.toNumber()).to.be.closeTo((underlyingBalance.sub(s.aUSDCamount)).toNumber(), 100, "Reported value is correct")

        const amountToWithdraw = await s.CappedOAUSDC.underlyingToWrapper(underlyingWithdrawAmount)

        //withdraw some but not all
        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedOAUSDC.address, amountToWithdraw)

        //verify
        //Bob should now have ~1/2 of the original input amount
        balance = await s.aUSDC.balanceOf(s.Bob.address)
        expect(balance.toNumber()).to.be.closeTo(underlyingWithdrawAmount.toNumber(), 100, "Bob received the correct amount of underlying tokens")

        //remaining underlying for this test should now be initialUnderlying reduced by underlyingWithdrawAmount
        balance = await s.aUSDC.balanceOf(s.CappedOAUSDC.address)
        expect(balance.toNumber()).to.be.closeTo(initialUnderlying.sub(underlyingWithdrawAmount), 100, "underlying balance decremented correctly")

        //Wrapper total supply should be reduced by exactly amountToWithdraw
        const ts = await s.CappedOAUSDC.totalSupply()
        expect(ts).to.eq(initialSupply.sub(amountToWithdraw), "Total Supply Correct")

    })

    it("Try to transfer", async () => {
        expect(s.CappedOAUSDC.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
    })

    it("Try to exceed the cap", async () => {
        const cap = await s.CappedOAUSDC.getCap()
        expect(cap).to.eq(s.aUSDCcap, "Cap is still correct")

        //set cap to current 
        await s.CappedOAUSDC.connect(s.Frank).setCap(await s.aUSDC.balanceOf(s.CappedOAUSDC.address))

        await s.aUSDC.connect(s.Carol).approve(s.CappedOAUSDC.address, 1)
        expect(s.CappedOAUSDC.connect(s.Carol).deposit(1, s.CaroLVaultID)).to.be.revertedWith("cap reached")

        //reset cap 
        await s.CappedOAUSDC.connect(s.Frank).setCap(s.aUSDCcap)

    })

    it("Try to transfer", async () => {
        expect(s.CappedOAUSDC.connect(s.Bob).transfer(s.Frank.address, BN("10e18"))).to.be.revertedWith("only vaults")
    })

    it("No vault", async () => {
        //fund gus
        await stealMoney(aUSDCminter, s.Gus.address, oa.aOptUsdcAddress, s.aUSDCamount)

        const amount = BN("5e18")
        const startBal = await s.aUSDC.balanceOf(s.Gus.address)
        expect(startBal).to.be.gt(s.aUSDCamount, "Balance correct")

        await s.aUSDC.connect(s.Gus).approve(s.CappedOAUSDC.address, amount)
        expect(s.CappedOAUSDC.connect(s.Gus).deposit(amount, 99999)).to.be.revertedWith("invalid vault")
    })

    it("Deposit with no voting vault", async () => {
        const amount = BN("5e18")

        const startBal = await s.aUSDC.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.aUSDCamount, "Balance correct")


        //mint regular vault for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted;
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus);
        expect(await gusVault.minter()).to.eq(s.Gus.address);

        await s.aUSDC.connect(s.Gus).approve(s.CappedOAUSDC.address, amount)
        expect(s.CappedOAUSDC.connect(s.Gus).deposit(amount, gusVaultId)).to.be.revertedWith("invalid voting vault")
    })
    /**
      it("Eronious transfer and then withdraw with no voting vault", async () => {
          //transfer some underlying to cap contract instead of deposit?
          const transferAmount = BN("5e18")
          let balance = await s.aUSDC.balanceOf(s.Gus.address)
          expect(balance).to.eq(s.aUSDCamount, "Starting aUSDC amount correct")
          await s.aUSDC.connect(s.Gus).transfer(s.CappedOAUSDC.address, transferAmount)
  
          //try to withdraw - no voting vault
          expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedOAUSDC.address, transferAmount)).to.be.revertedWith("only vaults")
  
      })
  
      it("Try to withdraw eronious transfer after minting a voting vault", async () => {
          const transferAmount = BN("5e18")
  
          //mint a voting vault
          await s.VotingVaultController.connect(s.Gus).mintVault(gusVaultId)
  
          expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedOAUSDC.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")
      })
  
      it("Try to withdraw more than is possible given some cap tokens", async () => {
  
          await s.CappedOAUSDC.connect(s.Frank).setCap(BN("501e18"))
  
          await s.CappedOAUSDC.connect(s.Gus).deposit(BN("1e18"), gusVaultId)
  
          let balance = await s.CappedOAUSDC.balanceOf(gusVault.address)
          expect(balance).to.eq(BN("1e18"), "Balance is correct")
  
          expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedOAUSDC.address, BN("5e18"))).to.be.revertedWith("ERC20: burn amount exceeds balance")
  
          //Withdraw the amount that was deposited
          await gusVault.connect(s.Gus).withdrawErc20(s.CappedOAUSDC.address, BN("1e18"))
  
          //return cap to expected amount
          await s.CappedOAUSDC.connect(s.Frank).setCap(BN("500e18"))
  
      })
  
      it("Try to withdraw from a vault that is not yours", async () => {
          const amount = BN("250e18")
  
          expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedOAUSDC.address, amount)).to.be.revertedWith("sender not minter")
      })
  
  
      it("Withdraw Underlying", async () => {
  
          const amount = BN("250e18")
  
          const startaUSDC = await s.aUSDC.balanceOf(s.Bob.address)
          const startCapaUSDC = await s.CappedOAUSDC.balanceOf(s.BobVault.address)
  
          expect(startCapaUSDC).to.be.gt(amount, "Enough CapaUSDC")
  
          await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedOAUSDC.address, amount)
  
          let balance = await s.aUSDC.balanceOf(s.Bob.address)
          expect(balance).to.eq(startaUSDC.add(amount), "aUSDC balance changed as expected")
  
          balance = await s.CappedOAUSDC.balanceOf(s.BobVault.address)
          expect(balance).to.eq(startCapaUSDC.sub(amount), "CappedaUSDC balance changed as expected")
  
          //Deposit again to reset for further tests
          await s.aUSDC.connect(s.Bob).approve(s.CappedOAUSDC.address, amount)
          await s.CappedOAUSDC.connect(s.Bob).deposit(amount, s.BobVaultID)
      })
       */
})
