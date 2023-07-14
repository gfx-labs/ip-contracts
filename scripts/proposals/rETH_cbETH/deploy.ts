import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CappedGovToken, UniswapV3TokenOracleRelay__factory,
    UniswapV3TokenOracleRelay,
    AnchoredViewRelay,
    AnchoredViewRelay__factory, ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory, BalancerPeggedAssetRelay,
    BalancerPeggedAssetRelay__factory
} from "../../../typechain-types";
import { toNumber } from "../../../util/math";
import { a, c, d } from "../../../util/addresser"
import { showBodyCyan } from "../../../util/format";
import { reset } from "../../../util/block";

const { ethers, network, upgrades } = require("hardhat");
const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"



const rEthPegProvider = "0x1a8F81c256aee9C640e14bB0453ce247ea0DFE6F"
const rEthBalancerPool = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"
const rEthUniPool = "0xa4e0faA58465A2D369aa21B3e42d43374c6F9613"
const rETHaddress = "0xae78736Cd615f374D3085123A210448E74Fc6393"

const chainlinkCBETHfeed = "0x67eF3CAF8BeB93149F48e8d20920BEC9b4320510"
const CBETH_POOL = "0x840DEEef2f115Cf50DA625F7368C24af6fE74410"
const cbEthAddress = "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704"

const rEth_CAP = BN("3000e18")
const cbETH_CAP = BN("4200e18")


let anchorCBETH: UniswapV3TokenOracleRelay
let mainCBETH: ChainlinkOracleRelay
let anchorViewCBETH: AnchoredViewRelay

let anchorRETH: BalancerPeggedAssetRelay
let mainRETH: UniswapV3TokenOracleRelay
let anchorViewRETH: AnchoredViewRelay

let CappedCBETH: CappedGovToken
let CappedRETH: CappedGovToken

const deployCapTokens = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)
    const CappedGovFactory = await ethers.getContractFactory("CappedGovToken")

    //deploy capped rETH
    const ucrETH = await CappedGovFactory.deploy()
    
    const crETH = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucrETH.address,
        proxy.address,
        "0x"
    )
    await crETH.deployed()

    CappedRETH = CappedGovFactory.attach(crETH.address)
    console.log("Capped rETH deployed to: ", crETH.address)
    const initrETH = await CappedRETH.initialize(
        "Capped rETH",
        "crETH",
        rETHaddress,
        d.VaultController,
        d.VotingVaultController
    )
    await initrETH.wait()
    console.log("Capped rETH Initialized", CappedRETH.address)

    //deploy capped cbETH
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
    let peggedBalancerFactory = new BalancerPeggedAssetRelay__factory(deployer)
    let UniV3Factory = new UniswapV3TokenOracleRelay__factory(deployer)
    let chainlinkFactory = new ChainlinkOracleRelay__factory(deployer)
    //let mainTokenFactory = new ChainlinkTokenOracleRelay__factory(deployer)
    let anchorViewFactory = new AnchoredViewRelay__factory(deployer)



    anchorRETH = await peggedBalancerFactory.deploy(
        14400,
        rEthBalancerPool,
        rEthPegProvider,
        BN("1"),
        BN("1")
    )
    await anchorRETH.deployed()
    console.log("rETH Balancer Pegged anchor deployed: ", anchorRETH.address)
    showBodyCyan("rETH Balancer Pegged relay price: ", await toNumber(await anchorRETH.currentValue()))

    mainRETH = await UniV3Factory.deploy(
        14400,
        rEthUniPool,
        false,
        BN("1"),
        BN('1')
    )
    await mainRETH.deployed()
    console.log("rETH Uniswap V3 anchor deployed: ", mainRETH.address)
    showBodyCyan("rETH Uni V3 relay price: ", await toNumber(await mainRETH.currentValue()))


    anchorViewRETH = await anchorViewFactory.deploy(
        anchorRETH.address, //Balancer pegged
        mainRETH.address, //Uni V3
        BN("10"),
        BN("100")
    )

    await anchorViewRETH.deployed()
    console.log("rETH anchor view deployed: ", anchorViewRETH.address)
    showBodyCyan("rETH anchor view price: ", await toNumber(await anchorViewRETH.currentValue()))

    anchorCBETH = await UniV3Factory.deploy(
        14400,
        CBETH_POOL,
        false,
        BN("1"),
        BN('1')
    )
    await anchorCBETH.deployed()

    console.log("cbETH Uniswap V3 anchor deployed: ", anchorCBETH.address)
    showBodyCyan("cbETH anchor relay price: ", await toNumber(await anchorCBETH.currentValue()))


    mainCBETH = await chainlinkFactory.deploy(
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

    await CappedRETH.setCap(rEth_CAP)
    console.log("Set rETH cap to: ", await toNumber(rEth_CAP))

    await CappedCBETH.setCap(cbETH_CAP)
    console.log("Set cbETH cap to: ", await toNumber(cbETH_CAP))

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