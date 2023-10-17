import { s } from "../scope";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator";

import { BN } from "../../../../util/number";
import {
    IVault__factory,
    VotingVault,
    IVault,
    VotingVault__factory
} from "../../../../typechain-types";
import {
    mineBlock
} from "../../../../util/block";
import { showBody } from "../../../../util/format";
import { toNumber } from "../../../../util/math";

require("chai").should();
describe("Testing CappedToken functions", () => {
    let gusVaultId: BigNumber
    let gusVault: IVault
    let gusVotingVault: VotingVault

    it("Try to transfer", async () => {
        expect(s.CappedWOETH.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")
        expect(s.CappedWOETH.connect(s.Bob).transfer(s.Carol.address, BN("1e18"))).to.be.revertedWith("only vaults")

    })

    it("Deposit underlying", async () => {
        expect(await s.OETH.balanceOf(s.Bob.address)).to.eq(s.OETH_AMOUNT, "Bob has the expected amount of WOETH")

        s.WOETH_AMOUNT = await s.CappedWOETH.balanceOf(s.BobVault.address)
        expect(s.WOETH_AMOUNT).to.eq(0, "Bob's vault holds 0 capped WOETH at the start")

        await s.OETH.connect(s.Bob).approve(s.CappedWOETH.address, s.OETH_AMOUNT)
        await s.CappedWOETH.connect(s.Bob).deposit(s.OETH_AMOUNT, s.BobVaultID, true)
        await mineBlock()

        //wrapped OETH balance should be less than OETH balance
        s.WOETH_AMOUNT = await s.CappedWOETH.balanceOf(s.BobVault.address)
        expect(s.WOETH_AMOUNT).to.be.lt(s.OETH_AMOUNT, "Bob's vault received the capped WOETH tokens")


    })

    it("Try to exceed the WOETH cap", async () => {

        await impersonateAccount(s.owner._address)
        await s.CappedWOETH.connect(s.owner).setCap(await s.CappedWOETH.totalSupply())
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

        const cap = await s.CappedWOETH.getCap()
        expect(await s.CappedWOETH.totalSupply()).to.eq(cap, "Cap reached")

        await s.OETH.connect(s.Gus).approve(s.CappedWOETH.address, 1)
        await mineBlock()
        expect(s.CappedWOETH.connect(s.Gus).deposit(1, s.BobVaultID, true)).to.be.revertedWith("cap reached")

        await impersonateAccount(s.owner._address)
        await s.CappedWOETH.connect(s.owner).setCap(s.OETH_CAP)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)
    })




    it("No vault", async () => {
        const amount = BN("5e18")
        const startBal = await s.OETH.balanceOf(s.Gus.address)
        expect(await toNumber(startBal)).to.eq(await toNumber(s.OETH_AMOUNT), "Balance correct")

        await s.OETH.connect(s.Gus).approve(s.CappedWOETH.address, amount)
        expect(s.CappedWOETH.connect(s.Gus).deposit(amount, 99999, true)).to.be.revertedWith("invalid vault")

    })

    it("Deposit WOETH with no voting vault", async () => {
        const amount = BN("5e18")

        const startBal = await s.OETH.balanceOf(s.Gus.address)
        expect(await toNumber(startBal)).to.eq(await toNumber(s.OETH_AMOUNT), "Balance correct")


        //mint regular vault for gus
        await expect(s.VaultController.connect(s.Gus).mintVault()).to.not
            .reverted;
        await mineBlock();
        gusVaultId = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(gusVaultId)
        gusVault = IVault__factory.connect(vaultAddress, s.Gus);
        expect(await gusVault.minter()).to.eq(s.Gus.address);

        await s.OETH.connect(s.Gus).approve(s.CappedWOETH.address, amount)
        expect(s.CappedWOETH.connect(s.Gus).deposit(amount, gusVaultId, true)).to.be.revertedWith("invalid voting vault")
    })



    it("Eronious transfer of WOETH and then withdraw with no voting vault", async () => {
        //transfer some underlying to cap contract instead of deposit?
        const transferAmount = BN("5e18")
        let balance = await s.OETH.balanceOf(s.Gus.address)
        expect(await toNumber(balance)).to.eq(await toNumber(s.OETH_AMOUNT), "Balance correct")
        await s.OETH.connect(s.Gus).transfer(s.CappedWOETH.address, transferAmount)
        await mineBlock()

        //try to withdraw - no voting vault
        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedWOETH.address, transferAmount)).to.be.revertedWith("only vaults")

    })

    it("Try to withdraw eronious transfer after minting a voting vault", async () => {
        const transferAmount = BN("5e18")

        //mint a voting vault
        await s.VotingVaultController.connect(s.Gus).mintVault(gusVaultId)
        await mineBlock()

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedWOETH.address, transferAmount)).to.be.revertedWith("ERC20: burn amount exceeds balance")

    })

    it("Try to withdraw more capped WOETH than is possible given some cap tokens", async () => {

        await impersonateAccount(s.owner._address)
        await s.CappedWOETH.connect(s.owner).setCap(BN("51e24"))
        await mineBlock()
        await ceaseImpersonation(s.owner._address)


        const depositAmount = BN("1e18")
        await s.OETH.connect(s.Gus).approve(s.CappedWOETH.address, depositAmount)
        await s.CappedWOETH.connect(s.Gus).deposit(depositAmount, gusVaultId, true)

        let balance = await s.CappedWOETH.balanceOf(gusVault.address)
        expect(await toNumber(balance)).to.be.closeTo(1, 0.1, "Balance is correct")

        expect(gusVault.connect(s.Gus).withdrawErc20(s.CappedWOETH.address, BN("5e18"))).to.be.revertedWith("only cap token")

        //Withdraw the amount that was deposited
        await gusVault.connect(s.Gus).withdrawErc20(s.CappedWOETH.address, await s.CappedWOETH.balanceOf(gusVault.address))

        //return cap to expected amount
        await impersonateAccount(s.owner._address)
        await s.CappedWOETH.connect(s.owner).setCap(s.OETH_CAP)
        await mineBlock()
        await ceaseImpersonation(s.owner._address)

    })


    it("Try to withdraw from a vault that is not yours", async () => {
        const amount = BN("250e18")

        await expect(s.BobVault.connect(s.Carol).withdrawErc20(s.CappedWOETH.address, amount)).to.be.revertedWith("sender not minter")


    })

    it("Withdraw Underlying WOETH", async () => {

        const capBal = await s.CappedWOETH.balanceOf(s.BobVault.address)
        const startOethBal = await s.OETH.balanceOf(s.Bob.address)

        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedWOETH.address, capBal)

        let balance = await s.OETH.balanceOf(s.Bob.address)
        expect(await toNumber(balance)).to.be.gt(await toNumber(startOethBal.add(capBal)), "WOETH balance changed as expected")

        //Deposit again to reset for further tests
        await s.OETH.connect(s.Bob).approve(s.CappedWOETH.address, await s.OETH.balanceOf(s.Bob.address))
        await s.CappedWOETH.connect(s.Bob).deposit(await s.OETH.balanceOf(s.Bob.address), s.BobVaultID, true)
    })
})
