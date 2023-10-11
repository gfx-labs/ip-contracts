import { expect } from "chai"
import { ethers, network } from "hardhat"
import { stealMoney } from "../../../../util/money"
import { s } from "../scope"
import { a, d } from "../../../../util/addresser"
import { reset, resetCurrent } from "../../../../util/block"
import {
    IERC20__factory, OracleMaster__factory, ProxyAdmin__factory, USDI__factory, VotingVaultController__factory,
    VaultController__factory,
    InterestProtocolTokenDelegate__factory, IVOTE__factory
} from "../../../../typechain-types"

require("chai").should()

// configurable variables
const weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
const bank = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
const YFI_WHALE = "0xF977814e90dA44bFA03b6295A0616a897441aceC"


describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await resetCurrent()).to.not.throw
    })
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw
    })
})

/**
 * We are listing wOETH
 * Deposits can be OETH or wOETH, but naked OETH must be wrapped on deposit
 * Withdrawals are currently processed in wOETH
 */
describe("Initial Setup - OETH", () => {
    it("connect to signers", async () => {
        s.accounts = await ethers.getSigners()
        s.Frank = s.accounts[0]
        s.Eric = s.accounts[5]
        s.Andy = s.accounts[6]
        s.Bob = s.accounts[7]
        s.Carol = s.accounts[8]
        s.Dave = s.accounts[9]
        s.Gus = s.accounts[10]
    })
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank)
        s.WETH = IERC20__factory.connect(s.wethAddress, s.Frank)

        s.OETH = IERC20__factory.connect(a.oethAddress, s.Frank)
        s.wOETH = IERC20__factory.connect(a.woethAddress, s.Frank)

    })

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        //s.Curve = CurveMaster__factory.connect(d.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)

        s.IPT = InterestProtocolTokenDelegate__factory.connect(d.IPTDelegator, s.Frank)

        s.VotingVaultController = VotingVaultController__factory.connect(d.VotingVaultController, s.Frank)

    })

    it("Should succesfully transfer money", async () => {

        //send GOV some eth to adjust caps
        let tx = {
            to: s.owner._address,
            value: ethers.utils.parseEther('1')
        }
        await s.Frank.sendTransaction(tx)

        //steal OETH for Bob and Carols
        const minter = "0xEADB3840596cabF312F2bC88A4Bb0b93A4E1FF5F"
        await stealMoney(minter, s.Bob.address, s.OETH.address, s.OETH_AMOUNT)
        await stealMoney(minter, s.Carol.address, s.OETH.address, s.OETH_AMOUNT)

    })
})

