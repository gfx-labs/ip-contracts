import { s } from "../scope";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator";

import { BN } from "../../../../util/number";
import {
    IVault__factory,
    VotingVault,
    IVault,
    VotingVault__factory, VaultController__factory
} from "../../../../typechain-types";
import {
    mineBlock
} from "../../../../util/block";


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

    it("Verify LTV ", async () => {
        const VaultControllerVerbose = VaultController__factory.connect(s.VaultController.address, s.Frank)
        let LTV = await VaultControllerVerbose._tokenId_tokenLTV(await VaultControllerVerbose._tokenAddress_tokenId(s.UNI.address))
        expect(LTV).to.eq(s.NEW_UNI_LTV, "New UNI LTV set correctly")

        LTV = await VaultControllerVerbose._tokenId_tokenLTV(await VaultControllerVerbose._tokenAddress_tokenId(s.CappedZRX.address))
        expect(LTV).to.eq(s.ZRX_LTV, "ZRX LTV is correct, known bug is confirmed fixed")

    })

})



describe("Testing CappedToken functions", () => {
    let gusVaultId: BigNumber
    let gusVault: IVault
    let gusVotingVault: VotingVault

    it("Try to transfer", async () => {
        expect(s.CappedZRX.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
        expect(s.CappedZRX.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")

    })


    it("Deposit underlying", async () => {
        expect(await s.ZRX.balanceOf(s.Bob.address)).to.eq(s.ZRX_AMOUNT, "Bob has the expected amount of ZRX")
        expect(await s.UNI.balanceOf(s.Bob.address)).to.eq(s.UNI_AMOUNT, "Bob has the expected amount of UNI")

        let caBalance = await s.CappedZRX.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped ZRX at the start")
        caBalance = await s.UNI.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 UNI at the start")

        await s.ZRX.connect(s.Bob).approve(s.CappedZRX.address, s.ZRX_AMOUNT)
        await s.CappedZRX.connect(s.Bob).deposit(s.ZRX_AMOUNT, s.BobVaultID)
        await mineBlock()

        await s.UNI.connect(s.Bob).transfer(s.BobVault.address, s.UNI_AMOUNT)
        await mineBlock()



        caBalance = await s.CappedZRX.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.ZRX_AMOUNT, "Bob's vault received the capped ZRX tokens")

        caBalance = await s.UNI.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.UNI_AMOUNT, "Bob's vault received the UNI tokens")


    })

    it("Try to exceed the ZRX cap", async () => {

        await impersonateAccount(s.owner._address)
        await s.CappedZRX.connect(s.owner).setCap(s.ZRX_AMOUNT)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        const cap = await s.CappedZRX.getCap()
        expect(cap).to.eq(s.ZRX_AMOUNT, "Cap is still correct")
        expect(await s.CappedZRX.totalSupply()).to.eq(cap, "Cap reached")

        await s.ZRX.connect(s.Gus).approve(s.CappedZRX.address, 1)
        await mineBlock()
        expect(s.CappedZRX.connect(s.Gus).deposit(1, s.BobVaultID)).to.be.revertedWith("cap reached")

        await impersonateAccount(s.owner._address)
        await s.CappedZRX.connect(s.owner).setCap(s.ZRX_CAP)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)
    })

    


    it("No vault", async () => {
        const amount = BN("5e18")
        const startBal = await s.ZRX.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.ZRX_AMOUNT, "Balance correct")

        //await s.ZRX.connect(s.Gus).approve(s.CappedZRX.address, amount) // ZRX is not ERC20 - no approval
        //showBody("Approved")
        expect(s.CappedZRX.connect(s.Gus).deposit(amount, 99999)).to.be.revertedWith("invalid vault")

    })

    it("Deposit ZRX with no voting vault", async () => {
        const amount = BN("5e18")

        const startBal = await s.ZRX.balanceOf(s.Gus.address)
        expect(startBal).to.eq(s.ZRX_AMOUNT, "Balance correct")


        //mint regular vault for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted;
        await mineBlock();
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus);
        expect(await gusVault.minter()).to.eq(s.Gus.address);

        //await s.ZRX.connect(s.Gus).approve(s.CappedZRX.address, amount)
        expect(s.CappedZRX.connect(s.Gus).deposit(amount, gusVaultId)).to.be.revertedWith("invalid voting vault")
    })



    it("Eronious transfer of ZRX and then withdraw with no voting vault", async () => {
        //transfer some underlying to cap contract instead of deposit?
        const transferAmount = BN("5e18")
        let balance = await s.ZRX.balanceOf(s.Gus.address)
        expect(balance).to.eq(s.ZRX_AMOUNT, "Starting ZRX amount correct")
        await s.ZRX.connect(s.Gus).transfer(s.CappedZRX.address, transferAmount)
        await mineBlock()

        //try to withdraw - no voting vault
        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedZRX.address, transferAmount)).to.be.revertedWith("only vaults")

    })

    it("Try to withdraw eronious transfer after minting a voting vault", async () => {
        const transferAmount = BN("5e18")

        //mint a voting vault
        await s.VotingVaultController.connect(s.Gus).mintVault(gusVaultId)
        await mineBlock()

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedZRX.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")

    })

    it("Try to withdraw more capped ZRX than is possible given some cap tokens", async () => {

        await impersonateAccount(s.owner._address)
        await s.CappedZRX.connect(s.owner).setCap(BN("51e24"))
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        let b = await s.ZRX.balanceOf(s.Gus.address)

        const allowance = await s.ZRX.allowance(s.Gus.address, s.CappedZRX.address)

        await s.ZRX.connect(s.Gus).approve(s.CappedZRX.address, b.sub(allowance))
        await mineBlock()

        await s.CappedZRX.connect(s.Gus).deposit(BN("1e18"), gusVaultId)
        await mineBlock()

        let balance = await s.CappedZRX.balanceOf(gusVault.address)
        expect(balance).to.eq(BN("1e18"), "Balance is correct")

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedZRX.address, BN("5e18"))).to.be.revertedWith("only cap token")

        //Withdraw the amount that was deposited
        await gusVault.connect(s.Gus).withdrawErc20(s.CappedZRX.address, BN("1e18"))
        await mineBlock()

        //return cap to expected amount
        await impersonateAccount(s.owner._address)
        await s.CappedZRX.connect(s.owner).setCap(s.ZRX_CAP)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

    })


    it("Try to withdraw from a vault that is not yours", async () => {
        const amount = BN("250e18")

        await expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedZRX.address, amount)).to.be.revertedWith("sender not minter")


    })

    it("Withdraw Underlying ZRX", async () => {

        const amount = await s.CappedZRX.balanceOf(s.BobVault.address)

        const startBal = await s.ZRX.balanceOf(s.Bob.address)
        const startCapBal = amount

        expect(startCapBal).to.be.gt(s.ZRX_AMOUNT.sub(1), "Enough Capped ZRX")

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedZRX.address, amount).catch(console.log)
        await mineBlock()

        let balance = await s.ZRX.balanceOf(s.Bob.address).catch(console.log)
        expect(balance).to.eq(startBal.add(amount), "ZRX balance changed as expected")

        balance = await s.CappedZRX.balanceOf(s.BobVault.address).catch(console.log)
        expect(balance).to.eq(startCapBal.sub(amount), "CappedBal balance changed as expected")

        //Deposit again to reset for further tests
        await s.ZRX.connect(s.Bob).approve(s.CappedZRX.address, amount)
        await s.CappedZRX.connect(s.Bob).deposit(amount, s.BobVaultID)
        await mineBlock()
    })

  
})
