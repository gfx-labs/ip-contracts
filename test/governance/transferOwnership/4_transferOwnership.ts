import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from ".././scope";
import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import {
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    CurveMaster,
    CurveMaster__factory,
    IERC20,
    IERC20__factory,
    IOracleRelay,
    OracleMaster,
    OracleMaster__factory,
    ProxyAdmin,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    ThreeLines0_100,
    ThreeLines0_100__factory,
    UniswapV3OracleRelay__factory,
    USDI,
    USDI__factory,
    Vault,
    VaultController,
    VaultController__factory,
    IVOTE,
    IVOTE__factory,
} from "../../../typechain-types";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";

describe("Sanity check", () => {



    it("Check state of IP", async () => {
        const totalLiability = await s.VaultController.totalBaseLiability()
        expect(totalLiability).to.eq(BN("0"))

        const vaultsMinted = await s.VaultController.vaultsMinted()
        expect(vaultsMinted).to.eq(BN("0"))

        const interestFactor = await s.VaultController.interestFactor()
        expect(interestFactor).to.eq(BN("1e18"))

        const tokensRegistered = await s.VaultController.tokensRegistered()
        expect(tokensRegistered).to.eq(BN("3"))//weth, UNI, wBTC

        //no new USDi has been minted
        const totalSupply = await s.USDI.totalSupply()
        expect(totalSupply).to.eq(BN("1e18"))

        const scaledTotalSupply = await s.USDI.scaledTotalSupply()
        expect(scaledTotalSupply).to.eq(totalSupply.mul(BN("1e48")))

        const reserveRatio = await s.USDI.reserveRatio()
        expect(reserveRatio).to.eq(0)
    })

    it("Confirm deployer owns all ownable IP contracts", async () => {
        let owner = await s.USDI.owner()
        expect(owner).to.eq(s.Frank.address)

        //ownership not on the interface or typechain type, need to get the raw contract
        let vcABI = require("../../../abis/contracts/lending/VaultController.sol/VaultController.json")
        const vcContract = await new ethers.Contract(s.VaultController.address, vcABI.abi, ethers.provider)

        owner = await vcContract.owner()
        expect(owner).to.eq(s.Frank.address)

        let curveABI = require("../../../abis/contracts/curve/CurveMaster.sol/CurveMaster.json")
        const curveContract = await new ethers.Contract(s.Curve.address, curveABI.abi, ethers.provider)

        owner = await curveContract.owner()
        expect(owner).to.eq(s.Frank.address)

        let oracleABI = require("../../../abis/contracts/oracle/OracleMaster.sol/OracleMaster.json")
        const oracleContract = await new ethers.Contract(s.Oracle.address, oracleABI.abi, ethers.provider)

        owner = await oracleContract.owner()
        expect(owner).to.eq(s.Frank.address)


    })
    it("Confirm pauser is the deployer", async () => {

        const pauser = await s.USDI.pauser()
        expect(pauser).to.eq(s.Frank.address)

    })
    it("Check owner of Governance and IPT", async () => {

    })

})
