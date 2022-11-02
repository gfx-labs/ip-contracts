import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { IGovernorCharlieDelegate } from "../../../../typechain-types";
import { 
    InterestProtocolTokenDelegate, 
    USDI, 
    IERC20, 
    IVOTE, 
    ILido, 
    CappedSTETH, 
    AnchoredViewRelay, 
    ChainlinkOracleRelay, 
    IOracleRelay, 
    ILidoOracle, 
    ThreeLines0_100, 
    IVault, 
    IOracleMaster, 
    IVaultController, 
    ProxyAdmin, 
    IUSDI, 
    ICurveMaster, 
    GovernorCharlieDelegate, 
    IGovernorCharlieDelegator,
    IGovernorCharlieDelegate__factory
 } from "../../../../typechain-types";
import { Addresser, MainnetAddresses } from "../../../../util/addresser";
import { BN } from "../../../../util/number";

export class TestScope extends MainnetAddresses {
    USDI!: USDI;
    USDC!: IERC20;
    COMP!: IVOTE;
    WETH!: IERC20;
    UNI!: IVOTE;
    WBTC!: IERC20;

    ENS!: IVOTE;
    DYDX!: IVOTE;
    AAVE!: IVOTE;
    TRIBE!: IVOTE;
    LiquidationIncentive = BN("5e16")
    wETH_LTV = BN("5e17")
    COMP_LTV = BN("4e17")
    UNI_LTV = BN("4e17")
    wBTC_LTV = BN("80e16")

    ProxyAdmin!: ProxyAdmin;
    VaultController!: IVaultController;

    IP_OWNER = "0x266d1020a84b9e8b0ed320831838152075f8c4ca"

    owner!: String
    pauser!: String

    Oracle!: IOracleMaster;
    AnchoredViewEth!: AnchoredViewRelay
    AnchoredViewComp!: AnchoredViewRelay
    AnchoredViewUni!: AnchoredViewRelay
    AnchoredViewBtc!: AnchoredViewRelay
    AnchoredViewSTETH!: AnchoredViewRelay
    ChainlinkEth!: ChainlinkOracleRelay
    ChainlinkComp!: ChainlinkOracleRelay
    ChainLinkUni!: ChainlinkOracleRelay
    ChainLinkBtc!: ChainlinkOracleRelay
    UniswapRelayEthUsdc!: IOracleRelay;
    UniswapRelayCompUsdc!: IOracleRelay;
    UniswapRelayUniUsdc!: IOracleRelay;
    UniswapRelayWbtcUsdc!: IOracleRelay;

    Curve!: ICurveMaster;
    ThreeLines!: ThreeLines0_100;

    IPT!: InterestProtocolTokenDelegate;
    GOV!: GovernorCharlieDelegate
    DELEGATOR!: IGovernorCharlieDelegator

    Frank!: SignerWithAddress  // frank is the Frank and master of USDI, and symbolizes the power of governance
    Andy!: SignerWithAddress   // andy is a usdc holder. He wishes to deposit his USDC to hold USDI
    Bob!: SignerWithAddress    // bob is an eth holder. He wishes to deposit his eth and borrow USDI
    Carol!: SignerWithAddress  // carol is a uni holder. She wishes to deposit uni and borrow USDI, and still be able to vote
    Dave!: SignerWithAddress   // dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob
    Eric!: SignerWithAddress   // eric only holds ETH and generally does not use IP unless a clean slate is needed
    Gus!: SignerWithAddress    // gus is a wBTC holder. He wishes to deposit wBTC and borrow USDI
    accounts!:SignerWithAddress[]

    ST_ORACLE!: ILidoOracle
    CappedSTETH!: CappedSTETH
    STETH!: ILido
    STETH_AMOUNT = BN("10e18")
    STETH_ADDRESS = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"
    STETH_CAP = BN("1000e18")

    BobVault!: IVault
    BobVaultID!: BigNumber
    CarolVault!: IVault
    CaroLVaultID!: BigNumber

    BASE_USDC = BN("1000e6")

    Andy_USDC = BN("1e8")
    Bob_USDC = BN("1000e6")
    Bob_WETH = BN("10e18")
    Carol_UNI = BN("100e18")
    Gus_WBTC = BN("10e8")

    Dave_USDC = BN("1e14")

    Carol_ENS = BN("100e18")
    Carol_DYDX = BN("100e18")
    Carol_AAVE = BN("100e18")
    Carol_TRIBE = BN("100e18")

    constructor() {
        super()
    }


}
const ts = new TestScope();
export const s = ts
