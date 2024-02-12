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
        s.Frank = accounts[14]
        s.Eric = accounts[15]
        s.Andy = accounts[16]
        s.Bob = accounts[17]
        s.Carol = accounts[18]
        s.Dave = accounts[19]
        s.Gus = accounts[13]
    })
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(oa.usdcAddress, s.Frank)
        s.WETH = IERC20__factory.connect(oa.wethAddress, s.Frank)

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

    it("Fund", async () => {
        const usdcMinter = "0xacD03D601e5bB1B275Bb94076fF46ED9D753435A"
        await stealMoney(usdcMinter, s.Bob.address, s.USDC.address, s.USDC_AMOUNT)
        await stealMoney(usdcMinter, s.Dave.address, s.USDC.address, s.Dave_USDC)

    })
})