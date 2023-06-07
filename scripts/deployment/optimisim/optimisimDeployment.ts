import { network } from "hardhat";
import hre from 'hardhat';
import { resetCurrent } from "../../../util/block";
import { CurveMaster, CurveMaster__factory, IERC20, IERC20__factory, IOracleRelay, IVOTE, IVOTE__factory, OracleMaster, OracleMaster__factory, ThreeLines0_100, ThreeLines0_100__factory, TransparentUpgradeableProxy__factory, USDI, USDI__factory, VaultController, VaultController__factory } from "../../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Signer } from "ethers";
import { ProxyAdmin, ProxyAdmin__factory, TransparentUpgradeableProxy } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { BN } from "../../../util/number";

const { ethers } = require("hardhat");
export interface DeploymentInfo {
    //external contracts
    WETH: string;
    OP: string;
    USDC: string;
    WBTC: string;
    AAVE: string;
    UNI: string;

    USDI?: string;
    ProxyAdmin?: string;
    VaultController?: string;
    Oracle?: string;
    Curve?: string;
    ThreeLines?: string;

}
export class Deployment {

    WETH!: IERC20;
    OP!: IERC20;
    USDC!: IERC20;
    WBTC!: IERC20;
    AAVE!: IERC20;
    UNI!: IVOTE;

    USDI!: USDI;
    ProxyAdmin!: ProxyAdmin;
    VaultController!: VaultController;
    Oracle!: OracleMaster;
    Curve!: CurveMaster;
    ThreeLines!: ThreeLines0_100;

    EthOracle!: IOracleRelay;
    UniOracle!: IOracleRelay;
    WBTCOracle!: IOracleRelay;

    Info!: DeploymentInfo
    deployer!: SignerWithAddress



    constructor(deployer: SignerWithAddress, i: DeploymentInfo) {
        this.deployer = deployer
        this.Info = i
    }

    async ensure() {
        console.log("ENSURE")
        await this.ensureExternal()
        await this.ensureProxyAdmin()
        await this.ensureVaultController()
        await this.ensureOracle()
        await this.ensureUSDI()

    }
    async ensureExternal() {
        console.log("Ensure external")
        this.WETH = IERC20__factory.connect(this.Info.WETH, this.deployer);
        this.OP = IERC20__factory.connect(this.Info.OP, this.deployer)
        this.USDC = IERC20__factory.connect(this.Info.USDC, this.deployer)
        this.WBTC = IERC20__factory.connect(this.Info.WBTC, this.deployer)
        this.AAVE = IERC20__factory.connect(this.Info.AAVE, this.deployer)
        this.UNI = IVOTE__factory.connect(this.Info.UNI, this.deployer)
    }


    async ensureProxyAdmin() {
        if (this.Info.ProxyAdmin != undefined) {
            this.ProxyAdmin = new ProxyAdmin__factory(this.deployer).attach(
                this.Info.ProxyAdmin
            );
            console.log(`found ProxyAdmin at ${this.Info.ProxyAdmin}`);
        } else {
            this.ProxyAdmin = await new ProxyAdmin__factory(this.deployer).deploy();
            await this.ProxyAdmin.deployed();
            this.Info.ProxyAdmin = this.ProxyAdmin.address;
            console.log("proxyAdmin deployed to: ", this.ProxyAdmin.address);
        }
    }
    async ensureVaultController() {
        if (this.Info.VaultController != undefined) {
            this.VaultController = new VaultController__factory(this.deployer).attach(
                this.Info.VaultController
            );
            console.log(`found VaultController at ${this.Info.VaultController}`);
        } else {
            const VaultControllerFactory = new VaultController__factory(
                this.deployer
            );
            const uVC = await VaultControllerFactory.deploy();
            await uVC.deployed();
            console.log("VaultController implementation deployed: ", uVC.address);
            const VaultController = await new TransparentUpgradeableProxy__factory(
                this.deployer
            ).deploy(uVC.address, this.ProxyAdmin.address, "0x");
            await VaultController.deployed();
            console.log("VaultController proxy deployed: ", VaultController.address);
            this.VaultController = VaultControllerFactory.attach(
                VaultController.address
            );
            const txn = await this.VaultController.initialize();
            await txn.wait();
            console.log(
                "VaultController initialized: ",
                this.VaultController.address
            );
            this.Info.VaultController = this.VaultController.address;
        }
    }
    async ensureOracle() {
        if (this.Info.Oracle != undefined) {
            this.Oracle = new OracleMaster__factory(this.deployer).attach(
                this.Info.Oracle
            );
            console.log(`found OracleMaster at ${this.Info.Oracle}`);
        } else {
            this.Oracle = await new OracleMaster__factory(this.deployer).deploy();
            await this.Oracle.deployed();
            this.Info.Oracle = this.Oracle.address;
            console.log("oracleMaster deployed: ", this.Oracle.address);
        }
        if ((await this.VaultController.getOracleMaster()) != this.Oracle.address) {
            console.log("Registering oracle master");
            await (
                await this.VaultController.registerOracleMaster(this.Oracle.address)
            ).wait();
            console.log("Registered oracle master");
        }
    }
    async ensureUSDI() {
        if (this.Info.USDI != undefined) {
            this.USDI = new USDI__factory(this.deployer).attach(this.Info.USDI);
            console.log(`found USDI at ${this.Info.USDI}`);
        } else {
            const uUSDI = await new USDI__factory(this.deployer).deploy();
            await uUSDI.deployed();
            console.log("USDI implementation address: ", uUSDI.address);
            //USDI proxy
            const USDI = await new TransparentUpgradeableProxy__factory(
                this.deployer
            ).deploy(uUSDI.address, this.ProxyAdmin.address, "0x");
            await USDI.deployed();
            console.log("USDI proxy address: ", USDI.address);
            //attach
            this.USDI = new USDI__factory(this.deployer).attach(USDI.address);
            let t = await this.USDI.initialize(this.USDC.address);
            await t.wait();
            console.log("USDI initialized: ", this.USDI.address);
            this.Info.USDI = this.USDI.address;
        }
        if (
            (await this.USDI.connect(this.deployer).getVaultController()) !=
            this.VaultController.address
        ) {
            let t = await this.USDI.connect(this.deployer).setVaultController(
                this.VaultController.address
            );
            await t.wait();
            console.log(
                "Set VaultController on USDI to: ",
                this.VaultController.address
            );
        }
        if (
            (await this.VaultController.connect(this.deployer)._usdi()) !=
            this.USDI.address
        ) {
            {
                let t = await this.VaultController.connect(this.deployer).registerUSDi(
                    this.USDI.address
                );
                await t.wait();
            }
            console.log("Set USDI on VaultController to: ", this.USDI.address);
        }
    }
    async ensureCurve() {
        if (this.Info.Curve != undefined) {
            this.Curve = new CurveMaster__factory(this.deployer).attach(
                this.Info.Curve
            );
            console.log(`found CurveMaster at ${this.Info.Curve}`);
        } else {
            const curveFactory = new CurveMaster__factory().connect(this.deployer);
            this.Curve = await curveFactory.deploy();
            await this.Curve.deployed();
            this.Info.Curve = this.Curve.address;
            console.log("deployed curve master at", this.Info.Curve);
        }
        if (
            (await this.Curve._vaultControllerAddress()) !=
            this.VaultController.address
        ) {
            console.log("setting Curve vault controller");
            await (
                await this.Curve.setVaultController(this.VaultController.address)
            ).wait();
        }
        if (this.Info.ThreeLines != undefined) {
            this.ThreeLines = new ThreeLines0_100__factory(this.deployer).attach(
                this.Info.ThreeLines
            );
            console.log(`found ThreeLines at ${this.Info.ThreeLines}`);
        } else {
            console.log("deploying three lines");
            this.ThreeLines = await new ThreeLines0_100__factory(
                this.deployer
            ).deploy(
                BN("600e16"), //r1
                BN("10e16"), //r2
                BN("5e15"), //r3
                BN("40e16"), //s1
                BN("60e16") //s2
            );
            await this.ThreeLines.deployed();
            this.Info.ThreeLines = this.ThreeLines.address;
            console.log("deployed three lines at", this.Info.ThreeLines);
        }
        if (
            (await this.Curve._curves(
                "0x0000000000000000000000000000000000000000"
            )) != this.ThreeLines.address
        ) {
            console.log("setting 0 curve to threelines");
            let t = await this.Curve.forceSetCurve(
                "0x0000000000000000000000000000000000000000",
                this.ThreeLines.address
            );
            await t.wait();
        }
        if ((await this.VaultController.getCurveMaster()) != this.Curve.address) {
            console.log("setting curve master of vault controller");
            let t = await this.VaultController.registerCurveMaster(
                this.Curve.address
            );
            await t.wait();
        }
    }
}