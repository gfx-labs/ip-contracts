import { ethers, BigNumber } from "ethers";
import { ethers as hethers } from "hardhat";

import {
  IERC20,
  IERC20__factory,
  IOracleRelay,
  OracleMaster,
  OracleMaster__factory,
  UniswapV3OracleRelay__factory,
  USDI,
  USDI__factory,
  Vault,
  VaultMaster,
  VaultMaster__factory,
} from "../../typechain-types";
import { Addresser, Mainnet } from "./addresser";

export class TestContracts {
  deployed: boolean;
  book: Addresser;

  USDI?: USDI;

  USDC?: IERC20;
  COMP?: IERC20;
  WETH?: IERC20;

  VaultMaster?: VaultMaster;

  Oracle?: OracleMaster;
  UniswapRelayEthUsdc?: IOracleRelay;
  UniswapRelayCompUsdc?: IOracleRelay;

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

    this.VaultMaster = await new VaultMaster__factory(deployer).deploy();
    await this.USDI.setVaultMaster(this.VaultMaster.address);

    // setup oracle
    this.Oracle = await new OracleMaster__factory(deployer).deploy();
    this.UniswapRelayEthUsdc = await new UniswapV3OracleRelay__factory(
      deployer
    ).deploy(this.book.usdcWethPool, true);

    await this.Oracle.connect(deployer).set_relay(
      this.book.wethAddress,
      this.UniswapRelayEthUsdc.address
    );
    this.UniswapRelayCompUsdc = await new UniswapV3OracleRelay__factory(
      deployer
    ).deploy(this.book.usdcCompPool, true);
    await this.Oracle.connect(deployer).set_relay(
      this.book.compAddress,
      this.UniswapRelayCompUsdc.address
    );
    await this.VaultMaster.connect(deployer).register_oracle_master(
      this.Oracle.address
    );
    //register tokens
    await this.VaultMaster.connect(deployer).register_erc20(
      this.book.wethAddress,
      6000, //max ltv ratio
      this.book.wethAddress,
      BigNumber.from("9500") //liquidation incentive
    );
    await this.VaultMaster!.connect(deployer).register_erc20(
      this.book.compAddress,
      4000,
      this.book.compAddress,
      BigNumber.from("9500")
    );
    await this.VaultMaster!.connect(deployer).register_usdi(this.USDI!.address)
  }
}

export const Deployment = new TestContracts();
