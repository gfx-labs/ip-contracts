import { expect, assert } from "chai"
import { network } from "hardhat"
import hre from 'hardhat'
import { stealMoney } from "../../util/money"
import { showBody } from "../../util/format"
import { toNumber } from "../../util/math"

import { BN } from "../../util/number"
import { s } from "./scope"
import { advanceBlockHeight, reset, mineBlock, resetCurrentOP, currentBlock, resetOP } from "../../util/block"
import { CappedGovToken__factory, CurveMaster__factory, IERC20__factory, IOracleMaster__factory, IUSDI__factory, IVOTE__factory, ProxyAdmin__factory, ThreeLines0_100__factory, USDI__factory, VaultController__factory, VotingVaultController__factory } from "../../typechain-types"
const { ethers } = require("hardhat")

require("chai").should()
// configurable variables
const bank = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"//balancer vault

describe("hardhat settings", () => {
    it("reset hardhat network each run", async () => {

        //await resetOP(107100000)
        await resetOP(107447070)//for testing of capped wbtc scaling
        const block = await currentBlock()
        expect(block.number).to.be.gt(107100000, "OP network confirmed")


    })
    it("set automine OFF", async () => {
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

        s.CappedWeth = CappedGovToken__factory.connect(s.d.CappedWeth, s.Frank)
        s.CappedWbtc = CappedGovToken__factory.connect(s.d.CappedWbtc, s.Frank)
        s.CappedOp = CappedGovToken__factory.connect(s.d.CappedOp, s.Frank)
        s.CappedWstEth = CappedGovToken__factory.connect(s.d.CappedWstEth, s.Frank)
        s.CappedReth = CappedGovToken__factory.connect(s.d.CappedRETH, s.Frank)

    })
    it("Should succesfully transfer money", async () => {
        //showBody(`stealing ${s.Andy_USDC} to andy from ${s.usdcAddress}`)
        await stealMoney(bank, s.Andy.address, s.usdcAddress, s.Andy_USDC)

        //showBody(`stealing ${s.Dave_USDC} to dave from ${s.usdcAddress}`)
        await stealMoney(bank, s.Dave.address, s.usdcAddress, s.Dave_USDC)

        //showBody(`stealing ${s.Bob_WETH} weth to bob from ${s.wethAddress}`)
        await stealMoney(bank, s.Bob.address, s.wethAddress, s.Bob_WETH)

        //showBody(`stealing`,s.Bob_USDC,`usdc to bob from ${s.usdcAddress}`)
        await stealMoney(bank, s.Bob.address, s.usdcAddress, s.Bob_USDC)

        await stealMoney(bank, s.Carol.address, s.opAddress, s.Carol_OP)

        //showBody(`stealing ${s.Gus_WBTC} to gus from ${s.wbtcAddress}`)
        await stealMoney(bank, s.Bob.address, s.wbtcAddress, s.Gus_WBTC)

        await mineBlock()
    })
})

