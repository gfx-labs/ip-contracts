import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { upgrades, ethers } from "hardhat";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear, hardhat_mine } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber, getGas } from "../../../util/math"
import { stealMoney } from "../../../util/money";

import {
    AnchoredViewRelay__factory,
    BPT_WEIGHTED_ORACLE__factory,
    CappedBptToken__factory,
    IOracleRelay,
    IVault__factory,
    UniswapV3TokenOracleRelay__factory,
    VaultBPT__factory,
    WstETHRelay__factory,
    RateProofOfConcept__factory,
    IOracleRelay__factory,
    BPTstablePoolOracle__factory,
    StablePoolShowcase__factory,
    ChainlinkOracleRelay__factory,
    UniswapV3OracleRelay__factory
} from "../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";

const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"

//underlying asset oracles
let wstethRelay: IOracleRelay
let stEThMetaStablePoolOracle: IOracleRelay
let weightedPoolOracle: IOracleRelay

let auraUniOracle: IOracleRelay
let auraBalUniOracle: IOracleRelay
let auraStablePoolLPoracle: IOracleRelay
let primeBPToracle: IOracleRelay
let DOLAUniv3Oracle: IOracleRelay

let USDC_Oracle:String
let DOLA_v3Oracle:String

//Production oracles, already deployed
const BAL_TOKEN_ORACLE = "0xf5E0e2827F60580304522E2C38177DFeC7a428a4"
const wethOracle = s.wethOracleAddr
const rETH_Oracle = "0x69F3d75Fa1eaA2a46005D566Ec784FE9059bb04B"
const cbETH_Oracle = "0xae7Be6FE233bd33F9F9149050932cBa728793fdd"


//underlying asset addrs
const wstETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"
const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const rETH = "0xae78736Cd615f374D3085123A210448E74Fc6393"
const Aura = "0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF"
const BAL = "0xba100000625a3754423978a60c9317c58a424e3D"
const cbETH = "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704"
const USDC = s.usdcAddress
const DOLA = "0xc20Bc6F3BBCb9E278f097c05351C205EeC7DB01e"

describe("Deploy oracles for underlying assets", () => {

    it("Check wstETH exchange rate relay", async () => {
        wstethRelay = await new WstETHRelay__factory(s.Frank).deploy()
        await mineBlock()
        //showBody("wstETH direct conversion price: ", await toNumber(await wstethRelay.currentValue()))
    })

    it("Deploy Uni V3 oracles", async () => {
        const auraPoolAddr3k = "0x4Be410e2fF6a5F1718ADA572AFA9E8D26537242b"
        auraUniOracle = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
            500,
            auraPoolAddr3k,
            true,
            BN("1"),
            BN("1")
        )
        await auraUniOracle.deployed()
        showBodyCyan("aura uniV3 price: ", await toNumber(await auraUniOracle.currentValue()))

        const uniPool = "0xFdeA35445489e608fb4F20B6E94CCFEa8353Eabd"//3k, meh liquidity
        auraBalUniOracle = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
            500,
            uniPool,
            false,
            BN("1"),
            BN("1")
        )
        await mineBlock()
        await auraBalUniOracle.deployed()
        showBodyCyan("AuraBal uniV3 price: ", await toNumber(await auraBalUniOracle.currentValue()))


        //DOLA uni v3 oracle
        const DOLApoolAddr = "0x7c082BF85e01f9bB343dbb460A14e51F67C58cFB"//3k, bad liquidity
        const DOLA_oracle = await new UniswapV3OracleRelay__factory(s.Frank).deploy(
            14400,
            DOLApoolAddr,
            false,
            BN("1e12"),
            BN("1")
        )
        await DOLA_oracle.deployed()
        DOLA_v3Oracle = DOLA_oracle.address.toString()
        showBody("DOLA_v3Oracle: ", DOLA_v3Oracle)
        //showBody("DOLA uni v3 price: ", await toNumber(await DOLA_oracle.currentValue()))


    })

    it("Deploy chainlink oracles", async () => {
        const dataFeed = "0x8fffffd4afb6115b954bd326cbe7b4ba576818f6"
        const usdcOracle = await new ChainlinkOracleRelay__factory(s.Frank).deploy(
            dataFeed,
            BN("1e10"),
            BN("1")
        )
        await usdcOracle.deployed()
        USDC_Oracle = usdcOracle.address.toString()
        showBody("USDC_Oracle: ", USDC_Oracle)

        //showBody("USDC price: ", await toNumber(await usdcOracle.currentValue()))
    })
})


describe("Deploy and test StablePoolShowcase", () => {
    //StablePool BPT addresses
    const auraBalPrimeBPTSP = "0x3dd0843a028c86e0b760b1a76929d1c5ef93a2dd"
    const USDC_DOLA_SP = "0xFf4ce5AAAb5a627bf82f4A571AB1cE94Aa365eA6"

    //MetaStablePool BPT addresses
    const wstethWethMSP = "0x32296969Ef14EB0c6d29669C550D4a0449130230"
    const cbETHwstETHMSP = "0x9c6d47Ff73e0F5E51BE5FD53236e3F595C5793F2"

    //WeightedPool BPT addresses
    const primeBPT = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56"
    const rETH_WETH_BPT = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"
    const wethAuraBPT = "0xCfCA23cA9CA720B6E98E3Eb9B6aa0fFC4a5C08B9" //weth / aura 50/50



    it("wstEth/wETH MetaStablePool", async () => {
        const showcaseOracle = await new StablePoolShowcase__factory(s.Frank).deploy(
            wstethWethMSP,
            balancerVault,
            [wstETH, weth],
            [wstethRelay.address, wethOracle],
            BN("20"),
            BN("10000")
        )
        await showcaseOracle.deployed()
        showBodyCyan("stETh MetaStablePool BPT price: ", await toNumber(await (await showcaseOracle.currentValue())))
    })

    it("rETH/wETH MetaStablePool", async () => {
        const showcaseOracle = await new StablePoolShowcase__factory(s.Frank).deploy(
            rETH_WETH_BPT, //pool_address
            balancerVault, //balancer vault
            [rETH, weth], //_tokens
            [rETH_Oracle, wethOracle], //_oracles, weth oracle
            BN("150"),
            BN("10000")
        )
        await showcaseOracle.deployed()
        showBodyCyan("stETh MetaStablePool BPT price: ", await toNumber(await (await showcaseOracle.currentValue())))
    })

    it("cbETH/wstETH MetaStablePool", async () => {
        const showcaseOracle = await new StablePoolShowcase__factory(s.Frank).deploy(
            cbETHwstETHMSP,
            balancerVault, //balancer vault
            [cbETH, wstETH],
            [cbETH_Oracle, wstethRelay.address],
            BN("230"),
            BN("10000")
        )
        await showcaseOracle.deployed()
        showBodyCyan("cbETH wstETH MetaStablePool price: ", await toNumber(await showcaseOracle.currentValue()))

    })

    it("bath-80 StablePool", async () => {

        //need to set up a weighted pool oracle to price the underlying BPT
        primeBPToracle = await new BPT_WEIGHTED_ORACLE__factory(s.Frank).deploy(
            primeBPT,
            balancerVault, //balancer vault
            [s.BAL.address, s.wethAddress],
            [BAL_TOKEN_ORACLE, wethOracle],
            BN("1"),
            BN("100")
        )
        await primeBPToracle.deployed()
        //showBody("Prime BPT oracle price: ", await toNumber(await primeBPToracle.currentValue()))

        const showcaseOracle = await new StablePoolShowcase__factory(s.Frank).deploy(
            auraBalPrimeBPTSP,
            balancerVault, //balancer vault
            [primeBPT, s.auraBal.address],//prime BPT / auraBal
            [primeBPToracle.address, auraBalUniOracle.address],//prime BPT oracle / auraBal oracle
            BN("230"),
            BN("10000")
        )
        await showcaseOracle.deployed()
        showBodyCyan("Balancer auraBal StablePool price: ", await toNumber(await showcaseOracle.currentValue()))

    })

    it("DOLA/USDC StablePool", async () => {
        
         const showcaseOracle = await new StablePoolShowcase__factory(s.Frank).deploy(
            USDC_DOLA_SP,
            balancerVault, 
            [DOLA, USDC],
            [DOLA_v3Oracle, USDC_Oracle],
            BN("230"),
            BN("10000")
        )
        await showcaseOracle.deployed()
        showBody("Deployed")
        showBodyCyan("USDC DOLA StablePool price: ", await toNumber(await showcaseOracle.currentValue()))

        
    })

})