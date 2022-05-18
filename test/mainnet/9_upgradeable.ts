import { s } from "./scope";
import { ethers, upgrades } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../util/format";
import { BN } from "../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "../../util/block";

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
} from "../../typechain-types";


let VaultController: VaultController
let USDi: USDI
let ProxyController: ProxyAdmin

let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    ethan: SignerWithAddress;
let ganga: Array<SignerWithAddress>;

const deployProxy = async () => {

    [deployer, alice, bob, carol, dave, ethan] = await ethers.getSigners();
    ganga = [deployer, alice, bob, carol, dave, ethan];
    await mineBlock()


    const uVC = await new VaultController__factory(deployer).connect(deployer).deploy()
    await mineBlock()

    ProxyController = await new ProxyAdmin__factory(deployer).connect(deployer).deploy()
    await mineBlock()

    let vc = await new TransparentUpgradeableProxy__factory(
        deployer
    ).connect(deployer).deploy(uVC.address, ProxyController!.address, "0x");
    await mineBlock()

    VaultController = await new VaultController__factory(deployer).attach(vc.address)
    await mineBlock()
    await VaultController.deployed()
    await mineBlock()

    await VaultController.initialize()
    await mineBlock()


    const uUSDi = await new USDI__factory(deployer).connect(deployer).deploy()
    await mineBlock()

    let usd = await new TransparentUpgradeableProxy__factory(
        deployer
    ).connect(deployer).deploy(uUSDi.address, ProxyController!.address, "0x")
    await mineBlock()

    USDi = await new USDI__factory(deployer).attach(usd.address)
    await mineBlock()
    await USDi.deployed()
    await mineBlock()
    await USDi.initialize(s.usdcAddress)


}

describe("Test upgradeable", () => {

    before(async () => {
        await deployProxy()
    })
    it("Verify deployment of VaultController proxy", async () => {

        const protocolFee = await VaultController.connect(alice).protocolFee()
        await mineBlock()
        const expectedProtocolFee = BN("1e14")
        assert.equal(protocolFee.toString(), expectedProtocolFee.toString(), "VaultController Initialized")

    })
    it("Verify deployment of USDi proxy", async () => {
        const reserveAddress = await USDi.reserveAddress()
        await mineBlock()
        const expectedReserveAddress = s.usdcAddress
        assert.equal(reserveAddress, expectedReserveAddress, "USDi Initialized")
    })

})