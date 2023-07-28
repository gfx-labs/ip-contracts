import { s } from "./scope"
import { expect, assert } from "chai"
import { showBody, showBodyCyan } from "../../util/format"
import { BN } from "../../util/number"
import { advanceBlockHeight, mineBlock } from "../../util/block"
import { CappedGovToken__factory, CappedNonStandardToken__factory, IVault, IVault__factory, VotingVault, VotingVault__factory } from "../../typechain-types"
import { getGas, toNumber } from "../../util/math"
import { ethers } from "hardhat"
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers"
import { ceaseImpersonation } from "../../util/impersonator"
import { DeployContract } from "../../util/deploy"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { JsonRpcSigner } from "@ethersproject/providers"

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

describe("wBTC scaling fix", () => {

    const owner = ethers.provider.getSigner("0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89")
    const testVault = 6
    let vaultOwnerAddr: string
    let minter: JsonRpcSigner
    let vault: IVault
    let votingVault: VotingVault

    //https://optimistic.etherscan.io/tx/0xd8f672e367b1e8ad624a28162af37463960ce64c8f0578216c4ff11192c48d3c
    it("Gather vault info", async () => {

        vault = IVault__factory.connect(await s.VaultController.vaultAddress(testVault), s.Frank)
        votingVault = VotingVault__factory.connect(await s.VotingVaultController._vaultId_votingVaultAddress(testVault), s.Frank)
        vaultOwnerAddr = await vault.minter()
        minter = ethers.provider.getSigner(vaultOwnerAddr)

        showBody("Vault: ", vault.address)
        showBody("VVLT : ", votingVault.address)

        //verify wbtc
        let balance = await s.WBTC.balanceOf(votingVault.address)
        expect(balance).to.be.gt(0, "WBTC in voting vault")
        balance = await s.CappedWbtc.balanceOf(vault.address)
        expect(balance).to.be.gt(0, "Capped wBTC in vault")
    })

    it("Upgrade cwBTC", async () => {
        await impersonateAccount(owner._address)

        const newImplementation = await DeployContract(new CappedNonStandardToken__factory(owner), owner)
        await newImplementation.deployed()

        const tx = await s.ProxyAdmin.connect(owner).upgrade(s.CappedWbtc.address, newImplementation.address)
        await tx.wait()
        await ceaseImpersonation(owner._address)
    })

    /**
     * Deposit amount is 1262725 - 0.1262725 wBTC
     * BalanceOf capped token should be => 126272500000000000 => 0.1262725 e18
     * 
     * TOTAL SUPPLY OF CAPPED WBTC SHOULD BE 0 AT THE TIME OF UPGRADE
     */
    it("Test the fix", async () => {

        const startBp = await s.VaultController.vaultBorrowingPower(s.BobVaultID)
        //showBody("Start BP: ", startBp)

        let balance = await s.WBTC.balanceOf(s.Bob.address)
        expect(balance).to.eq(BN("1e7"), "0.1 wBTC terms")

        await s.WBTC.connect(s.Bob).approve(s.CappedWbtc.address, balance)
        await s.CappedWbtc.connect(s.Bob).deposit(balance, s.BobVaultID)
        const endBp = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

        balance = await s.WBTC.balanceOf(s.Bob.address)
        expect(balance).to.eq(BN("0"), "All wbtc deposited")

        balance = await s.CappedWbtc.balanceOf(s.BobVault.address)
        expect(balance).to.eq(BN("1e17"), "0.1e18")

        //LTV 80%
        const bpIncrease = endBp.sub(startBp)
        const value = ((await s.Oracle.getLivePrice(s.CappedWbtc.address)).mul(balance)).div(BN("1e18"))
        const expected = await toNumber(value) * 0.8
        expect(expected).to.be.closeTo(await toNumber(bpIncrease), 0.1, "Borrow power increase is as expected")

        //test withdraw
        await s.BobVault.connect(s.Bob).withdrawErc20(s.CappedWbtc.address, balance)
        balance = await s.WBTC.balanceOf(s.Bob.address)
        expect(balance).to.eq(BN("1e7"), "Correct amount of wBTC received")

        balance = await s.CappedWbtc.balanceOf(s.BobVault.address)
        expect(balance).to.eq(BN("0"), "Correct amount of cwBTC burned")


    })
})