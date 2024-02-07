import { expect } from "chai"
import { ethers, network } from "hardhat"
import { s } from "../scope"
import { resetCurrent, resetCurrentOP } from "../../../util/block"
import { IERC20__factory, VaultController__factory, USDI__factory, OracleMaster__factory, CurveMaster__factory, ProxyAdmin__factory, VotingVaultController__factory } from "../../../typechain-types"
import { oa, od } from "../../../util/addresser"
import { stealMoney } from "../../../util/money"

require("chai").should()
describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await resetCurrentOP()).to.not.throw//14940917
    })
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw
    })
})

describe("Rebase Token Setup", () => {
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

        s.aUSDC = IERC20__factory.connect(oa.aOptUsdcAddress, s.Frank)
      
    })

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(od.VaultController, s.Frank)
        s.VotingVaultController = VotingVaultController__factory.connect(od.VotingVaultController, s.Frank)
        s.USDI = USDI__factory.connect(od.USDI, s.Frank)
        s.Curve = CurveMaster__factory.connect(od.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(od.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(od.ProxyAdmin, s.Frank)

    })
})