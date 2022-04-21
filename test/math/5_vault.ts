import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showHeader } from "../../util/format";
import { BN } from "../../util/number";
import { mineBlock } from "../../util/block";
import { IVault__factory } from "../../typechain-types";


describe("Vault setup:", () => {
    it("mint vaults", async () => {
        //showBody("bob mint vault")
        await expect(s.VaultController.connect(s.Bob).mintVault()).to.not.reverted;
        await mineBlock();
        let bobVault = await s.VaultController.VaultAddress(1)
        s.BobVault = IVault__factory.connect(
            bobVault,
            s.Bob,
        );
        expect(await s.BobVault.Minter()).to.eq(s.Bob.address)


        //showBody("carol mint vault")
        await expect(s.VaultController.connect(s.Carol).mintVault()).to.not.reverted;
        await mineBlock()
        let carolVault = await s.VaultController.VaultAddress(2)
        s.CarolVault = IVault__factory.connect(
            carolVault,
            s.Carol,
        );
        expect(await s.CarolVault.Minter()).to.eq(s.Carol.address)
    })
    it("vault deposits", async () => {
        await expect(s.WETH.connect(s.Bob).transfer(s.BobVault.address, s.Bob_WETH)).to.not.reverted;
        await expect(s.COMP.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_COMP)).to.not.reverted;
        await mineBlock();

        //showBody("bob transfer weth")
        expect(await s.BobVault.tokenBalance(s.wethAddress)).to.eq(s.Bob_WETH)

        //showBody("carol transfer comp")
        expect(await s.CarolVault.tokenBalance(s.compAddress)).to.eq(s.Carol_COMP)
    })
    it("carol should be able to delegate votes", async () => {
        await expect(s.CarolVault.delegateCompLikeTo(s.compVotingAddress, s.compAddress)).to.not.reverted;
        await mineBlock();
        const currentVotes = await s.COMP.connect(s.Carol).getCurrentVotes(s.compVotingAddress);
        //showBody("carol should have", currentVotes, "votes");
        expect(currentVotes).to.eq(s.Carol_COMP);
    });
})