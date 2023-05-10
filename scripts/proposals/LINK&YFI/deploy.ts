import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CappedGovToken, CappedGovToken__factory,
    UniswapV3TokenOracleRelay__factory, AnchoredViewRelay__factory, ChainlinkOracleRelay__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory, IOracleRelay
} from "../../../typechain-types";
import { toNumber } from "../../../util/math";
import { d } from "../DeploymentInfo";
import { showBody, showBodyCyan } from "../../../util/format";

const { ethers, network, upgrades } = require("hardhat");
const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const LINK_ADDR = "0x514910771AF9Ca656af840dff83E8264EcF986CA"
const chainlinkDataFeed_LINK = "0x2c1d072e956affc0d435cb7ac38ef18d24d9127c"
const uniPool_LINK = "0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8"//3k LINK/wETH pool
const LINK_CAP = BN("375000e18")


const YFI_ADDR = "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e"
const chainlinkDataFeed_YFI = "0xa027702dbb89fbd58938e4324ac03b58d812b0e1"
const uniPool_YFI = "0x2E8dAf55F212BE91D3fA882ccEAb193A08fddeB2"//10k YFI/wETH pool
const YFI_CAP = BN("350e18")


let CappedLINK: CappedGovToken
let CappedYFI: CappedGovToken

let anchorViewLINK: IOracleRelay
let anchorViewYFI: IOracleRelay

const deployCapTokens = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)
    //const CappedGovFactory = await ethers.getContractFactory("CappedGovToken")

    //deploy capped LINK
    const ucLINK = await new CappedGovToken__factory(deployer).deploy()

    const cLINK = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucLINK.address,
        proxy.address,
        "0x"
    )
    await cLINK.deployed()

    CappedLINK = new CappedGovToken__factory(deployer).attach(cLINK.address)
    console.log("Capped LINK deployed to: ", cLINK.address)
    const initLINK = await CappedLINK.initialize(
        "Capped LINK",
        "cLINK",
        LINK_ADDR,
        d.VaultController,
        d.VotingVaultController
    )
    await initLINK.wait()
    console.log("Capped LINK Initialized", CappedLINK.address)


    //deploy capped YFI
    const ucYFI = await new CappedGovToken__factory(deployer).deploy()

    const cYFI = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucYFI.address,
        proxy.address,
        "0x"
    )
    await cYFI.deployed()

    CappedYFI = new CappedGovToken__factory(deployer).attach(cYFI.address)
    console.log("Capped YFI deployed to: ", cYFI.address)
    const initYFI = await CappedYFI.initialize(
        "Capped YFI",
        "cYFI",
        YFI_ADDR,
        d.VaultController,
        d.VotingVaultController
    )
    await initYFI.wait()
    console.log("Capped YFI Initialized", CappedYFI.address)

}

const deployOracles = async (deployer: SignerWithAddress) => {

    //LINK ORACLES
    const clRelayLINK = await new ChainlinkOracleRelay__factory(deployer).deploy(
        chainlinkDataFeed_LINK,
        BN("1e10"),
        BN("1")
    )
    await clRelayLINK.deployed()
    //showBody("Chainlink LINK data feed price: ", await toNumber(await clRelayLINK.currentValue()))

    //uni v3 oracle 
    //const uniPool = "0xFAD57d2039C21811C8F2B5D5B65308aa99D31559"//3k LINK/USDC pool
    const uniRelayLINK = await new UniswapV3TokenOracleRelay__factory(deployer).deploy(
        14400,
        uniPool_LINK,
        false,
        BN("1"),
        BN("1")
    )
    await uniRelayLINK.deployed()
    //showBody("uni v3 LINK relay price: ", await toNumber(await uniRelay.currentValue()))


    anchorViewLINK = await new AnchoredViewRelay__factory(deployer).deploy(
        uniRelayLINK.address,
        clRelayLINK.address,
        BN("5"),
        BN("100")
    )
    await anchorViewLINK.deployed()
    showBody("LINK anchor view deployed: ", anchorViewLINK.address)
    showBodyCyan("ANCHOR VIEW LINK PRICE: ", await toNumber(await anchorViewLINK.currentValue()))


    //YFI ORACLES
    const clRelayYFI = await new ChainlinkOracleRelay__factory(deployer).deploy(
        chainlinkDataFeed_YFI,
        BN("1e10"),
        BN("1")
    )
    await clRelayYFI.deployed()
    //showBody("ChainYFI data feed price: ", await toNumber(await clRelayYFI.currentValue()))

    //uni v3 oracle
    const uniRelayYFI = await new UniswapV3TokenOracleRelay__factory(deployer).deploy(
        14400,
        uniPool_YFI,
        false,
        BN("1"),
        BN("1")
    )
    await uniRelayYFI.deployed()
    //showBody("uni v3 relay price: ", await toNumber(await uniRelayYFI.currentValue()))


    anchorViewYFI = await new AnchoredViewRelay__factory(deployer).deploy(
        uniRelayYFI.address,
        clRelayYFI.address,
        BN("5"),
        BN("100")
    )
    await anchorViewYFI.deployed()
    showBody("YFI anchor view deployed: ", anchorViewYFI.address)
    showBodyCyan("ANCHOR VIEW YFI PRICE: ", await toNumber(await anchorViewYFI.currentValue()))

}

const deploy = async (deployer: SignerWithAddress) => {


    await deployCapTokens(deployer)

    console.log("All Cap Tokens deployed")

    await deployOracles(deployer)

    console.log("All oracles have been deployed successfully")

    await CappedLINK.setCap(LINK_CAP)
    console.log("Set LINK cap to: ", await toNumber(LINK_CAP))

    await CappedYFI.setCap(YFI_CAP)
    console.log("Set YFI cap to: ", await toNumber(YFI_CAP))

};

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await network.provider.send("evm_setAutomine", [true])
    //await reset(17089428)


    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    console.log("Deployer: ", deployer.address)
    //console.log("Other adr: ", accounts[1].address)

    await deploy(deployer)

}
/**
 implementation 0xF8243ECF8f734452B184A1dF3AD3cD92fC93B58a
 proxy admin: 0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5


hh verify --network mainnet 0x5F39aD3df3eD9Cf383EeEE45218c33dA86479165 "0xF8243ECF8f734452B184A1dF3AD3cD92fC93B58a" "0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5" "0x"

hh verify --network mainnet --constructor-args ./scripts/arguments.js 0x5F39aD3df3eD9Cf383EeEE45218c33dA86479165


 */

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
/**
 todo reset proxy admin to previous bytecode match?
 */


/**
link anchor view
chainlink relay addr: 0x52F3140074cdF69C8f7151728B1ecc19af39Beea 
uni relay addr: 0xd79ef1a8632c78fab8331f7ae74ff93e60e2cdc2  

YFI anchor view
chainlink relay addr: 0x0f11ba0a10384ce496d45b1db0586b6c3ad47050 
uni relay addr: 0x5739082f906acc9967e2b23ed5a718b49580133a 


 * 
 Deployer:  0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89
Capped LINK deployed to:  0x5F39aD3df3eD9Cf383EeEE45218c33dA86479165
Capped LINK Initialized 0x5F39aD3df3eD9Cf383EeEE45218c33dA86479165
Capped YFI deployed to:  0xe2C1d2E7aA4008081CAAFc350A040246b9EBB579
Capped YFI Initialized 0xe2C1d2E7aA4008081CAAFc350A040246b9EBB579
All Cap Tokens deployed
    ↓   LINK anchor view deployed:  0x8415011818C398dC40258f699a7cb58C85953F43
    ↓   ANCHOR VIEW LINK PRICE:  7.15743192
    ↓   YFI anchor view deployed:  0x924854279824c9c05da81d3CD1fBde30Ea3C71b6
    ↓   ANCHOR VIEW YFI PRICE:  8,191.327
All oracles have been deployed successfully
Set LINK cap to:  375000
Set YFI cap to:  350
 */