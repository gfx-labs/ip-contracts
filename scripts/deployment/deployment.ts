import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import fs from "fs";
import {
  USDI,
  IERC20,
  IVOTE,
  VaultController,
  OracleMaster,
  AnchoredViewRelay,
  ChainlinkOracleRelay,
  IOracleRelay,
  CurveMaster,
  ThreeLines0_100,
  IVault,
  IOracleMaster,
  IVaultController,
  ProxyAdmin,
  IUSDI,
  ICurveMaster,
  ProxyAdmin__factory,
  VaultController__factory,
  OracleMaster__factory,
  AnchoredViewRelay__factory,
  CurveMaster__factory,
  TransparentUpgradeableProxy__factory,
  USDI__factory,
  IERC20__factory,
  IVOTE__factory,
  ThreeLines0_100__factory,
  UniswapV3OracleRelay__factory,
  IOracleRelay__factory,
} from "../../typechain-types";
import { Addresser, MainnetAddresses } from "../../util/addresser";
import { BN } from "../../util/number";

export interface DeploymentInfo {
  USDC: string;
  UNI: string;
  WBTC: string;
  WETH: string;
  USDC_ETH_POOL: string;
  USDC_UNI_POOL: string;
  USDC_WBTC_POOL: string;
  USDI?: string;
  ProxyAdmin?: string;
  VaultController?: string;
  Oracle?: string;
  EthOracle?: string;
  UniOracle?: string;
  WBTCOracle?: string;
  Curve?: string;
  ThreeLines?: string;
}

export class Deployment {
  USDI!: USDI;
  USDC!: IERC20;
  UNI!: IVOTE;
  WETH!: IERC20;
  WBTC!: IERC20;

  ProxyAdmin!: ProxyAdmin;
  VaultController!: VaultController;

  Oracle!: OracleMaster;

  EthOracle!: IOracleRelay;
  UniOracle!: IOracleRelay;
  WBTCOracle!: IOracleRelay;

  Curve!: CurveMaster;
  ThreeLines!: ThreeLines0_100;

  Info: DeploymentInfo;

  deployer: SignerWithAddress;

  constructor(deployer: SignerWithAddress, i: DeploymentInfo) {
    this.Info = i;
    this.deployer = deployer;
  }

  async ensure() {
    await this.ensureExternal();
    await this.ensureProxyAdmin();
    await this.ensureVaultController();

    await this.ensureUSDI();

    await this.ensureCurve();

    await this.ensureOracle();
    await this.ensureEthOracle();
    await this.ensureUniOracle();
    await this.ensureWBTCOracle();
  }
  async ensureExternal() {
    this.USDC = IERC20__factory.connect(this.Info.USDC!, this.deployer);
    this.UNI = IVOTE__factory.connect(this.Info.UNI!, this.deployer);
    this.WETH = IERC20__factory.connect(this.Info.WETH!, this.deployer);
    this.WBTC = IERC20__factory.connect(this.Info.WBTC!, this.deployer);
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
      console.log("proxyAdmin address: ", this.ProxyAdmin.address);
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
      console.log("VaultController implementation address: ", uVC.address);
      const VaultController = await new TransparentUpgradeableProxy__factory(
        this.deployer
      ).deploy(uVC.address, this.ProxyAdmin.address, "0x");
      await VaultController.deployed();
      console.log("VaultController proxy address: ", VaultController.address);
      this.VaultController = VaultControllerFactory.attach(
        VaultController.address
      );
      await this.VaultController.initialize();
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
      const oracleMaster = await new OracleMaster__factory(
        this.deployer
      ).deploy();
      await oracleMaster.deployed();
      this.Info.Oracle = this.Oracle.address;
      console.log("oracleMaster deployed: ", oracleMaster.address);
    }
    if ((await this.VaultController.getOracleMaster()) != this.Oracle.address) {
      console.log("Registering oracle master");
      await this.VaultController.registerOracleMaster(this.Oracle.address);
      console.log("Registered oracle master");
    }
  }

  async ensureEthOracle() {
    if (this.Info.EthOracle != undefined) {
      this.EthOracle = IOracleRelay__factory.connect(
        this.Info.EthOracle,
        this.deployer
      );
      console.log(`found EthOracle at ${this.Info.EthOracle}`);
    } else {
      const UniswapRelayFactory = new UniswapV3OracleRelay__factory(
        this.deployer
      );
      this.EthOracle = await UniswapRelayFactory.deploy(
        60, //lookback
        this.Info.USDC_ETH_POOL, //pool_address
        true, //quote_token_is_token0
        BN("1e12"), //mul
        BN("1") //div
      );
      await this.EthOracle.deployed();
      this.Info.EthOracle = this.EthOracle.address;
    }
    if (
      (await this.Oracle._relays(this.WETH.address)) != this.EthOracle.address
    ) {
      console.log("setting eth oracle to be eth relay");
      let r2 = await this.Oracle.setRelay(
        this.WETH.address,
        this.EthOracle.address
      );
      await r2.wait();
    }
    if (
      (await this.VaultController._tokenAddress_tokenId(this.WETH.address)).eq(
        0
      )
    ) {
      console.log("registering eth into vault controller");
      let t = await this.VaultController.registerErc20(
        this.WETH.address,
        BN("5e17"),
        this.WETH.address,
        BN("5e16")
      );
      await t.wait();
    }
  }

  async ensureWBTCOracle() {
    if (this.Info.WBTCOracle != undefined) {
      this.WBTCOracle = IOracleRelay__factory.connect(
        this.Info.WBTCOracle,
        this.deployer
      );
      console.log(`found WBTCOracle at ${this.Info.WBTCOracle}`);
    } else {
      const UniswapRelayFactory = new UniswapV3OracleRelay__factory(
        this.deployer
      );
      console.log("setting wbtc oracle to be an adjsted eth-wbtc pool (lol)");
      this.WBTCOracle = await UniswapRelayFactory.deploy(
        60, //lookback
        this.Info.USDC_WBTC_POOL, //pool_address
        true, //quote_token_is_token0
        BN("1e12"), //mul
        BN("1") //div
      );
      await this.WBTCOracle.deployed();
      this.Info.WBTCOracle = this.WBTCOracle.address;
    }
    if (
      (await this.Oracle._relays(this.WBTC.address)) != this.WBTCOracle.address
    ) {
      let r2 = await this.Oracle.setRelay(
        this.WBTC.address,
        this.WBTCOracle.address
      );
      await r2.wait();
    }
    const tokenid = await this.VaultController._tokenAddress_tokenId(
      this.WBTC.address
    );
    if (tokenid.eq(0)) {
      console.log("registering wbtc into vault controller");
      let t = await this.VaultController.registerErc20(
        this.WBTC.address,
        BN("5e17"),
        this.WBTC.address,
        BN("5e16")
      );
      await t.wait();
    }
  }

  async ensureUniOracle() {
    if (this.Info.UniOracle != undefined) {
      this.UniOracle = IOracleRelay__factory.connect(
        this.Info.UniOracle,
        this.deployer
      );
      console.log(`found UniOracle at ${this.Info.UniOracle}`);
    } else {
      const UniswapRelayFactory = new UniswapV3OracleRelay__factory(
        this.deployer
      );
      console.log("setting uni oracle to be an adjusted eth relay (lol)");
      this.UniOracle = await UniswapRelayFactory.deploy(
        60, //lookback
        this.Info.USDC_UNI_POOL, //pool_address
        true, //quote_token_is_token0
        BN("5e10"), //mul
        BN("1") //div
      );
      await this.UniOracle.deployed();
      this.Info.UniOracle = this.UniOracle.address;
    }
    if (
      (await this.Oracle._relays(this.UNI.address)) != this.UniOracle.address
    ) {
      let r2 = await this.Oracle.setRelay(
        this.UNI.address,
        this.UniOracle.address
      );
      await r2.wait();
    }
    if (
      (await this.VaultController._tokenAddress_tokenId(this.UNI.address)).eq(0)
    ) {
      console.log("registering uni into vault controller");
      let t = await this.VaultController.registerErc20(
        this.UNI.address,
        BN("5e17"),
        this.UNI.address,
        BN("5e16")
      );
      await t.wait();
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
      const USDIcontract = new USDI__factory(this.deployer).attach(
        USDI.address
      );

      await USDIcontract.initialize(this.USDC.address);
      console.log("USDI initialized: ", USDIcontract.address);
      this.Info.USDI = this.USDI.address;
    }
    if (
      (await this.USDI.connect(this.deployer).getVaultController()) !=
      this.VaultController.address
    ) {
      {
        let t = await this.USDI.connect(this.deployer).setVaultController(
          this.VaultController.address
        );
        await t.wait();
      }
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
    }
    if (
      (await this.Curve._vaultControllerAddress()) !=
      this.VaultController.address
    ) {
      console.log("setting Curve vault controller");
      this.Curve.setVaultController(this.VaultController.address);
    }
    if (this.Info.ThreeLines != undefined) {
      this.ThreeLines = new ThreeLines0_100__factory(this.deployer).attach(
        this.Info.ThreeLines
      );
      console.log(`found ThreeLines at ${this.Info.ThreeLines}`);
    } else {
      this.ThreeLines = await new ThreeLines0_100__factory(
        this.deployer
      ).deploy(
        BN("200e16"), //r0
        BN("5e16"), //r1
        BN("45e15"), //r2
        BN("50e16"), //s1
        BN("55e16") //s2
      );
      await this.ThreeLines.deployed();
      this.Info.ThreeLines = this.ThreeLines.address;
    }
    if (
      (await this.Curve._curves(
        "0x0000000000000000000000000000000000000000"
      )) != this.ThreeLines.address
    ) {
      let t = await this.Curve.setCurve(
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
