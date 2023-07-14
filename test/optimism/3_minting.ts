import { s } from "./scope"
import { expect, assert } from "chai"
import { showBody, showBodyCyan } from "../../util/format"
import { BN } from "../../util/number"
import { advanceBlockHeight, mineBlock } from "../../util/block"
import { IVault__factory, VotingVault__factory } from "../../typechain-types"
import { getGas } from "../../util/math"

describe("Mint vaults", () => {
    it("mint vaults", async () => {
        //mint standard vault
        const mv = await s.VaultController.connect(s.Bob).mintVault()
        await mineBlock()
        showBodyCyan("vault mint gas cost", await getGas(mv))
        s.BobVaultID = await s.VaultController.vaultsMinted()
        let bobVault = await s.VaultController.vaultAddress(s.BobVaultID)
        s.BobVault = IVault__factory.connect(bobVault, s.Bob)
        expect(await s.BobVault.minter()).to.eq(s.Bob.address)

        //mint voting vault
        const mvv = await s.VotingVaultController.connect(s.Bob).mintVault(s.BobVaultID)
        await mineBlock()
        showBodyCyan("Gas to mint VotingVault: ", await getGas(mvv))
        let bobVV = await s.VotingVaultController._vaultId_votingVaultAddress(s.BobVaultID)
        s.BobVotingVault = VotingVault__factory.connect(bobVV, s.Bob)
        expect(s.BobVotingVault.address.toString().toUpperCase()).to.eq(bobVV.toString().toUpperCase(), "Bob's voting vault setup complete")

        //showBody("carol mint vault")
        await s.VaultController.connect(s.Carol).mintVault()
        await mineBlock()
        s.CarolVaultID = await s.VaultController.vaultsMinted()
        let carolVault = await s.VaultController.vaultAddress(s.CarolVaultID)
        s.CarolVault = IVault__factory.connect(carolVault, s.Carol)
        expect(await s.CarolVault.minter()).to.eq(s.Carol.address)

        await s.VotingVaultController.connect(s.Carol).mintVault(s.CarolVaultID)
        await mineBlock()
        let CarolVV = await s.VotingVaultController._vaultId_votingVaultAddress(s.CarolVaultID)
        s.CarolVotingVault = VotingVault__factory.connect(CarolVV, s.Carol)
        expect(s.CarolVotingVault.address.toString().toUpperCase()).to.eq(CarolVV.toString().toUpperCase(), "Carol's voting vault setup complete")
    })

    it("Deposit underlying", async () => {

        expect(await s.WETH.balanceOf(s.Bob.address)).to.eq(s.Bob_WETH, "Bob has the expected amount of WETH")

        let caBalance = await s.CappedWeth.balanceOf(s.Bob.address)
        expect(caBalance).to.eq(0, "Bob holds 0 capped WETH at the start")

        caBalance = await s.CappedWeth.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(0, "Bob's vault holds 0 capped WETH at the start")


        await s.WETH.connect(s.Bob).approve(s.CappedWeth.address, s.Bob_WETH)
        await s.CappedWeth.connect(s.Bob).deposit(s.Bob_WETH, s.BobVaultID)
        await mineBlock()


        caBalance = await s.CappedWeth.balanceOf(s.Bob.address)
        expect(caBalance).to.eq(0, "Bob holds 0 capped WETH after deposit")

        caBalance = await s.CappedWeth.balanceOf(s.BobVault.address)
        expect(caBalance).to.eq(s.Bob_WETH, "Bob's vault received the capped WETH tokens")

        //check destinations
        let balance = await s.WETH.balanceOf(s.BobVotingVault.address)
        expect(balance).to.eq(s.Bob_WETH, "Voting vault holds the underlying")

        balance = await s.CappedWeth.balanceOf(s.BobVault.address)
        expect(balance).to.eq(s.Bob_WETH, "Bob's regular vault holds the wrapped capTokens")


    })

    it("Deposit underlying", async () => {

        expect(await s.OP.balanceOf(s.Carol.address)).to.eq(s.Carol_OP, "Carol has the expected amount of OP")

        let caBalance = await s.CappedOp.balanceOf(s.Carol.address)
        expect(caBalance).to.eq(0, "Carol holds 0 capped OP at the start")

        caBalance = await s.CappedOp.balanceOf(s.CarolVault.address)
        expect(caBalance).to.eq(0, "Carol's vault holds 0 capped OP at the start")


        await s.OP.connect(s.Carol).approve(s.CappedOp.address, s.Carol_OP)
        await s.CappedOp.connect(s.Carol).deposit(s.Carol_OP, s.CarolVaultID)
        await mineBlock()


        caBalance = await s.CappedOp.balanceOf(s.Carol.address)
        expect(caBalance).to.eq(0, "Carol holds 0 capped OP after deposit")

        caBalance = await s.CappedOp.balanceOf(s.CarolVault.address)
        expect(caBalance).to.eq(s.Carol_OP, "Carol's vault received the capped OP tokens")

        //check destinations
        let balance = await s.OP.balanceOf(s.CarolVotingVault.address)
        expect(balance).to.eq(s.Carol_OP, "Voting vault holds the underlying")

        balance = await s.CappedOp.balanceOf(s.CarolVault.address)
        expect(balance).to.eq(s.Carol_OP, "Carol's regular vault holds the wrapped capTokens")


    })
})

describe("Mint USDi using USDC:", () => {
    it("andy deposits usdc for USDi", async () => {
        expect(await s.USDC.balanceOf(s.Andy.address)).to.eq(s.Andy_USDC)
        await s.USDC.connect(s.Andy).approve(s.USDI.address, s.Andy_USDC)
        await s.USDI.connect(s.Andy).deposit(s.Andy_USDC)
        await advanceBlockHeight(1)
        let av = BN(s.Andy_USDC).mul(BN("1e12"))
        expect(await s.USDI.balanceOf(await s.Andy.getAddress())).to.eq(av)
    })
    it("dave deposits usdc for USDi", async () => {
        expect(await s.USDC.balanceOf(s.Dave.address)).to.eq(s.Dave_USDC)
        await s.USDC.connect(s.Dave).approve(s.USDI.address, s.Dave_USDC)
        await s.USDI.connect(s.Dave).deposit(s.Dave_USDC)
        await advanceBlockHeight(1)
        let dv = BN(s.Dave_USDC).mul(BN("1e12"))
        expect(await s.USDI.balanceOf(s.Dave.address)).to.eq(dv)
    })
})