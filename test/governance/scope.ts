import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { IERC20, InterestProtocolTokenDelegate, InterestProtocolToken, GovernorCharlieDelegate, GovernorCharlieDelegator, ITokenDelegate, IGovernorCharlieDelegate} from "../../typechain-types";
import { Addresser, MainnetAddresses } from "../../util/addresser";
import { BN } from "../../util/number";

export class TestScope extends MainnetAddresses {
    USDC!: IERC20;

    Frank_USDC = BN("1e11")

    IPT!: InterestProtocolTokenDelegate;

    InterestProtocolTokenDelegate!: InterestProtocolTokenDelegate;
    InterestProtocolToken!: InterestProtocolToken;

    GovernorCharlieDelegate!: GovernorCharlieDelegate;
    GovernorCharlieDelegator!: GovernorCharlieDelegator;

    GOV!: GovernorCharlieDelegate;

    Frank!: SignerWithAddress  // frank holds all IPT from the mint
    Andy!: SignerWithAddress // frank sends andy some ipt
    Eric!: SignerWithAddress // frank delegates the ipt to eric
    Bob!: SignerWithAddress // whitelisted

    constructor() {
        super()
    }


}
const ts = new TestScope();
export const s = ts