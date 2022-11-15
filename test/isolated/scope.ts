import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
    USDI,
    IERC20, 
    IVOTE, 
    CappedGovToken, 
    InterestProtocolTokenDelegate, 
    AnchoredViewRelay, 
    ChainlinkOracleRelay, 
    IOracleRelay, 
    CurveMaster, 
    ThreeLines0_100, 
    IVault, 
    IOracleMaster, 
    IVaultController, 
    ProxyAdmin, 
    IUSDI, 
    ICurveMaster,
    IWUSDI,
    WUSDI__factory,
    VotingVaultController,
} from "../../typechain-types";
import { Addresser, MainnetAddresses } from "../../util/addresser";
import { BN } from "../../util/number";

export class TestScope extends MainnetAddresses {

    accounts!:SignerWithAddress[]
    IPT!: InterestProtocolTokenDelegate;
    cIPT!: CappedGovToken
    VotingVaultController!: VotingVaultController

    rETH!: IVOTE
    CappedRETH!: CappedGovToken

    
    CappedLDO!: CappedGovToken
    LDO_LiqInc = BN("1e17")
    LDO_LTV = BN("7e17")
    LDO_Cap = BN("4000000e18")
    LDO_Amount = BN("500e18")


    CappedDYDX!: CappedGovToken
    DYDX_LiqInc = BN("1e17")
    DYDX_LTV = BN("7e17")
    DYDX_Cap = BN("3300000e18")
    DYDX_Amount = BN("1000e18")

    
    CappedCRV!: CappedGovToken
    CRV_LiqInc = BN("1e17")
    CRV_LTV = BN("7e17")
    CRV_Cap = BN("6000000e18")
    CRV_Amount = BN("500e18")
 
    USDC_AMOUNT = BN("1000e6")


    WUSDI!: IWUSDI;

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
    wETH_LTV = BN("85e16")
    //COMP_LTV = BN("4e17")
    UNI_LTV = BN("75e16")
    wBTC_LTV = BN("80e16")

    ONE_BTC = BN("1e8")

    ProxyAdmin!: ProxyAdmin;
    VaultController!: IVaultController;

    Oracle!: IOracleMaster;
    AnchoredViewEth!: AnchoredViewRelay
    AnchoredViewComp!: AnchoredViewRelay
    AnchoredViewUni!: AnchoredViewRelay
    AnchoredViewBtc!: AnchoredViewRelay
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

    Frank!: SignerWithAddress  // frank is the Frank and master of USDI, and symbolizes the power of governance
    Andy!: SignerWithAddress   // andy is a usdc holder. He wishes to deposit his USDC to hold USDI
    Bob!: SignerWithAddress    // bob is an eth holder. He wishes to deposit his eth and borrow USDI
    Carol!: SignerWithAddress  // carol is a uni holder. She wishes to deposit uni and borrow USDI, and still be able to vote
    Dave!: SignerWithAddress   // dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob
    Eric!: SignerWithAddress   // eric only holds ETH and generally does not use IP unless a clean slate is needed
    Gus!: SignerWithAddress    // gus is a wBTC holder. He wishes to deposit wBTC and borrow USDI
    Hector!: SignerWithAddress // hector is also here

    BobVault!: IVault
    BobVaultID!: BigNumber
    CarolVault!: IVault
    CarolVaultID!: BigNumber
    GusVault!: IVault

    Andy_USDC = BN("1e8")
    Bob_USDC = BN("1000e6")
    Bob_WETH = BN("10e18")
    Carol_UNI = BN("100e18")
    Gus_WBTC = BN("10e8")

    Dave_USDC = BN("1e10")

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
