import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { ethers } from "hardhat";
import { InterestProtocolTokenDelegate, USDI, IERC20, IVOTE, UniswapV2OracleRelay, VotingVault, CappedSTETH, CappedRebaseToken, CappedFeeOnTransferToken, AnchoredViewRelay, ChainlinkOracleRelay, IOracleRelay, ILidoOracle, ThreeLines0_100, IVault, IOracleMaster, IVaultController, ProxyAdmin, IUSDI, ICurveMaster, ILido, CappedGovToken, VotingVaultController, IBalancerVault, VaultBPT, CappedBptToken, IGauge, INonfungiblePositionManager__factory, Univ3CollateralToken, NftVaultController, VaultNft, INonfungiblePositionManager, V3PositionValuator, UniswapV3Pool, IUniV3Pool, IUniswapV3PoolDerivedState } from "../../../typechain-types";
import { Addresser, MainnetAddresses } from "../../../util/addresser";
import { BN } from "../../../util/number";
import { NonfungiblePositionManager } from "@uniswap/v3-sdk";
import { PromiseOrValue } from "../../../typechain-types/common";

export type MintParams = {
    token0: PromiseOrValue<string>,
    token1: PromiseOrValue<string>,
    fee: PromiseOrValue<BigNumberish>,
    tickLower: PromiseOrValue<BigNumberish>,
    tickUpper: PromiseOrValue<BigNumberish>,
    amount0Desired: PromiseOrValue<BigNumberish>,
    amount1Desired: PromiseOrValue<BigNumberish>,
    amount0Min: PromiseOrValue<BigNumberish>,
    amount1Min: PromiseOrValue<BigNumberish>,
    recipient: PromiseOrValue<string>,
    deadline: PromiseOrValue<BigNumberish>
  }

export class TestScope extends MainnetAddresses {
    USDI!: USDI;
    USDC!: IERC20;
    WETH!: IERC20;
    UNI!: IVOTE;
    WBTC!: IERC20;


    CappedPosition!: Univ3CollateralToken
    NftVaultController!: NftVaultController
    nfpManager!: INonfungiblePositionManager
    PositionValuator!: V3PositionValuator

    BalancerVault!: IBalancerVault;
    wethOracleAddr = "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"
    wethOracle!: IOracleRelay
    wbtcOracleAddr = "0x8E7d39560b15B2D29E01b2502252C4B5f26f5326"
    wbtcOracle!: IOracleRelay
    

    POOL_ADDR = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD"
    POOL!: IUniV3Pool
    poolContract!:Contract
   
    LiquidationIncentive = BN("1e17")
    LTV = BN("6e17")

    ProxyAdmin!: ProxyAdmin;
    VaultController!: IVaultController;

    //owner!: String
    pauser!: String

    Oracle!: IOracleMaster;
    AnchoredViewEth!: AnchoredViewRelay
    AnchoredViewComp!: AnchoredViewRelay
    AnchoredViewUni!: AnchoredViewRelay
    AnchoredViewBtc!: AnchoredViewRelay
    AnchoredViewAave!: AnchoredViewRelay
    ChainlinkEth!: ChainlinkOracleRelay
    ChainlinkComp!: ChainlinkOracleRelay
    ChainLinkUni!: ChainlinkOracleRelay
    ChainLinkBtc!: ChainlinkOracleRelay
    UniswapRelayEthUsdc!: IOracleRelay;
    UniswapRelayCompUsdc!: IOracleRelay;
    UniswapRelayUniUsdc!: IOracleRelay;
    UniswapRelayWbtcUsdc!: IOracleRelay;

    UniV2Relay!: UniswapV2OracleRelay;

    Curve!: ICurveMaster;
    ThreeLines!: ThreeLines0_100;

    Frank!: SignerWithAddress  // frank is the Frank and master of USDI, and symbolizes the power of governance
    Andy!: SignerWithAddress   // andy is a usdc holder. He wishes to deposit his USDC to hold USDI
    Bob!: SignerWithAddress    // bob is an eth holder. He wishes to deposit his eth and borrow USDI
    Carol!: SignerWithAddress  // carol is a uni holder. She wishes to deposit uni and borrow USDI, and still be able to vote
    Dave!: SignerWithAddress   // dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob
    Eric!: SignerWithAddress   // eric only holds ETH and generally does not use IP unless a clean slate is needed
    Gus!: SignerWithAddress    // gus is the control, we can compare balances of those who wrapped to his to ensure all rebases are correct

    accounts!:SignerWithAddress[]

    BobVault!: IVault
    BobVaultID!: BigNumber
    BobVotingVault!: VotingVault
    BobBptVault!: VaultBPT
    BobNftVault!: VaultNft
    BobPositionId!: BigNumber
    BobAmount0!: BigNumber
    BobAmount1!: BigNumber

    CarolVotingVault!: VotingVault
    CarolBptVault!: VaultBPT
    CarolPositionId!: BigNumber
    CarolIllegalPositionId!: BigNumber
    CarolNftVault!: VaultNft
    CarolAmount0!: BigNumber
    CarolAmount1!: BigNumber

    DeployerVotingVault!: VotingVault
    DeployerVaultID = 1
    DeployerVault!: IVault
    CarolVault!: IVault
    CaroLVaultID!: BigNumber

    IP_OWNER = "0x266d1020a84b9e8b0ed320831838152075f8c4ca"
    owner = ethers.provider.getSigner(this.IP_OWNER)

    IP_DEPLOYER = "0x958892b4a0512b28AaAC890FC938868BBD42f064"
    DEPLOYER =  ethers.provider.getSigner(this.IP_DEPLOYER)

    GovAddr = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
    GOV = ethers.provider.getSigner(this.GovAddr)


    VotingVaultController!: VotingVaultController

    auraBal!: IERC20
    CappedAuraBal!: CappedBptToken
    auraBalRewards!: IERC20
    CappedAuraBalRewards!: CappedBptToken
    AuraBalAmount = BN("250e18")//200
    AuraBalRewardsAmount = BN("500e18")
    AuraBalCap = this.AuraBalAmount
    auraBalLTV = BN("75e16")

    primeAuraBalLP!: IERC20
    primeAuraBalRewardToken!: IERC20
    CappedAuraLP!: CappedBptToken
    AuraLPamount = BN("100e18")
    AuraLPrewardsAmount = BN("500e18")
    
    BAL!: IERC20


    CappedStethBpt!: CappedBptToken
    CappedStethGauge!: CappedBptToken
    CappedGaugeCap = BN("200e18")

    stETH_BPT!: IERC20
    stETH_Gauge!: IGauge
    stETH_BPT_Amount = BN("50e18")
    stETH_Gauge_Amount = BN("500e18")

    IPT!: InterestProtocolTokenDelegate;
    cIPT!: CappedGovToken

    CappedAave!: CappedGovToken
    AaveCap = BN("500e18")
    aaveAmount = BN("1000e18")

    CappedMatic!: CappedGovToken
    MaticCap = BN("50000000e18")

    USDC_AMOUNT = BN("1000e6")
    MTA_AMOUNT = BN("25000e18")//~1k USD
    WETH_AMOUNT = BN("1e18")
    wBTC_Amount = BN("1e8")
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
