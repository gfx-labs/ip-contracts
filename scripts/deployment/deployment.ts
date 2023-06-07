import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  USDI,
  IERC20,
  IVOTE,
  VaultController,
  OracleMaster, IOracleRelay,
  CurveMaster,
  ThreeLines0_100, ProxyAdmin, ProxyAdmin__factory,
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
  ChainlinkOracleRelay__factory, TESTERC20__factory,
  InterestProtocolTokenDelegate__factory,
  InterestProtocolTokenDelegate,
  InterestProtocolToken__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory,
  GovernorCharlieDelegator,
  GovernorCharlieDelegate,
  InterestProtocolToken
} from "../../typechain-types";
import { BN } from "../../util/number";

export interface DeploymentInfo {
  USDC?: string;
  UNI?: string;
  WBTC?: string;
  WETH?: string;
  USDC_ETH_CL?: string;
  USDC_UNI_CL?: string;
  USDC_WBTC_CL?: string;
  USDC_ETH_POOL?: string;
  USDC_UNI_POOL?: string;
  USDC_WBTC_POOL?: string;
  USDI?: string;
  ProxyAdmin?: string;
  VaultController?: string;
  Oracle?: string;
  EthOracle?: string;
  UniOracle?: string;
  WBTCOracle?: string;
  Curve?: string;
  ThreeLines?: string;

  IPTDelegate?: string;
  IPTDelegator?: string;

  CharlieDelegate?: string;
  CharlieDelegator?: string;
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

  IPTDelegate!: InterestProtocolTokenDelegate;
  IPTDelegator!: InterestProtocolToken;

  CharlieDelegator!: GovernorCharlieDelegator;
  CharlieDelegate!: GovernorCharlieDelegate;

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
    console.log(this.Info);
    await this.ensureCharlie();
  }
  async ensureExternal() {
    if (this.Info.USDC) {
      this.USDC = IERC20__factory.connect(this.Info.USDC!, this.deployer);
    } else {
      console.log("deploying usdc");
      this.USDC = await new TESTERC20__factory(this.deployer).deploy(
        "USD Coin",
        "USDC",
        6,
        20000
      );
      await this.USDC.deployed();
      this.Info.USDC = this.USDC.address;
      console.log("USDC deployed at:", this.USDC.address);
    }
    if (this.Info.WETH) {
      this.WETH = IERC20__factory.connect(this.Info.WETH!, this.deployer);
    } else {
      console.log("deploying eth");
      this.WETH = await new TESTERC20__factory(this.deployer).deploy(
        "Wrapped Ether",
        "WETH",
        18,
        2
      );
      await this.WETH.deployed();
      this.Info.WETH = this.WETH.address;
      console.log("WETH deployed at:", this.WETH.address);
    }
    if (this.Info.WBTC) {
      this.WBTC = IERC20__factory.connect(this.Info.WBTC!, this.deployer);
    } else {
      console.log("deploying wbtc");
      this.WBTC = (await new TESTERC20__factory(this.deployer).deploy(
        "Wrapped Bitcoin",
        "WBTC",
        8,
        1
      )) as any;
      await this.WBTC.deployed();
      this.Info.WBTC = this.WBTC.address;
      console.log("WBTC deployed at:", this.WBTC.address);
    }
    if (this.Info.UNI) {
      this.UNI = IVOTE__factory.connect(this.Info.UNI!, this.deployer);
    } else {
      console.log("deploying uni");
      this.UNI = (await new TESTERC20__factory(this.deployer).deploy(
        "Uniswap Token",
        "UNI",
        18,
        500
      )) as any;
      console.log("UNI deployed at:", this.UNI.address);
      this.Info.UNI = this.UNI.address;
      await this.UNI.deployed();
    }
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

  async ensureEthOracle() {
    if (this.Info.EthOracle != undefined) {
      this.EthOracle = IOracleRelay__factory.connect(
        this.Info.EthOracle,
        this.deployer
      );
      console.log(`found EthOracle at ${this.Info.EthOracle}`);
    } else {
      console.log("deplying new eth oracle");
      let cl = undefined;
      let pool = undefined;
      if (this.Info.USDC_ETH_POOL) {
        pool = await new UniswapV3OracleRelay__factory(this.deployer).deploy(
          60 * 60 * 2, //lookback
          this.Info.USDC_ETH_POOL, //pool_address
          true, //quote_token_is_token0
          BN("1e12"), //mul
          BN("1") //div
        );
        await pool.deployed();
      }
      if (this.Info.USDC_ETH_CL) {
        cl = await new ChainlinkOracleRelay__factory(this.deployer).deploy(
          this.Info.USDC_ETH_CL, //pool_address
          BN("1e10"), //mul
          BN("1") //div
        );
        await cl.deployed();
      }
      if (cl && pool) {
        this.EthOracle = await new AnchoredViewRelay__factory(
          this.deployer
        ).deploy(pool.address, cl.address, 20, 100);
        await this.EthOracle.deployed();
      } else {
        this.EthOracle = cl ? cl : pool!;
      }
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
        BN("85e16"),
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
      console.log("deplying new wbtc oracle");
      let cl = undefined;
      let pool = undefined;
      if (this.Info.USDC_WBTC_CL) {
        cl = await new ChainlinkOracleRelay__factory(this.deployer).deploy(
          this.Info.USDC_WBTC_CL, //pool_address
          BN("1e20"), //mul
          BN("1") //div
        );
        await cl.deployed();
      }
      if (this.Info.USDC_WBTC_POOL) {
        pool = await new UniswapV3OracleRelay__factory(this.deployer).deploy(
          60 * 60 * 2, //lookback
          this.Info.USDC_WBTC_POOL, //pool_address
          false, //quote_token_is_token0
          BN("1e12"), //mul
          BN("1") //div
        );
        await pool.deployed();
      }
      if (cl && pool) {
        await cl.deployed();
        await pool.deployed();
        this.WBTCOracle = await new AnchoredViewRelay__factory(
          this.deployer
        ).deploy(pool.address, cl.address, 20, 100);
      } else {
        this.WBTCOracle = cl ? cl : pool!;
      }
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
      let t = await this.VaultController.registerErc20(
        this.WBTC.address,
        BN("8e17"),
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
      console.log("deploying new uni oracle");
      let cl = undefined;
      let pool = undefined;
      if (this.Info.USDC_UNI_CL) {
        cl = await new ChainlinkOracleRelay__factory(this.deployer).deploy(
          this.Info.USDC_UNI_CL, //pool_address
          BN("1e10"), //mul
          BN("1") //div
        );
        await cl.deployed();
      }
      if (this.Info.USDC_UNI_POOL) {
        pool = await new UniswapV3OracleRelay__factory(this.deployer).deploy(
          60 * 60 * 4,
          this.Info.USDC_UNI_POOL, //pool_address
          false, //quote_token_is_token0
          BN("1e12"), //mul
          BN("1") //div
        );
        await pool.deployed();
      }
      if (cl && pool) {
        await cl.deployed();
        await pool.deployed();
        this.UniOracle = await new AnchoredViewRelay__factory(
          this.deployer
        ).deploy(pool.address, cl.address, 40, 100);
      } else {
        this.UniOracle = cl ? cl : pool!;
      }
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
        BN("55e16"),
        this.UNI.address,
        BN("15e16")
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

  async ensureCharlie() {
    if (this.Info.CharlieDelegator) {
      console.log("found charlie at", this.Info.CharlieDelegator);
      this.IPTDelegator = new InterestProtocolToken__factory(
        this.deployer
      ).attach(this.Info.IPTDelegator!);
    } else {
      console.log("Deploying governance stack");
      this.IPTDelegate = await new InterestProtocolTokenDelegate__factory(
        this.deployer
      ).deploy();
      await this.IPTDelegate.deployed();
      console.log(
        "InterestProtocolTokenDelegate deployed: ",
        this.IPTDelegate.address
      );
      const totalSupply_ = BN("1e26");
      console.log("Deploying GovernorCharlieDelegate...");
      this.CharlieDelegate = await new GovernorCharlieDelegate__factory(
        this.deployer
      ).deploy();
      await this.CharlieDelegate.deployed();

      this.IPTDelegator = await new InterestProtocolToken__factory(
        this.deployer
      ).deploy(
        this.deployer.address,
        this.deployer.address,
        this.IPTDelegate.address,
        totalSupply_
      );
      await this.IPTDelegator.deployed();
      console.log("IPTDelegator deployed: ", this.IPTDelegator.address);
      console.log("Deploying GovernorCharlieDelegator...");
      const votingDelay_ = BN("13140");
      const votingPeriod_ = BN("40320");
      const proposalTimelockDelay_ = BN("172800");
      const proposalThreshold_ = BN("1000000e18");
      const quorumVotes_ = BN("10000000e18");
      const emergencyVotingPeriod_ = BN("6570");
      const emergencyTimelockDelay_ = BN("43200");
      const emergencyQuorumVotes_ = BN("40000000e18");
      this.CharlieDelegator = await new GovernorCharlieDelegator__factory(
        this.deployer
      ).deploy(
        this.IPTDelegator.address,
        this.CharlieDelegate.address
      );
      await this.CharlieDelegator.deployed();
      console.log(
        "Charlie Delegator Deployed: ",
        this.CharlieDelegator.address
      );

      this.Info.CharlieDelegator = this.CharlieDelegator.address;
      this.Info.CharlieDelegate = this.CharlieDelegate.address;
      this.Info.IPTDelegator = this.IPTDelegator.address;
      this.Info.IPTDelegate = this.IPTDelegate.address;
    }
  }
}
