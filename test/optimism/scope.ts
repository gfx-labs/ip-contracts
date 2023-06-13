import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "ethers"
import { USDI, IERC20, IVOTE, VaultController, OracleMaster, AnchoredViewRelay, ChainlinkOracleRelay, IOracleRelay, CurveMaster, ThreeLines0_100, IVault, IOracleMaster, IVaultController, ProxyAdmin, IUSDI, ICurveMaster, VotingVaultController, CappedGovToken, VotingVault } from "../../typechain-types"
import { Addresser, OptimisimAddresses, OptimisimDeploys } from "../../util/addresser"
import { BN } from "../../util/number"
const { ethers } = require("hardhat");

export class TestScope extends OptimisimAddresses {

    d = new OptimisimDeploys()

    deployerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
    deployer = ethers.provider.getSigner(this.deployerAddr)

    USDI!: USDI
    USDC!: IERC20
    WETH!: IERC20
    WBTC!: IERC20
    OP!: IERC20

    WethLTV = BN("85e16")
    WethLiqInc = BN("5e16")
    WethCap = BN("2700e18") //$5mm

    wBtcLTV = BN("8e17")
    wBtcLiqInc = BN("7e16")
    wBtcCap = BN("190e8") //$5mm

    OpLTV = BN("7e17")
    OpLiqInc = BN("7e16")
    OpCap = BN("1500000e18") //$2mm

    wstEthLTV = BN("8e17")
    wstEthLiqInc = BN("7e16")
    wstEthCap = BN("1000e18")//$2mm 

    rEthLTV = BN("75e16")
    rEthLiqInc = BN("7e16")
    rEthCap = BN("500e18")//$1mm 


    ProxyAdmin!: ProxyAdmin
    VaultController!: IVaultController
    VotingVaultController!: VotingVaultController
    Oracle!: IOracleMaster
    Curve!: ICurveMaster
    ThreeLines!: ThreeLines0_100

    CappedWeth!: CappedGovToken
    CappedWbtc!: CappedGovToken
    CappedOp!: CappedGovToken
    CappedWstEth!: CappedGovToken
    CappedReth!: CappedGovToken

    AnchoredViewEth!: AnchoredViewRelay
    AnchoredViewBtc!: AnchoredViewRelay
    ChainlinkEth!: ChainlinkOracleRelay
    ChainLinkBtc!: ChainlinkOracleRelay
    UniswapRelayEthUsdc!: IOracleRelay
    UniswapRelayWbtcUsdc!: IOracleRelay


    Frank!: SignerWithAddress  // frank is the Frank and master of USDI, and symbolizes the power of governance
    Andy!: SignerWithAddress   // andy is a usdc holder. He wishes to deposit his USDC to hold USDI
    Bob!: SignerWithAddress    // bob is an eth holder. He wishes to deposit his eth and borrow USDI
    Carol!: SignerWithAddress  // carol is a uni holder. She wishes to deposit uni and borrow USDI, and still be able to vote
    Dave!: SignerWithAddress   // dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob
    Eric!: SignerWithAddress   // eric only holds ETH and generally does not use IP unless a clean slate is needed
    Gus!: SignerWithAddress    // gus is a wBTC holder. He wishes to deposit wBTC and borrow USDI

    BobVault!: IVault
    BobVotingVault!: VotingVault
    BobVaultID!: BigNumber
    CarolVault!: IVault
    CarolVotingVault!: VotingVault
    CarolVaultID!: BigNumber

    Andy_USDC = BN("1e8")
    Bob_USDC = BN("1000e6")
    Bob_WETH = BN("10e18")
    Carol_OP = BN("50e18")
    Gus_WBTC = BN("1e7")

    Dave_USDC = BN("1e10")


    constructor() {
        super()
    }


}
const ts = new TestScope()
export const s = ts
