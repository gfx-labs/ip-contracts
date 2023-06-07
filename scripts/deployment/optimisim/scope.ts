import { OptimisimAddresses } from "../../../util/addresser";
import { BN } from "../../../util/number";

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
} from "../../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
export class TestScope extends OptimisimAddresses {
    constructor() {
        super()
    }
}

const ts = new TestScope();
export const s = ts
