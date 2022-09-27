import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"

import { BN } from "../../../util/number";
import {
    IVault__factory,
    VotingVault,
    IVault,
    VotingVault__factory,
    CurveMaster__factory,
    curve
} from "../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
} from "../../../util/block";
import { toNumber, getGas } from "../../../util/math";

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
        expect(s.CappedBal.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
        expect(s.CappedAave.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
    })

    it("Deposit underlying", async () => {
        expect(await s.BAL.balanceOf(s.Bob.address)).to.eq(s.balAmount, "Bob has the expected amount of BAL")
        expect(await s.AAVE.balanceOf(s.Bob.address)).to.eq(s.aaveAmount, "Bob has the expected amount of Aave")


        let caBalance = await s.CappedBal.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped BAL at the start")

        caBalance = await s.CappedAave.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped Aave at the start")


        await s.BAL.connect(s.Bob).approve(s.CappedBal.address, s.balAmount)
        await s.CappedBal.connect(s.Bob).deposit(s.balAmount, s.BobVaultID)
        await mineBlock()

        await s.AAVE.connect(s.Bob).approve(s.CappedAave.address, s.aaveAmount)
        await s.CappedAave.connect(s.Bob).deposit(s.aaveAmount, s.BobVaultID)
        await mineBlock()


        caBalance = await s.CappedBal.balanceOf(s.Bob.address)
        expect(caBalance).to.eq(0, "Bob holds 0 capped ENS after deposit")

        caBalance = await s.CappedBal.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.balAmount, "Bob's vault received the capped Bal tokens")

        caBalance = await s.CappedAave.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.aaveAmount, "Bob's vault received the capped Aave tokens")
    })

    it("Try to exceed the balancer cap", async () => {


        await s.CappedBal.connect(s.Frank).setCap(s.balAmount)
        await mineBlock()

        const cap = await s.CappedBal.getCap()
        expect(cap).to.eq(s.balAmount, "Cap is still correct")
        expect(await s.CappedBal.totalSupply()).to.eq(cap, "Cap reached")

        await s.BAL.connect(s.Gus).approve(s.CappedBal.address, 1)
        await mineBlock()
        expect(s.CappedBal.connect(s.Gus).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")

        await s.CappedBal.connect(s.Frank).setCap(s.BalCap)
        await mineBlock()
    })

    it("Try to exceed the aave cap", async () => {


        await s.CappedAave.connect(s.Frank).setCap(s.aaveAmount)
        await mineBlock()

        const cap = await s.CappedAave.getCap()
        expect(cap).to.eq(s.aaveAmount, "Cap is still correct")
        expect(await s.CappedAave.totalSupply()).to.eq(cap, "Cap reached")

        await s.AAVE.connect(s.Gus).approve(s.CappedAave.address, 1)
        await mineBlock()
        expect(s.CappedAave.connect(s.Gus).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")

        await s.CappedAave.connect(s.Frank).setCap(s.AaveCap)
        await mineBlock()
    })

        it("No vault", async () => {
            const amount = BN("5e18")
            const startBal = await s.BAL.balanceOf(s.Gus.address)
            expect(startBal).to.eq(s.balAmount, "Balance correct")
    
            await s.BAL.connect(s.Gus).approve(s.CappedBal.address, amount)
            expect(s.CappedBal.connect(s.Gus).deposit(amount, 99999)).to.be.revertedWith("invalid vault")
        })
        /**
        it("Deposit with no voting vault", async () => {
            const amount = BN("5e18")
    
            const startBal = await s.ENS.balanceOf(s.Gus.address)
            expect(startBal).to.eq(s.ENS_AMOUNT, "Balance correct")
    
    
            //mint regular vault for gus
            await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
                .reverted;
            await mineBlock();
            gusVaultId = await s.VaultController.vaultsMinted()
            let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
            gusVault = IVault__factory.connect(vaultAddress, s.Gus);
            expect(await gusVault.minter()).to.eq(s.Gus.address);
    
            await s.ENS.connect(s.Gus).approve(s.CappedENS.address, amount)
            expect(s.CappedENS.connect(s.Gus).deposit(amount, gusVaultId)).to.be.revertedWith("invalid voting vault")
        })
    
        it("Eronious transfer and then withdraw with no voting vault", async () => {
            //transfer some underlying to cap contract instead of deposit?
            const transferAmount = BN("5e18")
            let balance = await s.ENS.balanceOf(s.Gus.address)
            expect(balance).to.eq(s.ENS_AMOUNT, "Starting ENS amount correct")
            await s.ENS.connect(s.Gus).transfer(s.CappedENS.address, transferAmount)
            await mineBlock()
    
            //try to withdraw - no voting vault
            expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedENS.address, transferAmount)).to.be.revertedWith("only vaults")
    
        })
    
        it("Try to withdraw eronious transfer after minting a voting vault", async () => {
            const transferAmount = BN("5e18")
    
            //mint a voting vault
            await s.VotingVaultController.connect(s.Gus).mintVault(gusVaultId)
            await mineBlock()
    
            expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedENS.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")
        })
    
        it("Try to withdraw more than is possible given some cap tokens", async () => {
    
    
            await s.CappedENS.connect(s.Frank).setCap(BN("51e24"))
            await mineBlock()
    
            await s.CappedENS.connect(s.Gus).deposit(BN("1e18"), gusVaultId)
            await mineBlock()
    
            let balance = await s.CappedENS.balanceOf(gusVault.address)
            expect(balance).to.eq(BN("1e18"), "Balance is correct")
    
            expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedENS.address, BN("5e18"))).to.be.revertedWith("only cap token")
    
            //Withdraw the amount that was deposited
            await gusVault.connect(s.Gus).withdrawErc20(s.CappedENS.address, BN("1e18"))
            await mineBlock()
    
            //return cap to expected amount
            await s.CappedENS.connect(s.Frank).setCap(s.ENS_CAP)
            await mineBlock()
    
    
    
        })
    
        it("Try to withdraw from a vault that is not yours", async () => {
            const amount = BN("250e18")
    
            await expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedENS.address, amount)).to.be.revertedWith("sender not minter")
        })
    
    
        it("Withdraw Underlying", async () => {
    
            const amount = BN("250e18")
    
            const startENS = await s.ENS.balanceOf(s.Bob.address)
            const startCapENS = await s.CappedENS.balanceOf(s.BobVault.address)
    
            expect(startCapENS).to.be.gt(amount, "Enough Capped ENS")
    
            await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedENS.address, amount).catch(console.log)
            await mineBlock()
    
            let balance = await s.ENS.balanceOf(s.Bob.address).catch(console.log)
            expect(balance).to.eq(startENS.add(amount), "ENS balance changed as expected")
    
            balance = await s.CappedENS.balanceOf(s.BobVault.address).catch(console.log)
            expect(balance).to.eq(startCapENS.sub(amount), "CappedENS balance changed as expected")
    
            //Deposit again to reset for further tests
            await s.ENS.connect(s.Bob).approve(s.CappedENS.address, amount)
            await s.CappedENS.connect(s.Bob).deposit(amount, s.BobVaultID)
            await mineBlock()
        })
         
     */
})








