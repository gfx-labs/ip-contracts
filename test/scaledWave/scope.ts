import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {JsonRpcSigner} from "@ethersproject/providers"
import {Wallet} from "@ethersproject/wallet"

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
import { wave1 } from "./data/wave1"
import { wave2 } from "./data/wave2"

export class TestScope extends MainnetAddresses {
  USDC!: IERC20;

  whitelist1 = Array.from(wave1)
  whitelist2 = Array.from(wave2)

  accounts!: SignerWithAddress[]

  accounts1!: JsonRpcSigner[]
  accounts2!: JsonRpcSigner[]

  wallets1!: Wallet[]
  wallets2!: Wallet[]

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

  Frank!: SignerWithAddress; // frank holds all IPT from the mint
  Andy!: SignerWithAddress; // frank sends andy some ipt
  Bob!: SignerWithAddress; // whitelisted
  Carol!: SignerWithAddress; // carol starts with no USDC, but receives proceeds from Wave
  Dave!: SignerWithAddress; // Dave
  Eric!: SignerWithAddress; // frank delegates the ipt to eric
  Gus!: SignerWithAddress; // Gus
  Hector!: SignerWithAddress; // Hector

  Igor!: SignerWithAddress; //Igor is not on any whitelist 

  Bank!: SignerWithAddress; //holds a ton of USDC and is not on any whitelist

  constructor() {
    super();
  }
}
const ts = new TestScope();
export const s = ts;
