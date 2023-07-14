import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "ethers"
import {
    USDI,
    IERC20,
    AnchoredViewRelay,
    ChainlinkOracleRelay,
    IOracleRelay,
    ThreeLines0_100,
    IVault,
    IOracleMaster,
    IVaultController,
    ProxyAdmin,
    ICurveMaster,
    VotingVaultController,
    CappedGovToken,
    VotingVault
} from "../../../typechain-types"
import { OptimisimAddresses, OptimisimDeploys } from "../../../util/addresser"
import { BN } from "../../../util/number"
const { ethers } = require("hardhat");

export class TestScope extends OptimisimAddresses {

    d = new OptimisimDeploys()

    deployerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
    deployer = ethers.provider.getSigner(this.deployerAddr)

    USDI!: USDI
    USDC!: IERC20
    
    SNX!: IERC20

    SnxLTV = BN("70e16")
    SnxLiqInc = BN("75e15")
    SnxCap = BN("238000e18") 

    ProxyAdmin!: ProxyAdmin
    VaultController!: IVaultController
    VotingVaultController!: VotingVaultController
    Oracle!: IOracleMaster
    Curve!: ICurveMaster
    ThreeLines!: ThreeLines0_100

    CappedSNX!: CappedGovToken

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
    Bob_SNX = BN("100e18")
    Dave_USDC = BN("1e10")


    constructor() {
        super()
    }


}
const ts = new TestScope()
export const s = ts
