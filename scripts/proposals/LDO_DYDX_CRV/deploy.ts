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

const chainlinkLDOFeed = "0x4e844125952d32acdf339be976c98e22f6f318db"
const LDO_USDC = "0x78235D08B2aE7a3E00184329212a4d7AcD2F9985"
const LDO_WETH_3k = "0xa3f558aebAecAf0e11cA4b2199cC5Ed341edfd74"
const LDO_WETH_10k = "0xf4aD61dB72f114Be877E87d62DC5e7bd52DF4d9B"

const chainlinkDYDXfeed = "0x478909D4D798f3a1F11fFB25E4920C959B4aDe0b"
const DYDX_WETH_10k = "0xe0CfA17aa9B8f930Fd936633c0252d5cB745C2C3"

const chainlinkCRVfeed = "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
const CRV_WETH_10k = "0x4c83A7f819A5c37D64B4c5A2f8238Ea082fA1f4e"



const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const LDOaddress = "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32"
const DYDXaddress = "0x92D6C1e31e14520e676a687F0a93788B716BEff5"
const CRVaddress = "0xD533a949740bb3306d119CC777fa900bA034cd52"

let anchorLDO: UniswapV3TokenOracleRelay
let anchorDYDX: UniswapV3TokenOracleRelay
let anchorCRV: UniswapV3TokenOracleRelay

let mainLDO: ChainlinkTokenOracleRelay
let mainDYDX: ChainlinkOracleRelay
let mainCRV: ChainlinkOracleRelay

let anchorViewLDO: AnchoredViewRelay
let anchorViewDYDX: AnchoredViewRelay
let anchorViewCRV: AnchoredViewRelay

let CappedLDO: CappedGovToken
let CappedDYDX: CappedGovToken
let CappedCRV: CappedGovToken

const deployCapTokens = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    const CappedGovFactory = await ethers.getContractFactory("CappedGovToken")
    const ucLDO = await CappedGovFactory.deploy()
    const cLDO = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucLDO.address,
        proxy.address,
        "0x"
    )
    await cLDO.deployed()

    CappedLDO = CappedGovFactory.attach(cLDO.address)
    console.log("Capped LDO deployed to: ", cLDO.address)
    const initLDO = await CappedLDO.initialize(
        "Capped LDO",
        "cLDO",
        LDOaddress,
        d.VaultController,
        d.VotingVaultController
    )
    await initLDO.wait()
    console.log("Capped LDO Initialized", CappedLDO.address)



    //const DYDXFactory = await ethers.getContractFactory("CappedGovToken")
    const ucDYDX = await CappedGovFactory.deploy()
    await ucDYDX.deployed()
    console.log("ucDYDX deployed: ", ucDYDX.address)
    const cDYDX = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucDYDX.address,
        proxy.address,
        "0x"
    )
    await cDYDX.deployed()
    CappedDYDX = CappedGovFactory.attach(cDYDX.address)
    console.log("Capped DYDX deployed to: ", cDYDX.address)
    const initDYDX = await CappedDYDX.initialize(
        "Capped DYDX",
        "cDYDX",
        DYDXaddress,
        d.VaultController,
        d.VotingVaultController
    )
    await initDYDX.wait()
    console.log("Capped DYDX Initialized", CappedDYDX.address)


    const ucCRV = await CappedGovFactory.deploy()
    await ucCRV.deployed()
    console.log("ucCRV deployed: ", ucCRV.address)
    const cCRV = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucCRV.address,
        proxy.address,
        "0x"
    )
    await cCRV.deployed()
    CappedCRV = CappedGovFactory.attach(cCRV.address)
    console.log("Capped CRV deployed to: ", cCRV.address)
    const initCRV = await CappedCRV.initialize(
        "Capped CRV",
        "cCRV",
        CRVaddress,
        d.VaultController,
        d.VotingVaultController
    )
    await initCRV.wait()
    console.log("Capped CRV Initialized", CappedCRV.address)

}

const deployOracles = async (deployer: SignerWithAddress) => {
    let anchorFactory = new UniswapV3TokenOracleRelay__factory(deployer)
    let mainFactory = new ChainlinkOracleRelay__factory(deployer)
    let mainTokenFactory = new ChainlinkTokenOracleRelay__factory(deployer)
    let anchorViewFactory = new AnchoredViewRelay__factory(deployer)

    anchorLDO = await anchorFactory.deploy(
        14400,
        LDO_WETH_10k,
        false,
        BN("1"),
        BN('1')
    )
    await anchorLDO.deployed()

    console.log("LDO Uniswap V3 anchor deployed: ", anchorLDO.address)
    showBodyCyan("LDO anchor relay price: ", await toNumber(await anchorLDO.currentValue()))

    anchorDYDX = await anchorFactory.deploy(
        14400,
        DYDX_WETH_10k,
        false,
        BN("1"),
        BN("1")
    )
    await anchorDYDX.deployed()
    console.log("DYDX Uniswap V3 anchor deployed: ", anchorDYDX.address)
    showBodyCyan("DYDX anchor relay price: ", await toNumber(await anchorDYDX.currentValue()))

    anchorCRV = await anchorFactory.deploy(
        14400,
        CRV_WETH_10k,
        true,
        BN("1"),
        BN("1")
    )
    await anchorCRV.deployed()
    console.log("CRV Uniswap V3 anchor deployed: ", anchorCRV.address)
    showBodyCyan("CRV anchor relay price: ", await toNumber(await anchorCRV.currentValue()))

    mainLDO = await mainTokenFactory.deploy(
        chainlinkLDOFeed,
        BN("1"),
        BN("1")
    )
    await mainLDO.deployed()
    console.log("LDO chainlink data relay deployed: ", mainLDO.address)
    showBodyCyan("LDO chainlink data feed price: ", await toNumber(await mainLDO.currentValue()))


    mainDYDX = await mainFactory.deploy(
        chainlinkDYDXfeed,
        BN("1e10"),
        BN("1")
    )
    await mainDYDX.deployed()
    console.log("DYDX chainlink data relay deployed: ", mainDYDX.address)
    showBodyCyan("DYDX chainlink data feed price: ", await toNumber(await mainDYDX.currentValue()))

    mainCRV = await mainFactory.deploy(
        chainlinkCRVfeed,
        BN("1e10"),
        BN("1")
    )
    await mainCRV.deployed()
    console.log("CRV chainlink data relay deployed: ", mainCRV.address)
    showBodyCyan("CRV chainlink data feed price: ", await toNumber(await mainCRV.currentValue()))

    anchorViewLDO = await anchorViewFactory.deploy(
        anchorLDO.address,
        mainLDO.address,
        BN("20"),
        BN("100")
    )
    await anchorViewLDO.deployed()
    console.log("Anchor View LDO deployed: ", anchorViewLDO.address)
    showBodyCyan("LDO Anchor view price: ", await toNumber(await anchorViewLDO.currentValue()))

    anchorViewDYDX = await anchorViewFactory.deploy(
        anchorDYDX.address,
        mainDYDX.address,
        BN("20"),
        BN("100")
    )
    await anchorViewDYDX.deployed()
    console.log("Anchor View DYDX deployed: ", anchorViewDYDX.address)
    showBodyCyan("DYDX Anchor view price: ", await toNumber(await anchorViewDYDX.currentValue()))

    anchorViewCRV = await anchorViewFactory.deploy(
        anchorCRV.address,
        mainCRV.address,
        BN("20"),
        BN("100")
    )
    await anchorViewCRV.deployed()
    console.log("Anchor View DYDX deployed: ", anchorViewCRV.address)
    showBodyCyan("DYDX Anchor view price: ", await toNumber(await anchorViewCRV.currentValue()))



}

const deploy = async (deployer: SignerWithAddress) => {

    await deployCapTokens(deployer)

    console.log("All Cap Tokens deployed")

    await deployOracles(deployer)

    console.log("All oracles have been deployed successfully")


    await CappedLDO.setCap(BN("4000000e18"))
    console.log("Set LDO cap to: ", BN("4000000e18").toString())

    await CappedDYDX.setCap(BN("3300000e18"))
    console.log("Set DYDX cap to: ", BN("3300000e18").toString())

    await CappedCRV.setCap(BN("6000000e18"))
    console.log("Set CRV cap to: ", BN("6000000e18").toString())

    await CappedLDO.transferOwnership(govAddress)
    console.log("Transferred ownership of Capped LDO to: ", govAddress)

    await CappedDYDX.transferOwnership(govAddress)
    console.log("Transferred ownership of Capped DYDX to: ", govAddress)

    await CappedCRV.transferOwnership(govAddress)
    console.log("Transferred ownership of Capped DYDX to: ", govAddress)


};

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await network.provider.send("evm_setAutomine", [true])
    await reset(15798742)


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
