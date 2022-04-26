import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { USDI, IERC20, IVOTE, VaultController, OracleMaster, AnchoredViewRelay, ChainlinkOracleRelay, IOracleRelay, CurveMaster, ThreeLines0_100, IVault, IOracleMaster, IVaultController, ProxyAdmin, IUSDI, ICurveMaster } from "../../typechain-types";
import { Addresser, MainnetAddresses } from "../../util/addresser";
import { BN } from "../../util/number";

export class TestScope extends MainnetAddresses {
    USDI!: USDI;
    USDC!: IERC20;
    COMP!: IVOTE;
    WETH!: IERC20;

    ProxyAdmin!: ProxyAdmin;
    VaultController!: IVaultController;

    Oracle!: IOracleMaster;
    AnchoredViewEth!: AnchoredViewRelay
    AnchoredViewComp!: AnchoredViewRelay
    ChainlinkEth!: ChainlinkOracleRelay
    ChainlinkComp!: ChainlinkOracleRelay
    UniswapRelayEthUsdc!: IOracleRelay;
    UniswapRelayCompUsdc!: IOracleRelay;

    Curve!: ICurveMaster;
    ThreeLines!: ThreeLines0_100;

    Frank!: SignerWithAddress  // frank is the Frank and master of USDI
    Andy!: SignerWithAddress   // andy is a usdc holder. He wishes to deposit his USDC to hold USDI
    Bob!: SignerWithAddress    // bob is an eth holder. He wishes to deposit his eth and borrow USDI
    Carol!: SignerWithAddress  // carol is a comp holder. she wishes to deposit her comp and then vote
    Dave!: SignerWithAddress   // dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob


    BobVault!: IVault
    CarolVault!: IVault

    Andy_USDC = BN("1e8")
    Bob_WETH = BN("10e18")
    Carol_COMP = BN("100e18")
    Dave_USDC = BN("1e10")


    constructor() {
        super()
    }


}
const ts = new TestScope();
export const s = ts