import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { USDI, IERC20, IVOTE, VaultController, OracleMaster, AnchoredViewRelay, ChainlinkOracleRelay, IOracleRelay, CurveMaster, ThreeLines0_100, IVault, IOracleMaster, IVaultController, ProxyAdmin, IUSDI, ICurveMaster } from "../../typechain-types";
import { Addresser, MainnetAddresses } from "../../util/addresser";
import { BN } from "../../util/number";

export const d = new MainnetAddresses()