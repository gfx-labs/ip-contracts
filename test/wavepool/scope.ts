import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import {
  IERC20,
  InterestProtocolTokenDelegate,
  InterestProtocolToken,
  GovernorCharlieDelegate,
  GovernorCharlieDelegator,
  ITokenDelegate,
  IGovernorCharlieDelegate,
} from "../../typechain-types";
import { Addresser, MainnetAddresses } from "../../util/addresser";
import { BN } from "../../util/number";

export class TestScope extends MainnetAddresses {
  USDC!: IERC20;

  usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";

  baseUSDC = BN("1000e6")

  Frank_USDC = BN("1e11");
  Bob_USDC = BN("40000000e6");
  Andy_USDC = BN("1000e6");
  Carol_USDC = BN("1000e6");
  Dave_USDC = BN("1000e6");
  Eric_USDC = BN("1000e6");
  Gus_USDC = BN("1000e6");
  Hector_USDC = BN("1000e6");

  Bank_USDC = BN("100e12")

  IPT!: InterestProtocolTokenDelegate;

  InterestProtocolTokenDelegate!: InterestProtocolTokenDelegate;
  InterestProtocolToken!: InterestProtocolToken;

  GovernorCharlieDelegate!: GovernorCharlieDelegate;
  GovernorCharlieDelegator!: GovernorCharlieDelegator;

  GOV!: GovernorCharlieDelegate;

  accounts!:SignerWithAddress[]

  Frank!: SignerWithAddress; // frank holds all IPT from the mint
  Andy!: SignerWithAddress; // frank sends andy some ipt
  Bob!: SignerWithAddress; // whitelisted
  Carol!: SignerWithAddress; // carol starts with no USDC, but receives proceeds from Wave
  Dave!: SignerWithAddress; // Dave
  Eric!: SignerWithAddress; // frank delegates the ipt to eric
  Gus!: SignerWithAddress; // Gus
  Hector!: SignerWithAddress; // Hector

  Igor!:SignerWithAddress; //Igor is not on any whitelist 

  Bank!:SignerWithAddress; //holds a ton of USDC and is not on any whitelist

  constructor() {
    super();
  }
}
const ts = new TestScope();
export const s = ts;
