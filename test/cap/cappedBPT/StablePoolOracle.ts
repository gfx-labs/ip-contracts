import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { ethers, network } from "hardhat";
import { BN } from "../../../util/number";
import { currentBlock, mineBlock, resetCurrent } from "../../../util/block";
import { expect } from "chai";

import { IERC20__factory, VaultController__factory, USDI__factory, OracleMaster__factory, ProxyAdmin__factory, IBalancerVault__factory, VotingVaultController__factory, IGauge__factory, IOracleRelay__factory, WstETHRelay__factory, BPTstablePoolOracle__factory, StablePoolShowcase__factory, IOracleRelay, StablePoolShowcase, UniswapV3TokenOracleRelay__factory, BPT_WEIGHTED_ORACLE__factory, ChainlinkOracleRelay__factory, UniswapV3OracleRelay__factory } from "../../../typechain-types";
import { showBody, showBodyCyan } from "../../../util/format";
import { toNumber } from "../../../util/math";

/******************************************
 * These standalone tests are meant to be a simple test for the 
 * outGivenIn oracle given current market conditions
 * 
 * These tests reset to the current block on eth mainnet
 *
 */

//CONFIGURE THIS
//deltaBips is in BIPs
//1 BIP is 0.01% or 0.0001
//2% deltaBips == 200
const deltaBips = 200


describe("Setup", () => {
    it("Set hardhat network to a block after deployment", async () => {
        await resetCurrent()
        const block = await currentBlock()
        showBody("Testing as of block: ", block.number)
    })
    it("set automine", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw;
    })
    it("connect to signers", async () => {
        let accounts = await ethers.getSigners();
        s.Frank = accounts[0]
    })
})

describe("Deploy and test oracles for underlying assets", () => {

    const wethOracleAddr = "0x65dA327b1740D00fF7B366a4fd8F33830a2f03A2"
    const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"

    before(async () => {
        //if accuracy goes over this, it will revert
        showBodyCyan("Buffer: ", await toNumber(BN(deltaBips).mul(BN("1e16"))), "%")
    })

    it("Deploy and check B_stETH_STABLE MetaStablePool oracle", async () => {

        //deploy wstethRelay
        const wstethRelay = await new WstETHRelay__factory(s.Frank).deploy()


        const wstETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"
        const B_stETH_STABLE = "0x32296969Ef14EB0c6d29669C550D4a0449130230"

        //wstETH/weth MetaStable pool
        const stEThMetaStablePoolOracle = await new StablePoolShowcase__factory(s.Frank).deploy(
            B_stETH_STABLE, //pool_address
            balancerVault,
            [wstETH, s.wethAddress], //_tokens
            [wstethRelay.address, wethOracleAddr], //_oracles
            BN(deltaBips),
            BN("10000")
        )
        await stEThMetaStablePoolOracle.deployed()
        let [naivePrice, expectedRate, calcedRate] = await stEThMetaStablePoolOracle.currentValue()
        const delta = await stEThMetaStablePoolOracle.percentChange(expectedRate, calcedRate)
        showBody("stETh MetaStablePool BPT price: ", await toNumber(naivePrice))
        showBody("Accuracy: ", await toNumber(delta) * 100, "%")

    })

    it("Deploy and check B_rETH_STABLE MetaStablePool oracle", async () => {
        const rETH_WETH_BPT = "0x1E19CF2D73a72Ef1332C882F20534B6519Be0276"
        const rETH = "0xae78736Cd615f374D3085123A210448E74Fc6393"
        const rETH_Oracle = "0x69F3d75Fa1eaA2a46005D566Ec784FE9059bb04B"

        const rEthMetaStablePoolOracle = await new StablePoolShowcase__factory(s.Frank).deploy(
            rETH_WETH_BPT, //pool_address
            balancerVault, //balancer vault
            [rETH, s.wethAddress], //_tokens
            [rETH_Oracle, wethOracleAddr], //_oracles
            BN(deltaBips),
            BN("10000")
        )
        let [naivePrice, expectedRate, calcedRate] = await rEthMetaStablePoolOracle.currentValue()
        const delta = await rEthMetaStablePoolOracle.percentChange(expectedRate, calcedRate)

        showBody("rETH MetaStablePool BPT price: ", await toNumber(naivePrice))
        showBody("Accuracy: ", await toNumber(delta) * 100, "%")
    })

    it("Deploy and check B_rETH_STABLE StablePool oracle", async () => {
        const primeBPT = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56"
        const primeAuraLP = "0x3dd0843a028c86e0b760b1a76929d1c5ef93a2dd"
        const uniPool = "0xFdeA35445489e608fb4F20B6E94CCFEa8353Eabd"//3k, meh liquidity
        const BAL_TOKEN_ORACLE = "0xf5E0e2827F60580304522E2C38177DFeC7a428a4"
        const BAL = "0xba100000625a3754423978a60c9317c58a424e3D"
        const auraBal = "0x616e8BfA43F920657B3497DBf40D6b1A02D4608d"
        const auraUniOracle = await new UniswapV3TokenOracleRelay__factory(s.Frank).deploy(
            500,
            uniPool,
            false,
            BN("1"),
            BN("1")
        )
        await auraUniOracle.deployed()

        //showBodyCyan("AuraBal uni relay price: ", await toNumber(await auraUniOracle.currentValue()))


        const primeBPToracle = await new BPT_WEIGHTED_ORACLE__factory(s.Frank).deploy(
            primeBPT,
            balancerVault, //balancer vault
            [BAL, s.wethAddress],
            [BAL_TOKEN_ORACLE, s.wethOracleAddr],
            BN("10"),
            BN("100")
        )
        await primeBPToracle.deployed()

        const auraStablePoolLPoracle = await new StablePoolShowcase__factory(s.Frank).deploy(
            primeAuraLP,
            balancerVault, //balancer vault
            [primeBPT, auraBal],//prime BPT / auraBal
            [primeBPToracle.address, auraUniOracle.address],//prime BPT oracle / auraBal oracle
            BN(deltaBips),
            BN("10000")
        )

        let [naivePrice, expectedRate, calcedRate] = await auraStablePoolLPoracle.currentValue()
        const delta = await auraStablePoolLPoracle.percentChange(expectedRate, calcedRate)

        showBody("auraBalLP StablePool BPT price: ", await toNumber(naivePrice))
        showBody("Accuracy: ", await toNumber(delta) * 100, "%")
    })

    /**
    it("Deploy and check DOLA StablePool", async () => {

        const LP = "0xFf4ce5AAAb5a627bf82f4A571AB1cE94Aa365eA6"
        const DOLA = "0x865377367054516e17014CcdED1e7d814EDC9ce4"

        const clDataFeedUSDC = "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"
        const uniPool = "0x7c082BF85e01f9bB343dbb460A14e51F67C58cFB"

        const usdcOracle = await new ChainlinkOracleRelay__factory(s.Frank).deploy(
            clDataFeedUSDC,
            BN("1e10"),
            BN("1")
        )
        showBody("USDC: ", await toNumber(await usdcOracle.currentValue()))

        const dolOracle = await new UniswapV3OracleRelay__factory(s.Frank).deploy(
            500,
            uniPool,
            false,
            BN("1e12"),
            BN("1")
        )
        showBody("DOL : ", await toNumber(await dolOracle.currentValue()))

        const dolaStablePoolOracle = await new StablePoolShowcase__factory(s.Frank).deploy(
            LP,
            balancerVault,
            [DOLA, s.usdcAddress],
            [dolOracle.address, usdcOracle.address],
            BN(deltaBips),
            BN("200")
        )

        let [naivePrice, expectedRate, calcedRate] = await dolaStablePoolOracle.currentValue()
        const delta = await dolaStablePoolOracle.percentChange(expectedRate, calcedRate)

        showBody("dola StablePool BPT price: ", await toNumber(naivePrice))
        showBody("Accuracy: ", await toNumber(delta) * 100, "%")

    })
     */
})

