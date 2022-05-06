import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";

const { ethers, upgrades } = require("hardhat");



async function sleep(milliseconds: number) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

const USDC_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const compAddress = "0xc00e94cb662c3520282e6f5717214004a7f26888"
const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
const usdcCompPool = "0x4786bb29a1589854204a4e62dcbe26a571224c0f"
const usdcWETHpool = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"

const LiquidationIncentive = BN("5e16")
const wETH_LTV = BN("5e17")
const COMP_LTV = BN("4e17")


const deployProtocol = async () => {
    console.log("DEPLOYING CONTRACTS")


    let proxyAdminFactory = await ethers.getContractFactory("ProxyAdmin")
    const transparentFactory = await ethers.getContractFactory("TransparentUpgradeableProxy")

    //Proxy admin
    let proxyAdmin = await proxyAdminFactory.deploy()
    await proxyAdmin.deployed()
    console.log("proxyAdmin address: ", proxyAdmin.address)

    //VaultController implementation
    const VaultControllerFactory = await ethers.getContractFactory("VaultController")
    const uVC = await VaultControllerFactory.deploy()
    await uVC.deployed()
    console.log("VaultController implementation address: ", uVC.address)

    //VaultController proxy
    const VaultController = await transparentFactory.deploy(uVC.address, proxyAdmin.address, "0x")
    await VaultController.deployed()
    console.log("VaultController proxy address: ", VaultController.address)

    //attach
    const VCcontract = VaultControllerFactory.attach(VaultController.address)
    await VCcontract.initialize()
    console.log("VaultController initialized: ", VCcontract.address)

    await sleep(3000)

    //USDI implementation
    const USDIfactory = await ethers.getContractFactory("USDI")
    const uUSDI = await USDIfactory.deploy()
    await uUSDI.deployed()
    console.log("USDI implementation address: ", uUSDI.address)

    //USDI proxy
    const USDI = await transparentFactory.deploy(uUSDI.address, proxyAdmin.address, "0x")
    await USDI.deployed()
    console.log("USDI proxy address: ", USDI.address)

    //attach
    const USDIcontract = USDIfactory.attach(USDI.address)
    await USDIcontract.initialize(USDC_address)
    console.log("USDI initialized: ", USDIcontract.address)

    await sleep(3000)

    //ThreeLines implementation
    const ThreeLinesFactory = await ethers.getContractFactory("ThreeLines0_100")
    const ThreeLines = await ThreeLinesFactory.deploy(
        BN("200e16"), //r0
        BN("5e16"),   //r1
        BN("45e15"),  //r2
        BN("50e16"),  //s1
        BN("55e16"),  //s2
    )
    await ThreeLines.deployed()
    console.log("ThreeLines deployed: ", ThreeLines.address)

    await sleep(3000)

    //CURVE 
    const curveFactory = await ethers.getContractFactory("CurveMaster")
    const curve = await curveFactory.deploy()
    await curve.deployed()
    console.log("curve deployed: ", curve.address)

    await sleep(3000)


    //ORACLE THINGS
    //deploy oracleMaster
    const oracleMasterFactory = await ethers.getContractFactory("OracleMaster")
    const oracleMaster = await oracleMasterFactory.deploy()
    await oracleMaster.deployed()
    console.log("oracleMaster deployed: ", oracleMaster.address)

    //register oracleMaster
    console.log("Registering oracle master")
    await VCcontract.registerOracleMaster(oracleMaster.address)
    console.log("Registered oracle master")

    console.log("Creating uniswap comp relay")
    const UniswapRelayFactory = await ethers.getContractFactory("UniswapV3OracleRelay")
    const COMP_UniRelay = await UniswapRelayFactory.deploy(
        60, //lookback
        usdcCompPool, //pool_address
        true, //quote_token_is_token0
        BN("1e12"), //mul
        BN("1") //div
    )

    await COMP_UniRelay.deployed()
    console.log("COMP_UniRelay deployed: ", COMP_UniRelay.address)

    console.log("Creating uniswap ETH relay")
    const ETH_UniRelay = await UniswapRelayFactory.deploy(
        60, //lookback
        usdcWETHpool, //pool_address
        true, //quote_token_is_token0
        BN("1e12"), //mul
        BN("1") //div
    )
    await ETH_UniRelay.deployed()
    console.log("ETH_UniRelay deployed: ", ETH_UniRelay.address)

    console.log("Creating chainlink comp relay")
    const chainlinkCompFactory = await ethers.getContractFactory("ChainlinkOracleRelay")
    const chainlinkComp = await chainlinkCompFactory.deploy(
        "0xdbd020caef83efd542f4de03e3cf0c28a4428bd5", BN("1e10"), BN("1")
    )
    await chainlinkComp.deployed()
    console.log("chainlinkComp relay deployed: ", chainlinkComp.address)


    console.log("Creating chainlink eth relay")
    const chainlinkEthFactory = await ethers.getContractFactory("ChainlinkOracleRelay")
    const chainlinkEth = await chainlinkEthFactory.deploy(
        "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419", BN("1e10"), BN("1")
    )
    await chainlinkEth.deployed()
    console.log("chainlinkEth relay deployed: ", chainlinkEth.address)


    console.log("Creating COMP anchoredview")
    const AnchorviewCompFactory = await ethers.getContractFactory("AnchoredViewRelay")
    const AnchorviewComp = await AnchorviewCompFactory.deploy(
        COMP_UniRelay.address,
        chainlinkComp.address,
        BN("30"),
        BN("100")
    )

    await AnchorviewComp.deployed()
    console.log("AnchorviewComp relay deployed: ", AnchorviewComp.address)

    console.log("Creating ETH anchoredview")
    const AnchorviewETHFactory = await ethers.getContractFactory("AnchoredViewRelay")
    const AnchorviewETH = await AnchorviewETHFactory.deploy(
        ETH_UniRelay.address,
        chainlinkEth.address,
        BN("10"),
        BN("100")
    )

    await AnchorviewETH.deployed()
    console.log("AnchorviewETH relay deployed: ", AnchorviewETH.address)



    console.log("Setting vault oracles and CFs...")
    await oracleMaster.setRelay(
        compAddress,
        AnchorviewComp.address
    )
    console.log("set comp relay")

    await oracleMaster.setRelay(
        wethAddress,
        AnchorviewETH.address
    )
    console.log("set eth relay")

    await sleep(3000)

    console.log("Registering tokens...")
    await VCcontract.registerErc20(
        wethAddress,
        wETH_LTV,
        wethAddress,
        LiquidationIncentive
    )
    await VCcontract.registerErc20(
        compAddress,
        COMP_LTV,
        compAddress,
        LiquidationIncentive
    )

    await VCcontract.registerUSDi(USDIcontract.address)

    console.log("Tokens registered!")

    console.log("USDI protocol contracts deployed!")
}

async function main() {

    await deployProtocol()


    console.log("Deploying governance...")


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

