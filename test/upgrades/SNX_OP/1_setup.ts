import { expect, assert } from "chai"
import { network } from "hardhat"
import hre from 'hardhat'
import { stealMoney } from "../../../util/money"
import { showBody } from "../../../util/format"
import { toNumber } from "../../../util/math"

import { BN } from "../../../util/number"
import { s } from "./scope"
import { advanceBlockHeight, reset, mineBlock, resetCurrentOP, currentBlock } from "../../../util/block"
import { CappedGovToken__factory, CurveMaster__factory, IERC20__factory, IOracleMaster__factory, IUSDI__factory, IVOTE__factory, ProxyAdmin__factory, ThreeLines0_100__factory, USDI__factory, VaultController__factory, VotingVaultController__factory } from "../../../typechain-types"
const { ethers } = require("hardhat")

require("chai").should()
// configurable variables
const bank = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"//balancer vault

describe("hardhat settings", () => {
    it("reset hardhat network each run", async () => {
        expect(await resetCurrentOP()).to.not.throw
        const networkName = hre.network.name
        //expect(networkName).to.eq("OPTIMISM")
        const block = await currentBlock()
        expect(block.number).to.be.gt(105542401, "OP network confirmed")
        console.log("Testing on OPTIMISM as of block: ", block.number)

    })
    it("set automine", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw
    })
})

describe("Token Setup", () => {
    it("connect to signers", async () => {
        let accounts = await ethers.getSigners()
        s.Frank = accounts[0]
        s.Eric = accounts[5]
        s.Andy = accounts[6]
        s.Bob = accounts[7]
        s.Carol = accounts[8]
        s.Dave = accounts[9]
        s.Gus = accounts[10]
    })
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank)
        s.WETH = IERC20__factory.connect(s.wethAddress, s.Frank)
        s.WBTC = IERC20__factory.connect(s.wbtcAddress, s.Frank)
        s.OP = IERC20__factory.connect(s.opAddress, s.Frank)
    })
    it("Connect to OP deploys", async () => {
        s.VaultController = VaultController__factory.connect(s.d.VaultController, s.Frank)
        s.Oracle = IOracleMaster__factory.connect(s.d.Oracle, s.Frank)
        s.USDI = USDI__factory.connect(s.d.USDI, s.Frank)
        s.ProxyAdmin = ProxyAdmin__factory.connect(s.d.ProxyAdmin, s.Frank)
        s.VotingVaultController = VotingVaultController__factory.connect(s.d.VotingVaultController, s.Frank)
        s.Curve = CurveMaster__factory.connect(s.d.Curve, s.Frank)
        s.ThreeLines = ThreeLines0_100__factory.connect(s.d.ThreeLines, s.Frank)


    })
    it("Should succesfully transfer money", async () => {
        //showBody(`stealing ${s.Andy_USDC} to andy from ${s.usdcAddress}`)
        await stealMoney(bank, s.Andy.address, s.usdcAddress, s.Andy_USDC)

        //showBody(`stealing ${s.Dave_USDC} to dave from ${s.usdcAddress}`)
        await stealMoney(bank, s.Dave.address, s.usdcAddress, s.Dave_USDC)

        //showBody(`stealing ${s.Bob_WETH} weth to bob from ${s.wethAddress}`)
        const snxWhale = "0xF977814e90dA44bFA03b6295A0616a897441aceC"
        await stealMoney(snxWhale, s.Bob.address, s.snxAddress, s.Bob_SNX)

    })
})

describe("Sanity Check", () => {
    it("Verify deployment of VaultController proxy", async () => {
        const protocolFee = await s.VaultController.connect(s.Andy).protocolFee()
        await mineBlock()
        const expectedProtocolFee = BN("1e14")
        assert.equal(
            protocolFee.toString(),
            expectedProtocolFee.toString(),
            "VaultController Initialized"
        )
    })
    it("Verify deployment of USDi proxy", async () => {
        const reserveAddress = await s.USDI.reserveAddress()
        await mineBlock()
        const expectedReserveAddress = s.usdcAddress
        assert.equal(reserveAddress, expectedReserveAddress, "USDi Initialized")
    })
    it("Should return the right name, symbol, and decimals", async () => {
        expect(await s.USDI.name()).to.equal("opUSDI Token")
        expect(await s.USDI.symbol()).to.equal("opUSDI")
        expect(await s.USDI.decimals()).to.equal(18)
        expect(await s.USDI.owner()).to.equal(s.deployerAddr)
    })
    it(`The burner address should have ${BN(
        "1e18"
    ).toLocaleString()} fragment`, async () => {
        expect(await toNumber(await s.USDI.balanceOf("0x0000000000000000000000000000000000000000"))).to.be.gt(1, "Starting burner amount is at least 1")
    })
    it("the owner should be the Frank", async () => {
        expect(await s.USDI.owner()).to.eq(s.deployerAddr)
    })
})
