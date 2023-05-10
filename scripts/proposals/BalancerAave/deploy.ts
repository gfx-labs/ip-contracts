import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CappedGovToken, UniswapV3TokenOracleRelay__factory,
    UniswapV3TokenOracleRelay,
    AnchoredViewRelay,
    AnchoredViewRelay__factory, ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory
} from "../../../typechain-types";
import { d } from "../DeploymentInfo";

const { ethers, network, upgrades } = require("hardhat");


const bal3k = "0xDC2c21F1B54dDaF39e944689a8f90cb844135cc9"//bal/weth ~$280k liquidity, the only viable pool
const balDataFeed = "0xdf2917806e30300537aeb49a7663062f4d1f2b5f"

const aave3k = "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"//aave/weth ~$906k liqudiity, the best pool by far
const aaveDataFeed = "0x547a514d5e3769680ce22b2361c10ea13619e8a9"



const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const balancerAddress = "0xba100000625a3754423978a60c9317c58a424e3D"
const aaveAddress = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"

let anchorBal: UniswapV3TokenOracleRelay
let anchorAave: UniswapV3TokenOracleRelay

let mainBal: ChainlinkOracleRelay
let mainAave: ChainlinkOracleRelay

let anchorViewBal: AnchoredViewRelay
let anchorViewAave: AnchoredViewRelay

let CappedBal: CappedGovToken
let CappedAave: CappedGovToken

const deployCapTokens = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    const CappedGovFactory = await ethers.getContractFactory("CappedGovToken")
    //const ucBAL = await CappedGovFactory.deploy()
    const cBal = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        "0xE565E118e75304dD3cF83dff409c90034b7EA18a",//already deployed
        proxy.address,
        "0x"
    )
    await cBal.deployed()

    CappedBal = CappedGovFactory.attach(cBal.address)
    console.log("Capped Balancer deployed to: ", cBal.address)
    const initBal = await CappedBal.initialize(
        "Capped Balancer",
        "cBAL",
        balancerAddress,
        d.VaultController,
        d.VotingVaultController
    )
    await initBal.wait()
    console.log("Capped Balancer Initialized", CappedBal.address)



    //const aaveFactory = await ethers.getContractFactory("CappedGovToken")
    const ucAAVE = await CappedGovFactory.deploy()
    await ucAAVE.deployed()
    console.log("ucAAVE deployed: ", ucAAVE.address)
    const cAAVE = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucAAVE.address,
        proxy.address,
        "0x"
    )
    await cAAVE.deployed()
    CappedAave = CappedGovFactory.attach(cAAVE.address)
    console.log("Capped Aave deployed to: ", cAAVE.address)
    const initAave = await CappedAave.initialize(
        "Capped Aave",
        "cAAVE",
        aaveAddress,
        d.VaultController,
        d.VotingVaultController
    )
    await initAave.wait()
    console.log("Capped Aave Initialized", CappedAave.address)

}

const deployOracles = async (deployer: SignerWithAddress) => {
    let anchorFactory = new UniswapV3TokenOracleRelay__factory(deployer)
    let mainFactory = new ChainlinkOracleRelay__factory(deployer)
    let anchorViewFactory = new AnchoredViewRelay__factory(deployer)

    anchorBal = await anchorFactory.deploy(
        14400,
        bal3k,
        false,
        BN("1"),
        BN('1')
    )
    await anchorBal.deployed()

    console.log("Balancer Uniswap V3 anchor deployed: ", anchorBal.address)
    //showBodyCyan("Balancer anchor relay price: ", await toNumber(await anchorBal.currentValue()))

    anchorAave = await anchorFactory.deploy(
        14400,
        aave3k,
        false,
        BN("1"),
        BN("1")
    )
    await anchorAave.deployed()
    console.log("Aave Uniswap V3 anchor deployed: ", anchorAave.address)
    //showBodyCyan("Aave anchor relay price: ", await toNumber(await anchorAave.currentValue()))

    /**
     mainBal = await mainFactory.deploy(
        balDataFeed,
        BN("1e10"),
        BN("1")
    )
    await mainBal.deployed()
    console.log("Balancer chainlink data relay deployed: ", mainBal.address)
     */
    //showBodyCyan("Balancer chainlink data feed price: ", await toNumber(await mainBal.currentValue()))

    /**
     mainAave = await mainFactory.deploy(
        aaveDataFeed,
        BN("1e10"),
        BN("1")
    )
    await mainAave.deployed()
    console.log("Aave chainlink data relay deployed: ", mainAave.address)
     */
    //showBodyCyan("Aave chainlink data feed price: ", await toNumber(await mainAave.currentValue()))

    anchorViewBal = await anchorViewFactory.deploy(
        anchorBal.address,
        "0xe53B24294F74018D974F7e47b7d49B6dF195387F",//already deployed
        BN("25"),
        BN("100")
    )
    await anchorViewBal.deployed()
    console.log("Anchor View Balancer deployed: ", anchorViewBal.address)
    //showBodyCyan("Balancer Anchor view price: ", await toNumber(await anchorViewBal.currentValue()))

    anchorViewAave = await anchorViewFactory.deploy(
        anchorAave.address,
        "0x706d1bb99d8ed5B0c02c5e235D8E3f2a406Ad429",//already deployed
        BN("25"),
        BN("100")
    )
    await anchorViewAave.deployed()
    console.log("Anchor View Aave deployed: ", anchorViewAave.address)
    //showBodyCyan("Aave Anchor view price: ", await toNumber(await anchorViewAave.currentValue()))



}

const deploy = async (deployer: SignerWithAddress) => {

    //await deployCapTokens(deployer)
    await deployOracles(deployer)

    console.log("Cap tokens and oracles have all been deployed successfully")

    await CappedBal.setCap(BN("770000e18"))
    console.log("Set Balancer cap to: ", BN("770000e18").toString())

    await CappedAave.setCap(BN("230000e18"))
    console.log("Set Aave cap to: ", BN("230000e18").toString())

    await CappedBal.transferOwnership(govAddress)
    console.log("Transferred ownership of Capped Balancer to: ", govAddress)

    await CappedAave.transferOwnership(govAddress)
    console.log("Transferred ownership of Capped Aave to: ", govAddress)

};

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await network.provider.send("evm_setAutomine", [true])
    //await reset(15640474)


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
