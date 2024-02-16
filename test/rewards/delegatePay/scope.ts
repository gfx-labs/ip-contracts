import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { InterestProtocolTokenDelegate, USDI, IERC20, IVOTE, UniswapV2OracleRelay, VotingVault, CappedToken, CappedSTETH, CappedRebaseToken, CappedFeeOnTransferToken, AnchoredViewRelay, ChainlinkOracleRelay, IOracleRelay, ILidoOracle, ThreeLines0_100, IVault, IOracleMaster, IVaultController, ProxyAdmin, IUSDI, ICurveMaster, ILido, CappedGovToken, VotingVaultController, MerkleRedeem } from "../../../typechain-types";
import { Addresser, MainnetAddresses } from "../../../util/addresser";
import { BN } from "../../../util/number";
//import { minter } from "../../../util/math"
import MerkleTree from "merkletreejs";

export type minter = {
       minter: string
       amount: BigNumber 
}
export class TestScope extends MainnetAddresses {



    delegateList: minter[] = []
    delegateListObject!: JSON
  

    MERKLE_TREE!: MerkleTree
    MERKLE_TREE2!: MerkleTree
    ROOT!: string
    ROOT2!: string

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

    CappedToken!: CappedToken;
    CappedAMPL!: CappedRebaseToken;
    CappedPAXG!: CappedFeeOnTransferToken;
    CAP = BN("100000e18")//100k

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
    CarolVotingVault!: VotingVault
    DeployerVotingVault!: VotingVault
    DeployerVaultID = 1
    DeployerVault!: IVault
    CarolVault!: IVault
    CaroLVaultID!: BigNumber

    IP_OWNER = "0x266d1020a84b9e8b0ed320831838152075f8c4ca"
    owner = ethers.provider.getSigner(this.IP_OWNER)

    IP_DEPLOYER = "0xe75358526Ef4441Db03cCaEB9a87F180fAe80eb9"
    DEPLOYER =  ethers.provider.getSigner(this.IP_DEPLOYER)
    
    MerkleRedeem!: MerkleRedeem

    VotingVaultController!: VotingVaultController

    IPT!: InterestProtocolTokenDelegate;
    cIPT!: CappedGovToken
    CappedAave!: CappedGovToken
    AaveCap = BN("500e18")
    aaveAmount = BN("1000e18")

    USDC_AMOUNT = BN("1000e6")

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
