import { ethers, BigNumber } from "ethers";
import { ethers as hethers } from "hardhat";

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
import { Addresser, Mainnet } from "./addresser";
import { BN } from "./number";

export class TestContracts {
    deployed: boolean;
    book: Addresser;

    USDI?: USDI;
    USDC?: IERC20;
    COMP?: IERC20;
    COMPVOTE?: IVOTE;
    WETH?: IERC20;

    VaultController?: VaultController;

    Oracle?: OracleMaster;
    AnchoredViewEth?: AnchoredViewRelay
    AnchoredViewComp?: AnchoredViewRelay
    ChainlinkEth?: ChainlinkOracleRelay
    ChainlinkComp?: ChainlinkOracleRelay
    UniswapRelayEthUsdc?: IOracleRelay;
    UniswapRelayCompUsdc?: IOracleRelay;

    Curve?: CurveMaster;
    ThreeLines?: ThreeLines0_100;

    constructor() {
        this.deployed = false;
        this.book = Mainnet;
    }

    async deploy(deployer: ethers.Signer) {
        if (this.deployed) {
            return;
        }
        this.deployed = true;
        this.USDI = await new USDI__factory(deployer).deploy(this.book.usdcAddress);
        // set owner
        this.USDI.connect(deployer).setMonetaryPolicy(await deployer.getAddress());

        this.USDC = IERC20__factory.connect(
            this.book.usdcAddress,
            hethers.provider
        );
        this.COMP = IERC20__factory.connect(
            this.book.compAddress,
            hethers.provider
        );
        this.WETH = IERC20__factory.connect(
            this.book.wethAddress,
            hethers.provider
        );
        this.COMPVOTE = IVOTE__factory.connect(
            this.book.compAddress,
            hethers.provider
        );

        this.VaultController = await new VaultController__factory(deployer).deploy();
        await this.USDI.setVaultController(this.VaultController.address);
        // setup curve
        this.Curve = await new CurveMaster__factory(deployer).deploy();
        await this.VaultController.register_curve_master(this.Curve.address);
        this.ThreeLines = await new ThreeLines0_100__factory(
            deployer
        ).deploy(
            BN("200e16"),
            BN("5e16"),
            BN("45e15"),
            BN("1e16"),
            BN("50e16"),
            BN("55e16"),
        );

        await this.Curve.connect(deployer).set_curve(
            "0x0000000000000000000000000000000000000000",
            this.ThreeLines.address
        );

        //setup oracle master
        this.Oracle = await new OracleMaster__factory(deployer).deploy();
        //set oracle on the vault controller
        await this.VaultController.connect(deployer).register_oracle_master(
            this.Oracle.address
        );
        //setup uniswap comp oracle
        this.UniswapRelayCompUsdc = await new UniswapV3OracleRelay__factory(
            deployer
        ).deploy(this.book.usdcCompPool, true, BN("1e12"), BN("1"));
        //setup chainlink comp oracle
        this.ChainlinkComp = await new ChainlinkOracleRelay__factory(deployer).deploy(
            "0xdbd020caef83efd542f4de03e3cf0c28a4428bd5", BN("1e10"), BN("1")
        );
        //setup anchored view for comp
        this.AnchoredViewComp = await new AnchoredViewRelay__factory(deployer).deploy(
            this.UniswapRelayCompUsdc.address,
            this.ChainlinkComp.address,
            BN("30"),
            BN("100")
        );
        //setup comp anchored view on the oracle master
        await this.Oracle.connect(deployer).set_relay(
            this.book.compAddress,
            this.AnchoredViewComp.address
        );

        this.UniswapRelayEthUsdc = await new UniswapV3OracleRelay__factory(
            deployer
        ).deploy(this.book.usdcWethPool, true, BN("1e12"), BN("1"));

        this.ChainlinkEth = await new ChainlinkOracleRelay__factory(deployer).deploy(
            "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419", BN("1e10"), BN("1")
        )
        this.AnchoredViewEth = await new AnchoredViewRelay__factory(deployer).deploy(
            this.UniswapRelayEthUsdc.address,
            this.ChainlinkEth.address,
            BN("10"),
            BN("100")
        );
        await this.Oracle.connect(deployer).set_relay(
            this.book.wethAddress,
            this.AnchoredViewEth.address,
        );

        //register tokens
        await this.VaultController.connect(deployer).register_erc20(
            this.book.wethAddress,
            BN("5e17"),
            this.book.wethAddress,
            BN("5e16"),
        );
        await this.VaultController!.connect(deployer).register_erc20(
            this.book.compAddress,
            BN("4e17"),
            this.book.compAddress,
            BN("5e16"),
        );
        await this.VaultController!.connect(deployer).register_usdi(this.USDI!.address)
    }
}

export const Deployment = new TestContracts();
