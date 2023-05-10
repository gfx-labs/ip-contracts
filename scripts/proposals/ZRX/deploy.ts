import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CappedGovToken, CappedGovToken__factory,
    UniswapV3TokenOracleRelay__factory,
    UniswapV3TokenOracleRelay,
    AnchoredViewRelay,
    AnchoredViewRelay__factory, VaultController__factory, ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory, ChainlinkTokenOracleRelay__factory, BalancerPeggedAssetRelay__factory
} from "../../../typechain-types";
import { toNumber } from "../../../util/math";
import { d } from "../DeploymentInfo";
import { showBodyCyan } from "../../../util/format";

const { ethers, network, upgrades } = require("hardhat");
const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const ZRX_ADDR = "0xE41d2489571d322189246DaFA5ebDe1F4699F498"
const ZRX_CAP = BN("1000000e18")

const chainLinkZRX = "0x2da4983a622a8498bb1a21fae9d8f6c664939962"
const ZRXuniPool = "0x14424eEeCbfF345B38187d0B8b749E56FAA68539"
let CappedZRX: CappedGovToken

let anchorZRX: UniswapV3TokenOracleRelay
let mainZRX: ChainlinkOracleRelay
let anchorViewZRX: AnchoredViewRelay

const deployCapTokens = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)
    //const CappedGovFactory = await ethers.getContractFactory("CappedGovToken")

    //deploy capped ZRX
    const ucZRX = await new CappedGovToken__factory(deployer).deploy()

    const cZRX = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucZRX.address,
        proxy.address,
        "0x"
    )
    await cZRX.deployed()

    CappedZRX = new CappedGovToken__factory(deployer).attach(cZRX.address)
    console.log("Capped ZRX deployed to: ", cZRX.address)
    const initZRX = await CappedZRX.initialize(
        "Capped ZRX",
        "cZRX",
        ZRX_ADDR,
        d.VaultController,
        d.VotingVaultController
    )
    await initZRX.wait()
    console.log("Capped ZRX Initialized", CappedZRX.address)



}

const deployOracles = async (deployer: SignerWithAddress) => {
    let peggedBalancerFactory = new BalancerPeggedAssetRelay__factory(deployer)
    let UniV3Factory = new UniswapV3TokenOracleRelay__factory(deployer)
    let chainlinkFactory = new ChainlinkOracleRelay__factory(deployer)
    let mainTokenFactory = new ChainlinkTokenOracleRelay__factory(deployer)
    let anchorViewFactory = new AnchoredViewRelay__factory(deployer)



    anchorZRX = await UniV3Factory.deploy(
        14400,
        ZRXuniPool,
        true,
        BN("1"),
        BN("1")
    )
    await anchorZRX.deployed()
    console.log("ZRX anchor deployed: ", anchorZRX.address)
    showBodyCyan("ZRX anchor relay price: ", await toNumber(await anchorZRX.currentValue()))

    mainZRX = await mainTokenFactory.deploy(
        chainLinkZRX,
        BN("1"),
        BN("1")
    )
    await mainZRX.deployed()
    console.log("ZRX Main relay deployed: ", mainZRX.address)
    showBodyCyan("ZRX Main relay price: ", await toNumber(await mainZRX.currentValue()))


    anchorViewZRX = await anchorViewFactory.deploy(
        anchorZRX.address, //Balancer pegged
        mainZRX.address, //Uni V3
        BN("20"),
        BN("100")
    )

    await anchorViewZRX.deployed()
    console.log("ZRX anchor view deployed: ", anchorViewZRX.address)
    showBodyCyan("ZRX anchor view price: ", await toNumber(await anchorViewZRX.currentValue()))




}

const deploy = async (deployer: SignerWithAddress) => {

    //deploy new implementation
    const implementation = await new VaultController__factory(deployer).deploy()

    console.log("New VC implementation deployed to: ", implementation.address)

    await deployCapTokens(deployer)

    console.log("All Cap Tokens deployed")

    await deployOracles(deployer)

    console.log("All oracles have been deployed successfully")

    await CappedZRX.setCap(ZRX_CAP)
    console.log("Set ZRX cap to: ", await toNumber(ZRX_CAP))



};

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await network.provider.send("evm_setAutomine", [true])
    //await reset(16486122)


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
hh verify --network mainnet 0xB9cb624D4b21E0239bB149B1B1F1992A0eB351b8
 * 
 * OUTPUT 
New VC implementation deployed to:  0x9BDb5575E24EEb2DCA7Ba6CE367d609Bdeb38246
Capped ZRX deployed to:  0xDf623240ec300fD9e2B7780B34dC2F417c0Ab6D2
Capped ZRX Initialized 0xDf623240ec300fD9e2B7780B34dC2F417c0Ab6D2
All Cap Tokens deployed
ZRX anchor deployed:  0xCfae22EAD912F7F8299113915bEC0c92F98Cd4a7
    ↓   ZRX anchor relay price:  0.219269449809822
ZRX Main relay deployed:  0x8cd06C41617B0882A2a5D1334BdE48664fD89b5A
    ↓   ZRX Main relay price:  0.2203965700776926
ZRX anchor view deployed:  0xEF12fa3183362506A2dd0ff1CF06b2f4156e751E
    ↓   ZRX anchor view price:  0.2203965700776926
All oracles have been deployed successfully
Set ZRX cap to:  1000000
 */