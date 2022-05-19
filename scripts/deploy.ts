import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { ethers, network, upgrades } = require("hardhat");



async function sleep(milliseconds: number) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

const ropstenUSDC = "0x07865c6E87B9F70255377e024ace6630C1Eaa37F"
const USDC_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const compAddress = "0xc00e94cb662c3520282e6f5717214004a7f26888"
const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
const usdcCompPool = "0x4786bb29a1589854204a4e62dcbe26a571224c0f"
const usdcWETHpool = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"

const LiquidationIncentive = BN("5e16")
const wETH_LTV = BN("5e17")
const COMP_LTV = BN("4e17")


const deployProtocol = async (deployer:SignerWithAddress) => {
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
    
    await USDIcontract.initialize(ropstenUSDC)//CHANGE TO MAINNET IF NEEDED 
    console.log("USDI initialized: ", USDIcontract.address)

    await USDIcontract.connect(deployer).setVaultController(VCcontract.address)
    console.log("Set VaultController on USDI to: ", VCcontract.address)

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

const deployCharlie = async (deployer:SignerWithAddress) => {
    console.log("Deploying governance...")


    let txCount = await deployer.getTransactionCount()
    //console.log("tx count: "+txCount)
    const futureAddressOne = ethers.utils.getContractAddress({from:deployer.address ,nonce: txCount})
    //address one is the token delegate
    //console.log("futureAddressOne: "+futureAddressOne)
    const futureAddressTwo = ethers.utils.getContractAddress({from:deployer.address,nonce: txCount+1})
    //address two is the token delegator
    //console.log("futureAddressTwo: "+futureAddressTwo)
    const futureAddressThree = ethers.utils.getContractAddress({from:deployer.address,nonce: txCount+2})
    //address three is the gov delegate
    //console.log("futureAddressThree: "+futureAddressThree)
    const futureAddressFour = ethers.utils.getContractAddress({from:deployer.address,nonce: txCount+3})

    const ipt_ = futureAddressTwo;
    const Govimplementation_ = futureAddressThree;
    const owner_ = futureAddressFour

    let proxyAdminFactory = await ethers.getContractFactory("ProxyAdmin")
    const transparentFactory = await ethers.getContractFactory("TransparentUpgradeableProxy")

    //Proxy admin
    let proxyAdmin = await proxyAdminFactory.deploy()
    await proxyAdmin.deployed()
    console.log("proxyAdmin address: ", proxyAdmin.address)

    //VaultController implementation
    const InterestProtocolTokenDelegateFactory = await ethers.getContractFactory("InterestProtocolTokenDelegate")
    const uIPTd = await InterestProtocolTokenDelegateFactory.deploy()
    await uIPTd.deployed()
    console.log("InterestProtocolTokenDelegate implementation address: ", uIPTd.address)

    //InterestProtocolTokenDelegate proxy
    const InterestProtocolTokenDelegate = await transparentFactory.deploy(uIPTd.address, proxyAdmin.address, "0x")
    await InterestProtocolTokenDelegate.deployed()
    console.log("InterestProtocolTokenDelegate proxy address: ", InterestProtocolTokenDelegate.address)

    //attach
    const IPTdelegate = InterestProtocolTokenDelegateFactory.attach(InterestProtocolTokenDelegate.address)
    //await IPTdelegate.initialize()
    //console.log("IPT token delegate initialized: ", IPTdelegate.address)

    await sleep(3000)

    console.log("Deploying IPT...")

    const totalSupplyReceiver_ = deployer.address
    const TokenImplementation_ = IPTdelegate.address
    const totalSupply_ = BN("1e26")

    const IPTfactory = await ethers.getContractFactory("InterestProtocolToken")
    const IPT = await IPTfactory.deploy(
        totalSupplyReceiver_,
        owner_,
        TokenImplementation_,
        totalSupply_
    )
    await IPT.deployed()
    console.log("IPT deployed: ", IPT.address)
    let owner = await IPT.owner()
    console.log("IPT owner: ", owner)

    console.log("Deploying GovernorCharlieDelegator...")

    const votingPeriod_ = BN("19710")
    const votingDelay_ = BN("13140")
    const proposalThreshold_ = BN("250000000000000000000000")
    const proposalTimelockDelay_ = BN("172800")
    const quorumVotes_ = BN("50000000000000000000000000")
    const emergencyQuorumVotes_ = BN("50000000000000000000000000")
    const emergencyVotingPeriod_ = BN("6570")
    const emergencyTimelockDelay_ = BN("86400")

    const charlieFactory = await ethers.getContractFactory("GovernorCharlieDelegator")
    const charlie = await charlieFactory.deploy(
        ipt_,
        Govimplementation_,
        votingPeriod_,
        votingDelay_,
        proposalThreshold_,
        proposalTimelockDelay_,
        quorumVotes_,
        emergencyQuorumVotes_,
        emergencyVotingPeriod_,
        emergencyTimelockDelay_
    )
    await charlie.deployed()
    console.log("Charlie Deployed: ", charlie.address)
}

async function main() {

    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await network.provider.send("evm_setAutomine", [true])
    
    const accounts = await ethers.getSigners()
    const deployer = accounts[0]

    console.log("Deployer: ", deployer.address)

    await deployProtocol(deployer)
    await sleep(15000)
    await deployCharlie(deployer)

    console.log("Contracts deployed")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

