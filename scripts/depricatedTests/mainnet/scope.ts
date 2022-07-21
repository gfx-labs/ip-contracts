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
} from "../../../typechain-types";
import { Addresser, MainnetAddresses } from "../../../util/addresser";
import { BN } from "../../../util/number";
import { wave1 } from "../../../scripts//deployment/wave1"
import { wave2 } from "../../../scripts//deployment/wave2"

export class TestScope extends MainnetAddresses {
  USDC!: IERC20;

  whitelist1 = Array.from(wave1)
  whitelist2 = Array.from(wave2)

  randomWhitelist1!: string[]
  randomWhitelist2!: string[]
  randomWhiteList3!: string[]

  accounts!: SignerWithAddress[]

  usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0"
  iptHolder = "0x958892b4a0512b28AaAC890FC938868BBD42f064"
  IPTDelegator = "0xaF239a6fab6a873c779F3F33dbd34104287b93e1"

  waveDeploy = "0x5a4396a2fe5fd36c6528a441d7a97c3b0f3e8aee"
  waveReceiver!: string
  claimTime = 1655658000
  wave1start = 1655139600
  wave2start = 1655312400
  wave3start = 1655485200


  baseUSDC = BN("1000e6")

  tenkUSDC = BN("10000e6")

  Frank_USDC = BN("1e11");
  Bob_USDC = BN("40000000e6");
  Andy_USDC = BN("1000e6");
  Carol_USDC = BN("1000e6");
  Dave_USDC = BN("1000e6");
  Eric_USDC = BN("1000e6");
  Gus_USDC = BN("1000e6");
  Hector_USDC = BN("1000e6");

  Bank_USDC = BN("70,000,000e6")// 70MM USDC

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
