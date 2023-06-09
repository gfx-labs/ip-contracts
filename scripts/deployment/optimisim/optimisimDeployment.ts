import { AnchoredViewRelay__factory, ChainlinkOracleRelay__factory, CurveMaster, CurveMaster__factory, IERC20, IERC20__factory, IOracleRelay, IOracleRelay__factory, IVOTE, IVOTE__factory, OracleMaster, OracleMaster__factory, REthOracleOP__factory, ThreeLines0_100, ThreeLines0_100__factory, TransparentUpgradeableProxy__factory, USDI, USDI__factory, UniswapV3OracleRelay__factory, VaultController, VaultController__factory, VotingVaultController, VotingVaultController__factory } from "../../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ProxyAdmin, ProxyAdmin__factory } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { BN } from "../../../util/number";
import { OptimisimAddresses } from "../../../util/addresser";
import { showBody, showBodyCyan } from "../../../util/format";
import { toNumber } from "../../../util/math";
import { UniswapV3OPTokenOracleRelay__factory } from "../../../typechain-types/factories/oracle/External/UniswapV3OPTokenOracleRelay__factory";
import { CappedGovToken } from "../../../typechain-types/lending/wrapper/CappedGovToken";
import { CappedGovToken__factory } from "../../../typechain-types/factories/lending/wrapper/CappedGovToken__factory";
import { BigNumber } from "ethers";
import { PromiseOrValue } from "../../../typechain-types/common";

const { ethers } = require("hardhat");
export interface DeploymentInfo extends OptimisimAddresses {

    WethLTV?: BigNumber;
    WethLiqInc?: BigNumber;
    WethCap?: BigNumber;

    wBtcLTV?: BigNumber;
    wBtcLiqInc?: BigNumber;
    wBtcCap?: BigNumber;

    OpLTV?: BigNumber;
    OpLiqInc?: BigNumber;
    OpCap?: BigNumber;

    wstEthLTV?: BigNumber;
    wstEthLiqInc?: BigNumber;
    wstEthCap?: BigNumber;

    rEthLTV?: BigNumber;
    rEthLiqInc?: BigNumber;
    rEthCap?: BigNumber;



    USDI?: string;
    ProxyAdmin?: string;
    VaultController?: string;
    VotingVaultController?: string;
    Oracle?: string;
    Curve?: string;
    ThreeLines?: string;

    EthOracle?: string;
    OpOracle?: string;
    wBtcOracle?: string;
    wstEthOracle?: string;
    rEthOracle?: string;
    AaveOracle?: string;
    UniOracle?: string;

    CappedImplementation?: string;

    CappedWeth?: string;
    CappedWbtc?: string;
    CappedOp?: string;
    CappedWstEth?: string;
    CappedRETH?: string;

    CappedUni?: string;
    CappedAave?: string;
}
export class Deployment {

    USDC!: IERC20;

    WETH!: IERC20;
    CappedWeth!: CappedGovToken;
    WSTETH!: IERC20;
    CappedWstEth!: CappedGovToken;
    WBTC!: IERC20;
    CappedWbtc!: CappedGovToken;
    OP!: IERC20;
    CappedOp!: CappedGovToken;
    AAVE!: IERC20;
    CappedAave!: CappedGovToken;
    UNI!: IVOTE;
    CappedUni!: CappedGovToken;
    RETH!: IERC20;
    CappedRETH!: CappedGovToken;

    CappedImplementation!: String

    USDI!: USDI;
    ProxyAdmin!: ProxyAdmin;
    VaultController!: VaultController;
    VotingVaultController!: VotingVaultController;
    Oracle!: OracleMaster;
    Curve!: CurveMaster;
    ThreeLines!: ThreeLines0_100;

    EthOracle!: IOracleRelay;
    OpOracle!: IOracleRelay;
    wBtcOracle!: IOracleRelay;
    wstEthOracle!: IOracleRelay;
    rEthOracle!: IOracleRelay;
    AaveOracle!: IOracleRelay;
    UniOracle!: IOracleRelay;

    Info!: DeploymentInfo
    deployer!: SignerWithAddress



    constructor(deployer: SignerWithAddress, i: DeploymentInfo) {
        this.deployer = deployer
        this.Info = i
    }

    async ensure() {
        console.log("Verifying Vanilla Protocol Deployment")
        
        //deploy base protocol
        await this.ensureExternal()
        await this.ensureProxyAdmin()
        await this.ensureVaultController()
        await this.ensureOracle()
        await this.ensureUSDI()
        await this.ensureVotingVaultController()

        console.log("Vanilla protocol ensured")

        //oracles for initiail capped assets
        await this.ensureEthOracle()
        await this.ensurewBtcOracle()
        await this.ensureOpOracle()
        await this.ensureWstEthOracle()
        await this.ensurerEthOracle()

    }
    async ensureExternal() {
        console.log("Ensure external")
        this.WETH = IERC20__factory.connect(this.Info.wethAddress, this.deployer)
        this.WSTETH = IERC20__factory.connect(this.Info.wstethAddress, this.deployer)
        this.OP = IERC20__factory.connect(this.Info.opAddress, this.deployer)
        this.USDC = IERC20__factory.connect(this.Info.usdcAddress, this.deployer)
        this.WBTC = IERC20__factory.connect(this.Info.wbtcAddress, this.deployer)
        this.AAVE = IERC20__factory.connect(this.Info.aaveAddress, this.deployer)
        this.UNI = IVOTE__factory.connect(this.Info.uniAddress, this.deployer)
        this.RETH = IERC20__factory.connect(this.Info.rethAddress, this.deployer)
    }

    //Base Protocol Deploys
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
            //https://etherscan.io/address/0x482855c43a0869D93C5cA6d9dc9EDdF3DAE031Ea#readContract
            console.log("deploying three lines");
            this.ThreeLines = await new ThreeLines0_100__factory(
                this.deployer
            ).deploy(
                BN("2000000000000000000"), //r0
                BN("100000000000000000"), //r1
                BN("5000000000000000"), //r2
                BN("250000000000000000"), //s1
                BN("500000000000000000") //s2
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
    async ensureVotingVaultController() {
        if (this.Info.VotingVaultController != undefined) {
            this.VotingVaultController = new VotingVaultController__factory(this.deployer).attach(
                this.Info.VotingVaultController
            );
            console.log(`found VotingVaultController at ${this.Info.VotingVaultController}`);
        } else {
            const VotingVaultControllerFactory = new VotingVaultController__factory(
                this.deployer
            );
            const uVC = await VotingVaultControllerFactory.deploy();
            await uVC.deployed();
            console.log("VotingVaultController implementation deployed: ", uVC.address);
            const VotingVaultController = await new TransparentUpgradeableProxy__factory(
                this.deployer
            ).deploy(uVC.address, this.ProxyAdmin.address, "0x");
            await VotingVaultController.deployed();
            console.log("VotingVaultController proxy deployed: ", VotingVaultController.address);
            this.VotingVaultController = VotingVaultControllerFactory.attach(
                VotingVaultController.address
            );
            const txn = await this.VotingVaultController.initialize(this.Info.VaultController!);
            await txn.wait();
            console.log(
                `VotingVaultController initialized with VC address: ${this.Info.VaultController}`
            );
            this.Info.VotingVaultController = this.VotingVaultController.address;
        }
    }

    //Initial Capped Asset Oracles and registrations
    async ensureEthOracle() {
        if (this.Info.EthOracle != undefined) {
            this.EthOracle = IOracleRelay__factory.connect(
                this.Info.EthOracle,
                this.deployer
            );
            console.log(`found wethOracle at ${this.Info.EthOracle}`);
        } else {
            console.log("Deploying new weth oracle")
            let clRelay = await new ChainlinkOracleRelay__factory(this.deployer).deploy(
                this.Info.wETH_CL_FEED,
                BN("1e10"),
                BN('1')
            )
            await clRelay.deployed()

            let uniRelay = await new UniswapV3OracleRelay__factory(this.deployer).deploy(
                14400,
                this.Info.wETH_UNI_POOL,
                false,
                BN("1e12"),
                BN("1")
            )
            await uniRelay.deployed()

            this.EthOracle = await new AnchoredViewRelay__factory(this.deployer).deploy(
                uniRelay.address,
                clRelay.address,
                BN("10"),
                BN("100")
            )
            await this.EthOracle.deployed()

            showBodyCyan("weth ORACLE PRICE: ", await toNumber(await this.EthOracle.currentValue()))
            if ((await this.Oracle._relays(this.WETH.address)) != this.EthOracle.address) {
                await this.deployAndRegisterCappedWeth()
            }
        }
    }
    async deployAndRegisterCappedWeth() {
        //deploy cap token
        if (this.Info.CappedWeth! != undefined) {
            this.CappedWeth = new CappedGovToken__factory(this.deployer).attach(
                this.Info.CappedWeth
            )
        } else {
            console.log("Deploying Capped weth")

            //deploy CappedGovToken implementation
            if (this.CappedImplementation == undefined) {
                const imp = await new CappedGovToken__factory(this.deployer).deploy()
                this.CappedImplementation = imp.address
                console.log("Deployed CappedGovToken Implementation: ", this.CappedImplementation)
            }

            const cTOKEN = await new TransparentUpgradeableProxy__factory(this.deployer).deploy(
                (this.CappedImplementation as PromiseOrValue<string>),
                this.ProxyAdmin.address,
                "0x"
            )

            this.CappedWeth = new CappedGovToken__factory(this.deployer).attach(cTOKEN.address)
            console.log("Capped wETH deployed: ", this.CappedWeth.address)

            const init = await this.CappedWeth.initialize(
                "Capped wETH",
                "cwETH",
                this.WETH.address,
                this.VaultController.address,
                this.VotingVaultController.address
            )
            await init.wait()
            console.log("Capped wETH initialized: ", this.CappedWeth.address)
        }

        //set oracle relay (already checked)
        console.log("setting weth oracle to be weth relay");
        let setRelay = await this.Oracle.setRelay(
            this.CappedWeth.address,
            this.EthOracle.address
        );
        await setRelay.wait();

        const tokenid = await this.VaultController._tokenAddress_tokenId(
            this.CappedWeth.address
        )
        if (tokenid.eq(0)) {
            console.log("Registering Capped weth on VaultController")
            let t = await this.VaultController.registerErc20(
                this.CappedWeth.address,
                this.Info.WethLTV!,
                this.CappedWeth.address,
                this.Info.WethLiqInc!
            );
            await t.wait();
        }

        //check and registerUnderlying on vvc
        const cTokenAddress = await this.VotingVaultController._underlying_CappedToken(this.WETH.address)
        if (cTokenAddress == "0x0000000000000000000000000000000000000000") {
            console.log("Registering Capped weth on VotingVaultController")
            const register = await this.VotingVaultController.registerUnderlying(
                this.WETH.address,
                this.CappedWeth.address
            )
            await register.wait()
        }

        //check if cap is set
        const cap = await this.CappedWeth._cap()
        if (cap._hex == BN("0")._hex && this.Info.WethCap != undefined) {
            console.log("Setting cap for weth")
            await this.CappedWeth.setCap(this.Info.WethCap)
        }
    }
    async ensurewBtcOracle() {
        if (this.Info.wBtcOracle != undefined) {
            this.wBtcOracle = IOracleRelay__factory.connect(
                this.Info.wBtcOracle,
                this.deployer
            );
            console.log(`found wBtcOracle at ${this.Info.wBtcOracle}`);
        } else {
            console.log("Deploying new wBTC oracle")
            let clRelay = await new ChainlinkOracleRelay__factory(this.deployer).deploy(
                this.Info.wBTC_CL_FEED,
                BN("1e10"),
                BN('1')
            )
            await clRelay.deployed()
            //showBodyCyan("wBTC CL PRICE: ", await toNumber(await clRelay.currentValue()))

            let uniRelay = await new UniswapV3OPTokenOracleRelay__factory(this.deployer).deploy(
                14400,
                this.EthOracle.address,
                this.Info.wBTC_UNI_POOL,
                true,
                BN("1"),
                BN("1e10")
            )
            await uniRelay.deployed()
            //showBodyCyan("wBTC UN PRICE: ", await toNumber(await uniRelay.currentValue()))

            this.wBtcOracle = await new AnchoredViewRelay__factory(this.deployer).deploy(
                uniRelay.address,
                clRelay.address,
                BN("10"),
                BN("100")
            )
            await this.wBtcOracle.deployed()
            showBodyCyan("wBtc ORACLE PRICE: ", await toNumber(await this.wBtcOracle.currentValue()))

            if ((await this.Oracle._relays(this.WBTC.address)) != this.wBtcOracle.address) {
                await this.deployAndRegisterCappedWbtc()
            }
        }
    }
    async deployAndRegisterCappedWbtc() {
        if (this.Info.CappedWbtc! != undefined) {
            this.CappedWbtc = new CappedGovToken__factory(this.deployer).attach(
                this.Info.CappedWbtc
            )
        } else {
            console.log("Deploying Capped wBtc")

            //deploy CappedGovToken implementation
            if (this.CappedImplementation == undefined) {
                const imp = await new CappedGovToken__factory(this.deployer).deploy()
                this.CappedImplementation = imp.address
                console.log("Deployed CappedGovToken Implementation: ", this.CappedImplementation)
            }

            const cTOKEN = await new TransparentUpgradeableProxy__factory(this.deployer).deploy(
                (this.CappedImplementation as PromiseOrValue<string>),
                this.ProxyAdmin.address,
                "0x"
            )

            this.CappedWbtc = new CappedGovToken__factory(this.deployer).attach(cTOKEN.address)
            console.log("Capped wBtctimisim deployed: ", this.CappedWbtc.address)

            const init = await this.CappedWbtc.initialize(
                "Capped wBTC",
                "cwBTC",
                this.WBTC.address,
                this.VaultController.address,
                this.VotingVaultController.address
            )
            await init.wait()
            console.log("Capped wBtc initialized: ", this.CappedWbtc.address)
        }

        //set oracle relay (already checked)
        console.log("setting wBtc oracle to be wBtc relay");
        let setRelay = await this.Oracle.setRelay(
            this.CappedWbtc.address,
            this.wBtcOracle.address
        );
        await setRelay.wait();

        const tokenid = await this.VaultController._tokenAddress_tokenId(
            this.CappedWbtc.address
        )
        if (tokenid.eq(0)) {
            console.log("Registering Capped wBtc on VaultController")
            let t = await this.VaultController.registerErc20(
                this.CappedWbtc.address,
                this.Info.wBtcLTV!,
                this.CappedWbtc.address,
                this.Info.wBtcLiqInc!
            );
            await t.wait();
        }

        //check and registerUnderlying on vvc
        const cTokenAddress = await this.VotingVaultController._underlying_CappedToken(this.WBTC.address)
        if (cTokenAddress == "0x0000000000000000000000000000000000000000") {
            console.log("Registering Capped wBtc on VotingVaultController")
            const register = await this.VotingVaultController.registerUnderlying(
                this.WBTC.address,
                this.CappedWbtc.address
            )
            await register.wait()
        }

        //check if cap is set
        const cap = await this.CappedWbtc._cap()
        if (cap._hex == BN("0")._hex && this.Info.wBtcCap != undefined) {
            console.log("Setting cap for wBtc")
            await this.CappedWbtc.setCap(this.Info.wBtcCap)
        }
    }
    async ensureOpOracle() {
        if (this.Info.OpOracle != undefined) {
            this.OpOracle = IOracleRelay__factory.connect(
                this.Info.OpOracle,
                this.deployer
            );
            console.log(`found OpOracle at ${this.Info.OpOracle}`);
        } else {
            console.log("Deploying new OP oracle")
            let clRelay = await new ChainlinkOracleRelay__factory(this.deployer).deploy(
                this.Info.OP_CL_FEED,
                BN("1e10"),
                BN('1')
            )
            await clRelay.deployed()

            let uniRelay = await new UniswapV3OPTokenOracleRelay__factory(this.deployer).deploy(
                14400,
                this.EthOracle.address,
                this.Info.OP_UNI_POOL,
                true,
                BN("1"),
                BN("1")
            )
            await uniRelay.deployed()

            this.OpOracle = await new AnchoredViewRelay__factory(this.deployer).deploy(
                uniRelay.address,
                clRelay.address,
                BN("10"),
                BN("100")
            )
            await this.OpOracle.deployed()

            showBodyCyan("OP ORACLE PRICE: ", await toNumber(await this.OpOracle.currentValue()))
            if ((await this.Oracle._relays(this.OP.address)) != this.OpOracle.address) {
                await this.deployAndRegisterCappedOP()
            }
        }
    }
    async deployAndRegisterCappedOP() {
        //deploy cap token
        if (this.Info.CappedOp != undefined) {
            this.CappedOp = new CappedGovToken__factory(this.deployer).attach(
                this.Info.CappedOp
            )
        } else {
            console.log("Deploying Capped OP")

            //deploy CappedGovToken implementation
            if (this.CappedImplementation == undefined) {
                const imp = await new CappedGovToken__factory(this.deployer).deploy()
                this.CappedImplementation = imp.address
                console.log("Deployed CappedGovToken Implementation: ", this.CappedImplementation)
            }

            const cTOKEN = await new TransparentUpgradeableProxy__factory(this.deployer).deploy(
                (this.CappedImplementation as PromiseOrValue<string>),
                this.ProxyAdmin.address,
                "0x"
            )

            this.CappedOp = new CappedGovToken__factory(this.deployer).attach(cTOKEN.address)
            console.log("Capped Optimisim deployed: ", this.CappedOp.address)

            const init = await this.CappedOp.initialize(
                "Capped OP",
                "cOP",
                this.OP.address,
                this.VaultController.address,
                this.VotingVaultController.address
            )
            await init.wait()
            console.log("Capped Optimism initialized: ", this.CappedOp.address)
        }

        //set oracle relay (already checked)
        console.log("setting OP oracle to be OP relay");
        let setRelay = await this.Oracle.setRelay(
            this.CappedOp.address,
            this.OpOracle.address
        );
        await setRelay.wait();

        const tokenid = await this.VaultController._tokenAddress_tokenId(
            this.CappedOp.address
        )
        if (tokenid.eq(0)) {
            console.log("Registering Capped OP on VaultController")
            let t = await this.VaultController.registerErc20(
                this.CappedOp.address,
                this.Info.OpLTV!,
                this.CappedOp.address,
                this.Info.OpLiqInc!
            );
            await t.wait();
        }

        //check and registerUnderlying on vvc
        const cTokenAddress = await this.VotingVaultController._underlying_CappedToken(this.OP.address)
        if (cTokenAddress == "0x0000000000000000000000000000000000000000") {
            console.log("Registering Capped OP on VotingVaultController")
            const register = await this.VotingVaultController.registerUnderlying(
                this.OP.address,
                this.CappedOp.address
            )
            await register.wait()
        }

        //check if cap is set
        const cap = await this.CappedOp._cap()
        if (cap._hex == BN("0")._hex && this.Info.OpCap != undefined) {
            console.log("Setting cap for OP")
            await this.CappedOp.setCap(this.Info.OpCap)
        }
    }
    async ensureWstEthOracle() {
        if (this.Info.wstEthOracle != undefined) {
            this.wstEthOracle = IOracleRelay__factory.connect(
                this.Info.wstEthOracle,
                this.deployer
            );
            console.log(`found wstEthOracle at ${this.Info.wstEthOracle}`);
        } else {
            console.log("Deploying new wstEth oracle")
            let clRelay = await new ChainlinkOracleRelay__factory(this.deployer).deploy(
                this.Info.wstETH_CL_FEED,
                BN("1e10"),
                BN('1')
            )
            await clRelay.deployed()

            let uniRelay = await new UniswapV3OPTokenOracleRelay__factory(this.deployer).deploy(
                14400,
                this.EthOracle.address,
                this.Info.wstETH_UNI_POOL,
                false,
                BN("1"),
                BN("1")
            )
            await uniRelay.deployed()

            this.wstEthOracle = await new AnchoredViewRelay__factory(this.deployer).deploy(
                uniRelay.address,
                clRelay.address,
                BN("10"),
                BN("100")
            )
            await this.wstEthOracle.deployed()

            showBodyCyan("wstEth ORACLE PRICE: ", await toNumber(await this.wstEthOracle.currentValue()))
            if ((await this.Oracle._relays(this.WSTETH.address)) != this.wstEthOracle.address) {
                await this.deployAndRegisterCappedWstEth()
            }
        }
    }
    async deployAndRegisterCappedWstEth() {
        //deploy cap token
        if (this.Info.CappedWstEth! != undefined) {
            this.CappedWstEth = new CappedGovToken__factory(this.deployer).attach(
                this.Info.CappedWstEth
            )
        } else {
            console.log("Deploying Capped wstEth")

            //deploy CappedGovToken implementation
            if (this.CappedImplementation == undefined) {
                const imp = await new CappedGovToken__factory(this.deployer).deploy()
                this.CappedImplementation = imp.address
                console.log("Deployed CappedGovToken Implementation: ", this.CappedImplementation)
            }

            const cTOKEN = await new TransparentUpgradeableProxy__factory(this.deployer).deploy(
                (this.CappedImplementation as PromiseOrValue<string>),
                this.ProxyAdmin.address,
                "0x"
            )

            this.CappedWstEth = new CappedGovToken__factory(this.deployer).attach(cTOKEN.address)
            console.log("Capped wstEthtimisim deployed: ", this.CappedWstEth.address)

            const init = await this.CappedWstEth.initialize(
                "Capped wstETH",
                "cwstEth",
                this.WSTETH.address,
                this.VaultController.address,
                this.VotingVaultController.address
            )
            await init.wait()
            console.log("Capped wstETH initialized: ", this.CappedWstEth.address)
        }

        //set oracle relay (already checked)
        console.log("setting wstEth oracle to be wstEth relay");
        let setRelay = await this.Oracle.setRelay(
            this.CappedWstEth.address,
            this.wstEthOracle.address
        );
        await setRelay.wait();

        const tokenid = await this.VaultController._tokenAddress_tokenId(
            this.CappedWstEth.address
        )
        if (tokenid.eq(0)) {
            console.log("Registering Capped wstEth on VaultController")
            let t = await this.VaultController.registerErc20(
                this.CappedWstEth.address,
                this.Info.wstEthLTV!,
                this.CappedWstEth.address,
                this.Info.wstEthLiqInc!
            );
            await t.wait();
        }

        //check and registerUnderlying on vvc
        const cTokenAddress = await this.VotingVaultController._underlying_CappedToken(this.WSTETH.address)
        if (cTokenAddress == "0x0000000000000000000000000000000000000000") {
            console.log("Registering Capped wstEth on VotingVaultController")
            const register = await this.VotingVaultController.registerUnderlying(
                this.WSTETH.address,
                this.CappedWstEth.address
            )
            await register.wait()
        }

        //check if cap is set
        const cap = await this.CappedWstEth._cap()
        if (cap._hex == BN("0")._hex && this.Info.wstEthCap != undefined) {
            console.log("Setting cap for wstEth")
            await this.CappedWstEth.setCap(this.Info.wstEthCap)
        }
    }
    async ensurerEthOracle() {
        if (this.Info.rEthOracle != undefined) {
            this.rEthOracle = IOracleRelay__factory.connect(
                this.Info.rEthOracle,
                this.deployer
            );
            console.log(`found rEthOracle at ${this.Info.rEthOracle}`);
        } else {
            console.log("Deploying new rEth oracle")
            let rEthExchangeRate = await new REthOracleOP__factory(this.deployer).deploy(
                this.Info.rETH_CL_FEED,
                this.EthOracle.address
            )
            await rEthExchangeRate.deployed()

            let uniRelay = await new UniswapV3OPTokenOracleRelay__factory(this.deployer).deploy(
                14400,
                this.EthOracle.address,
                this.Info.rETH_UNI_POOL,
                true,
                BN("1"),
                BN("1")
            )
            await uniRelay.deployed()

            this.rEthOracle = await new AnchoredViewRelay__factory(this.deployer).deploy(
                rEthExchangeRate.address,//anchor
                uniRelay.address,//main
                BN("10"),
                BN("100")
            )
            await this.rEthOracle.deployed()
            showBodyCyan("rEth ORACLE PRICE: ", await toNumber(await this.rEthOracle.currentValue()))

            if ((await this.Oracle._relays(this.RETH.address)) != this.rEthOracle.address) {
                await this.deployAndRegisterCappedRETH()
            }
        }
    }
    async deployAndRegisterCappedRETH() {
        if (this.Info.CappedRETH! != undefined) {
            this.CappedRETH = new CappedGovToken__factory(this.deployer).attach(
                this.Info.CappedRETH
            )
        } else {
            console.log("Deploying Capped rEth")

            //deploy CappedGovToken implementation
            if (this.CappedImplementation == undefined) {
                const imp = await new CappedGovToken__factory(this.deployer).deploy()
                this.CappedImplementation = imp.address
                console.log("Deployed CappedGovToken Implementation: ", this.CappedImplementation)
            }

            const cTOKEN = await new TransparentUpgradeableProxy__factory(this.deployer).deploy(
                (this.CappedImplementation as PromiseOrValue<string>),
                this.ProxyAdmin.address,
                "0x"
            )

            this.CappedRETH = new CappedGovToken__factory(this.deployer).attach(cTOKEN.address)
            console.log("Capped rETH deployed: ", this.CappedRETH.address)

            const init = await this.CappedRETH.initialize(
                "Capped rETH",
                "crETH",
                this.RETH.address,
                this.VaultController.address,
                this.VotingVaultController.address
            )
            await init.wait()
            console.log("Capped rETH initialized: ", this.CappedRETH.address)
        }

        //set oracle relay (already checked)
        console.log("setting rEth oracle to be rEth relay");
        let setRelay = await this.Oracle.setRelay(
            this.CappedRETH.address,
            this.rEthOracle.address
        );
        await setRelay.wait();

        const tokenid = await this.VaultController._tokenAddress_tokenId(
            this.CappedRETH.address
        )
        if (tokenid.eq(0)) {
            console.log("Registering Capped rEth on VaultController")
            let t = await this.VaultController.registerErc20(
                this.CappedRETH.address,
                this.Info.rEthLTV!,
                this.CappedRETH.address,
                this.Info.rEthLiqInc!
            );
            await t.wait();
        }

        //check and registerUnderlying on vvc
        const cTokenAddress = await this.VotingVaultController._underlying_CappedToken(this.RETH.address)
        if (cTokenAddress == "0x0000000000000000000000000000000000000000") {
            console.log("Registering Capped rEth on VotingVaultController")
            const register = await this.VotingVaultController.registerUnderlying(
                this.RETH.address,
                this.CappedRETH.address
            )
            await register.wait()
        }

        //check if cap is set
        const cap = await this.CappedRETH._cap()
        if (cap._hex == BN("0")._hex && this.Info.rEthCap != undefined) {
            console.log("Setting cap for rEth")
            await this.CappedRETH.setCap(this.Info.rEthCap)
        }
    }
}



/**
async ensureUniOracle() {
        if (this.Info.UniOracle != undefined) {
            this.UniOracle = IOracleRelay__factory.connect(
                this.Info.UniOracle,
                this.deployer
            );
            console.log(`found UniOracle at ${this.Info.UniOracle}`);
        } else {
            console.log("Deploying new Uni oracle")
            let clRelay = await new ChainlinkOracleRelay__factory(this.deployer).deploy(
                this.Info.UNI_CL_FEED,
                BN("1e10"),
                BN('1')
            )
            await clRelay.deployed()

            let uniRelay = await new UniswapV3OPTokenOracleRelay__factory(this.deployer).deploy(
                14400,
                this.EthOracle.address,
                this.Info.UNI_UNI_POOL,
                true,
                BN("1"),
                BN("1")
            )
            await uniRelay.deployed()

            this.UniOracle = await new AnchoredViewRelay__factory(this.deployer).deploy(
                uniRelay.address,
                clRelay.address,
                BN("10"),
                BN("100")
            )
            await this.UniOracle.deployed()

            showBodyCyan("Uni ORACLE PRICE: ", await toNumber(await this.UniOracle.currentValue()))
            if ((await this.Oracle._relays(this.UNI.address)) != this.UniOracle.address) {
                await this.deployAndRegisterCappedUni()
            }
        }
    }
    async deployAndRegisterCappedUni() {
        if (this.Info.CappedUni! != undefined) {
            this.CappedUni = new CappedGovToken__factory(this.deployer).attach(
                this.Info.CappedUni
            )
        } else {
            console.log("Deploying Capped Uni")

            //deploy CappedGovToken implementation
            if (this.CappedImplementation == undefined) {
                const imp = await new CappedGovToken__factory(this.deployer).deploy()
                this.CappedImplementation = imp.address
                console.log("Deployed CappedGovToken Implementation: ", this.CappedImplementation)
            }

            const cTOKEN = await new TransparentUpgradeableProxy__factory(this.deployer).deploy(
                (this.CappedImplementation as PromiseOrValue<string>),
                this.ProxyAdmin.address,
                "0x"
            )

            this.CappedUni = new CappedGovToken__factory(this.deployer).attach(cTOKEN.address)
            console.log("Capped Unitimisim deployed: ", this.CappedUni.address)

            const init = await this.CappedUni.initialize(
                "Capped Uniswap",
                "cUni",
                this.UNI.address,
                this.VaultController.address,
                this.VotingVaultController.address
            )
            await init.wait()
            console.log("Capped Uniswap initialized: ", this.CappedUni.address)
        }

        //set oracle relay (already checked)
        console.log("setting Uni oracle to be Uni relay");
        let setRelay = await this.Oracle.setRelay(
            this.CappedUni.address,
            this.UniOracle.address
        );
        await setRelay.wait();

        const tokenid = await this.VaultController._tokenAddress_tokenId(
            this.CappedUni.address
        )
        if (tokenid.eq(0)) {
            console.log("Registering Capped Uni on VaultController")
            let t = await this.VaultController.registerErc20(
                this.CappedUni.address,
                this.Info.UniLTV!,
                this.CappedUni.address,
                this.Info.UniLiqInc!
            );
            await t.wait();
        }

        //check and registerUnderlying on vvc
        const cTokenAddress = await this.VotingVaultController._underlying_CappedToken(this.UNI.address)
        if (cTokenAddress == "0x0000000000000000000000000000000000000000") {
            console.log("Registering Capped Uni on VotingVaultController")
            const register = await this.VotingVaultController.registerUnderlying(
                this.UNI.address,
                this.CappedUni.address
            )
            await register.wait()
        }

        //check if cap is set
        const cap = await this.CappedUni._cap()
        if (cap._hex == BN("0")._hex && this.Info.UniCap != undefined) {
            console.log("Setting cap for Uni")
            await this.CappedUni.setCap(this.Info.UniCap)
        }
    }

    async ensureAaveOracle() {
        if (this.Info.AaveOracle != undefined) {
            this.AaveOracle = IOracleRelay__factory.connect(
                this.Info.AaveOracle,
                this.deployer
            );
            console.log(`found AaveOracle at ${this.Info.AaveOracle}`);
        } else {
            console.log("Deploying new Aave oracle")
            let clRelay = await new ChainlinkOracleRelay__factory(this.deployer).deploy(
                this.Info.AAVE_CL_FEED,
                BN("1e10"),
                BN('1')
            )
            await clRelay.deployed()

            let AaveRelay = await new UniswapV3OPTokenOracleRelay__factory(this.deployer).deploy(
                7000,
                this.EthOracle.address,
                this.Info.AAVE_UNI_POOL,
                true,
                BN("1"),
                BN("1")
            )
            await AaveRelay.deployed()

            this.AaveOracle = await new AnchoredViewRelay__factory(this.deployer).deploy(
                AaveRelay.address,
                clRelay.address,
                BN("10"),
                BN("100")
            )
            await this.AaveOracle.deployed()

            showBodyCyan("Aave ORACLE PRICE: ", await toNumber(await this.AaveOracle.currentValue()))
            if ((await this.Oracle._relays(this.AAVE.address)) != this.AaveOracle.address) {
                await this.deployAndRegisterCappedAave()
            }
        }
    }
    async deployAndRegisterCappedAave() {
        if (this.Info.CappedAave! != undefined) {
            this.CappedAave = new CappedGovToken__factory(this.deployer).attach(
                this.Info.CappedAave
            )
        } else {
            console.log("Deploying Capped Aave")

            //deploy CappedGovToken implementation
            if (this.CappedImplementation == undefined) {
                const imp = await new CappedGovToken__factory(this.deployer).deploy()
                this.CappedImplementation = imp.address
                console.log("Deployed CappedGovToken Implementation: ", this.CappedImplementation)
            }

            const cTOKEN = await new TransparentUpgradeableProxy__factory(this.deployer).deploy(
                (this.CappedImplementation as PromiseOrValue<string>),
                this.ProxyAdmin.address,
                "0x"
            )

            this.CappedAave = new CappedGovToken__factory(this.deployer).attach(cTOKEN.address)
            console.log("Capped Aavetimisim deployed: ", this.CappedAave.address)

            const init = await this.CappedAave.initialize(
                "Capped Aave",
                "cAave",
                this.AAVE.address,
                this.VaultController.address,
                this.VotingVaultController.address
            )
            await init.wait()
            console.log("Capped Aaveswap initialized: ", this.CappedAave.address)
        }

        //set oracle relay (already checked)
        console.log("setting Aave oracle to be Aave relay");
        let setRelay = await this.Oracle.setRelay(
            this.CappedAave.address,
            this.AaveOracle.address
        );
        await setRelay.wait();

        const tokenid = await this.VaultController._tokenAddress_tokenId(
            this.CappedAave.address
        )
        if (tokenid.eq(0)) {
            console.log("Registering Capped Aave on VaultController")
            let t = await this.VaultController.registerErc20(
                this.CappedAave.address,
                this.Info.AaveLTV!,
                this.CappedAave.address,
                this.Info.AaveLiqInc!
            );
            await t.wait();
        }

        //check and registerUnderlying on vvc
        const cTokenAddress = await this.VotingVaultController._underlying_CappedToken(this.AAVE.address)
        if (cTokenAddress == "0x0000000000000000000000000000000000000000") {
            console.log("Registering Capped Aave on VotingVaultController")
            const register = await this.VotingVaultController.registerUnderlying(
                this.AAVE.address,
                this.CappedAave.address
            )
            await register.wait()
        }

        //check if cap is set
        const cap = await this.CappedAave._cap()
        if (cap._hex == BN("0")._hex && this.Info.AaveCap != undefined) {
            console.log("Setting cap for Aave")
            await this.CappedAave.setCap(this.Info.AaveCap)
        }
    }
 */