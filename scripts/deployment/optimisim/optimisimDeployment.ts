import { AnchoredViewRelay__factory, ChainlinkOracleRelay__factory, CurveMaster, CurveMaster__factory, IERC20, IERC20__factory, IOracleRelay, IOracleRelay__factory, IVOTE, IVOTE__factory, OracleMaster, OracleMaster__factory, ThreeLines0_100, ThreeLines0_100__factory, TransparentUpgradeableProxy__factory, USDI, USDI__factory, UniswapV3OracleRelay__factory, VaultController, VaultController__factory, VotingVaultController, VotingVaultController__factory } from "../../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ProxyAdmin, ProxyAdmin__factory } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { BN } from "../../../util/number";
import { OptimisimAddresses } from "../../../util/addresser";
import { showBodyCyan } from "../../../util/format";
import { toNumber } from "../../../util/math";
import { UniswapV3OPTokenOracleRelay__factory } from "../../../typechain-types/factories/oracle/External/UniswapV3OPTokenOracleRelay__factory";
import { CappedGovToken } from "../../../typechain-types/lending/wrapper/CappedGovToken";
import { CappedGovToken__factory } from "../../../typechain-types/factories/lending/wrapper/CappedGovToken__factory";
import { BigNumber } from "ethers";

const { ethers } = require("hardhat");
export interface DeploymentInfo extends OptimisimAddresses {

    WethLTV?: BigNumber;
    WethLiqInc?: BigNumber;

    wBtcLTV?: BigNumber;
    wBtcLiqInc?: BigNumber;

    OpLTV?: BigNumber;
    OpLiqInc?: BigNumber;
    OpCap?: BigNumber;

    wstEthLTV?: BigNumber;
    wstEthLiqInc?: BigNumber;
    wstEthCap?: BigNumber;


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
    AaveOracle?: string;
    UniOracle?: string;

    CappedImplementation?: string;

    CappedOp?: string;
    CappedWstEth?: string;
}
export class Deployment {

    WETH!: IERC20;
    WSTETH!: IERC20;
    CappedWstEth!: CappedGovToken
    USDC!: IERC20;
    WBTC!: IERC20;
    OP!: IERC20;
    CappedOp!: CappedGovToken
    AAVE!: IERC20;
    UNI!: IVOTE;

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
        console.log("ENSURE")


        //deploy base protocol
        await this.ensureExternal()
        await this.ensureProxyAdmin()
        await this.ensureVaultController()
        await this.ensureOracle()
        await this.ensureUSDI()
        await this.ensureVotingVaultController()

        console.log("Vanilla protocol ensured")

        //deploy oracles for initial assets
        await this.ensureEthOracle()
        await this.ensurewBtcOracle()

        //oracles for initiail capped assets
        await this.ensureOpOracle()
        await this.ensureWstEthOracle()

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

    //Initial Asset Oracles and registrations
    async ensureEthOracle() {
        if (this.Info.EthOracle != undefined) {
            this.EthOracle = IOracleRelay__factory.connect(
                this.Info.EthOracle,
                this.deployer
            );
            console.log(`found EthOracle at ${this.Info.EthOracle}`);
        } else {
            console.log("Deploying new eth oracle")
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
            showBodyCyan("ETH ORACLE PRICE: ", await toNumber(await this.EthOracle.currentValue()))
            if (
                (await this.Oracle._relays(this.WETH.address)) != this.EthOracle.address
            ) {
                console.log("setting eth oracle to be eth relay: ", this.EthOracle.address);
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
                //console.log("registering eth into vault controller: ", this.Info.WethLTV!);
                //console.log("registering eth into vault controller: ", BN("85e16"));

                //console.log("registering eth into vault controller: ", this.Info.WethLiqInc!);
                //console.log("registering eth into vault controller: ", BN("5e18"));
                let t = await this.VaultController.registerErc20(
                    this.WETH.address,
                    BN("85e16"),
                    this.WETH.address,
                    BN("5e16")
                );
                await t.wait();
            }

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
            showBodyCyan("wBTC ORACLE PRICE: ", await toNumber(await this.wBtcOracle.currentValue()))
            if (
                (await this.Oracle._relays(this.WBTC.address)) != this.wBtcOracle.address
            ) {
                console.log("setting wBTC oracle to be wBTC relay: ", this.wBtcOracle.address);
                let r2 = await this.Oracle.setRelay(
                    this.WBTC.address,
                    this.wBtcOracle.address
                );
                await r2.wait();
            }
            if (
                (await this.VaultController._tokenAddress_tokenId(this.WBTC.address)).eq(
                    0
                )
            ) {
                console.log("registering wBTC into vault controller");
                let t = await this.VaultController.registerErc20(
                    this.WBTC.address,
                    BN("85e16"),
                    this.WBTC.address,
                    BN("5e16")
                );
                await t.wait();
            }
        }
    }

    //Initial Capped Asset Oracles 
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
                this.CappedImplementation,
                this.ProxyAdmin.address,
                "0x"
            )

            this.CappedOp = new CappedGovToken__factory(this.deployer).attach(cTOKEN.address)
            console.log("Capped Optimisim deployed: ", this.CappedOp.address)

            const init = await this.CappedOp.initialize(
                "Capped Optimism",
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

        //check and registerErc20
        const tokenid = await this.VaultController._tokenAddress_tokenId(
            this.CappedOp.address
        )
        if (tokenid.eq(0)) {
            console.log("Registering Capped OP on VaultController")
            let t = await this.VaultController.registerErc20(
                this.CappedOp.address,
                BN("8e17"),
                this.CappedOp.address,
                BN("5e16")
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
                this.CappedImplementation,
                this.ProxyAdmin.address,
                "0x"
            )

            this.CappedWstEth = new CappedGovToken__factory(this.deployer).attach(cTOKEN.address)
            console.log("Capped wstEthtimisim deployed: ", this.CappedWstEth.address)

            const init = await this.CappedWstEth.initialize(
                "Capped wstEthtimism",
                "cwstEth",
                this.WSTETH.address,
                this.VaultController.address,
                this.VotingVaultController.address
            )
            await init.wait()
            console.log("Capped wstEthtimism initialized: ", this.CappedWstEth.address)
        }

        //set oracle relay (already checked)
        console.log("setting wstEth oracle to be wstEth relay");
        let setRelay = await this.Oracle.setRelay(
            this.CappedWstEth.address,
            this.wstEthOracle.address
        );
        await setRelay.wait();

        //check and registerErc20
        const tokenid = await this.VaultController._tokenAddress_tokenId(
            this.CappedWstEth.address
        )
        if (tokenid.eq(0)) {
            console.log("Registering Capped wstEth on VaultController")
            let t = await this.VaultController.registerErc20(
                this.CappedWstEth.address,
                BN("8e17"),
                this.CappedWstEth.address,
                BN("5e16")
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
    }
}