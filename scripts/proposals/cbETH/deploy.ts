import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CappedGovToken,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    CappedGovToken__factory,
    UniswapV3TokenOracleRelay__factory,
    UniswapV3TokenOracleRelay,
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    OracleMaster__factory,
    VaultController__factory,
    VotingVaultController__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    ChainlinkTokenOracleRelay,
    ChainlinkTokenOracleRelay__factory
} from "../../../typechain-types";
import { DeployContractWithProxy, DeployContract } from "../../../util/deploy";
import { ProposalContext } from "../suite/proposal";
import { toNumber } from "../../../util/math";
import { d } from "../DeploymentInfo"
import { showBody, showBodyCyan } from "../../../util/format";
import { reset } from "../../../util/block";

const { ethers, network, upgrades } = require("hardhat");
const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"


const chainlinkCBETHfeed = "0x67eF3CAF8BeB93149F48e8d20920BEC9b4320510"
const CBETH_POOL = "0x840DEEef2f115Cf50DA625F7368C24af6fE74410"
const cbEthAddress = "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704"

const cbETH_CAP = BN("4200e18")
const cbETH_LiqInc = BN("1e17")
const cbETH_LTV = BN("75e16")

let anchorCBETH: UniswapV3TokenOracleRelay
let mainCBETH: ChainlinkOracleRelay
let anchorViewCBETH: AnchoredViewRelay
let CappedCBETH: CappedGovToken


const deployCapTokens = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    const CappedGovFactory = await ethers.getContractFactory("CappedGovToken")
    const uccbETH = await CappedGovFactory.deploy()
    const ccbETH = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        uccbETH.address,
        proxy.address,
        "0x"
    )
    await ccbETH.deployed()

    CappedCBETH = CappedGovFactory.attach(ccbETH.address)
    console.log("Capped cbETH deployed to: ", ccbETH.address)
    const initcbETH = await CappedCBETH.initialize(
        "Capped cbETH",
        "ccbETH",
        cbEthAddress,
        d.VaultController,
        d.VotingVaultController
    )
    await initcbETH.wait()
    console.log("Capped cbETH Initialized", CappedCBETH.address)


}

const deployOracles = async (deployer: SignerWithAddress) => {
    let anchorFactory = new UniswapV3TokenOracleRelay__factory(deployer)
    let mainFactory = new ChainlinkOracleRelay__factory(deployer)
    //let mainTokenFactory = new ChainlinkTokenOracleRelay__factory(deployer)
    let anchorViewFactory = new AnchoredViewRelay__factory(deployer)

    anchorCBETH = await anchorFactory.deploy(
        14400,
        CBETH_POOL,
        false,
        BN("1"),
        BN('1')
    )
    await anchorCBETH.deployed()

    console.log("cbETH Uniswap V3 anchor deployed: ", anchorCBETH.address)
    showBodyCyan("cbETH anchor relay price: ", await toNumber(await anchorCBETH.currentValue()))


    mainCBETH = await mainFactory.deploy(
        chainlinkCBETHfeed,
        BN("1e10"),
        BN("1")
    )
    await mainCBETH.deployed()
    console.log("cbETH chainlink data relay deployed: ", mainCBETH.address)
    showBodyCyan("cbETH chainlink data feed price: ", await toNumber(await mainCBETH.currentValue()))

    anchorViewCBETH = await anchorViewFactory.deploy(
        anchorCBETH.address,
        mainCBETH.address,
        BN("10"),
        BN("100")
    )
    await anchorViewCBETH.deployed()
    console.log("Anchor View cbETH deployed: ", anchorViewCBETH.address)
    showBodyCyan("cbETH Anchor view price: ", await toNumber(await anchorViewCBETH.currentValue()))


}

const deploy = async (deployer: SignerWithAddress) => {


    await deployCapTokens(deployer)

    console.log("All Cap Tokens deployed")

    await deployOracles(deployer)

    console.log("All oracles have been deployed successfully")


    await CappedCBETH.setCap(cbETH_CAP)
    console.log("Set cbETH cap to: ", await toNumber(cbETH_CAP))




    /**
     CappedDYDX = CappedGovToken__factory.connect("0xDDB3BCFe0304C970E263bf1366db8ed4DE0e357a", deployer)
    CappedCRV = CappedGovToken__factory.connect("0x9d878eC06F628e883D2F9F1D793adbcfd52822A8", deployer)


    await CappedDYDX.setCap(BN("3300000e18"))
    console.log("Set DYDX cap to: ", BN("3300000e18").toString())

    await CappedCRV.setCap(BN("6000000e18"))
    console.log("Set CRV cap to: ", BN("6000000e18").toString())

    //await CappedCBETH.transferOwnership(govAddress)
    //console.log("Transferred ownership of Capped cbETH to: ", govAddress)

    //await CappedDYDX.transferOwnership(govAddress)
    //console.log("Transferred ownership of Capped DYDX to: ", govAddress)

    //await CappedCRV.transferOwnership(govAddress)
    //console.log("Transferred ownership of Capped DYDX to: ", govAddress)

     */

};

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await network.provider.send("evm_setAutomine", [true])
    await reset(15999131)


    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    await deploy(deployer)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

/**
Capped cbETH deployed to:  0x7C1Caa71943Ef43e9b203B02678000755a4eCdE9
Capped cbETH Initialized 0x7C1Caa71943Ef43e9b203B02678000755a4eCdE9
Capped DYDX deployed to:  0xDDB3BCFe0304C970E263bf1366db8ed4DE0e357a
Capped DYDX Initialized 0xDDB3BCFe0304C970E263bf1366db8ed4DE0e357a
Capped CRV deployed to:  0x9d878eC06F628e883D2F9F1D793adbcfd52822A8
Capped CRV Initialized 0x9d878eC06F628e883D2F9F1D793adbcfd52822A8
All Cap Tokens deployed
cbETH Uniswap V3 anchor deployed:  0xcD17f6766Cdff24a4642b99f0DE481c3E704EA39
DYDX Uniswap V3 anchor deployed:  0x7FFF1525B560cf5Da9e9c72736bCC7A908b140D4
CRV Uniswap V3 anchor deployed:  0xfD76D7EcbF91b2bF7F225af29C1cb7f213fA71b6
cbETH chainlink data relay deployed:  0x9816d7C448f79CdD4aF18c4Ae1726A14299E8C75
DYDX chainlink data relay deployed:  0x8C8AE22fea16C43743C846902eC7E34204894189
CRV chainlink data relay deployed:  0xb549c8cc8011CA0d023A73DAD54d725125b25F31
Anchor View cbETH deployed:  0x610d4DFAC3EC32e0be98D18DDb280DACD76A1889
Anchor View DYDX deployed:  0x93A3411c9518D9c85054693137c87C5F14E7ECF9
Anchor View CRV deployed:  0x864991b13691806be077E7Ca9ef566FE7762F908
All oracles have been deployed successfully
Set cbETH cap to:  4000000000000000000000000
Set DYDX cap to:  3300000000000000000000000
Set CRV cap to:  6000000000000000000000000
 */