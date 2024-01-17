import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { ethers, network } from "hardhat";
import { BN } from "../../../util/number";
import { currentBlock, mineBlock, reset, resetCurrent } from "../../../util/block";
import { expect } from "chai";

import { IERC20__factory, VaultController__factory, USDI__factory, OracleMaster__factory, ProxyAdmin__factory, IBalancerVault__factory, VotingVaultController__factory, IGauge__factory, IOracleRelay__factory, WstETHRelay__factory, BPTstablePoolOracle__factory, StablePoolShowcase__factory, IOracleRelay, StablePoolShowcase, UniswapV3TokenOracleRelay__factory, BPT_WEIGHTED_ORACLE__factory, ChainlinkOracleRelay__factory, UniswapV3OracleRelay__factory, BPTstablePoolOracle } from "../../../typechain-types";
import { showBody, showBodyCyan } from "../../../util/format";
import { toNumber } from "../../../util/math";
import { MainnetBPTaddresses, a } from "../../../util/addresser";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { pool } from "../../../typechain-types/contracts/_external/uniswap";

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

let oracle: BPTstablePoolOracle
let testOracle: BPTstablePoolOracle

describe("Setup", () => {
    it("Set hardhat network to a block after deployment", async () => {
        await resetCurrent()
        //await reset(18486413)//last block current deploy is working
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
    it("Connect to oracle", async () => {
        const addrs = new MainnetBPTaddresses()
        oracle = BPTstablePoolOracle__factory.connect(addrs.B_stETH_STABLEPOOL_ORACLE, s.Frank)
    })

})

describe("Deploy and test oracles for underlying assets", () => {

    let poolAddress: string
    let balancerVault: string
    let tokens: string[] = [a.wstethAddress, a.wethAddress]
    let oracles: string[]
    let num: BigNumber
    let den: BigNumber

    let testNum: BigNumber
    let destDenom: BigNumber

    it("get deployment data", async () => {
        poolAddress = await oracle._priceFeed()
        balancerVault = await oracle.VAULT()
        oracles = [await oracle.assetOracles(tokens[0]), await oracle.assetOracles(tokens[1])]
        num = await oracle._widthNumerator()
        den = await oracle._widthDenominator()


        /**
        console.log(poolAddress)
        console.log(balancerVault)
        console.log(tokens)
        console.log(oracles)
        console.log(num)
        console.log(den)
         */

    })

    it("Verify values", async () => {
        const wstethOracle = IOracleRelay__factory.connect(oracles[0], s.Frank)
        const ethOracle = IOracleRelay__factory.connect(oracles[1], s.Frank)
        showBody("wsteth price: ", await toNumber(await wstethOracle.currentValue()))
        showBody("eth price: ", await toNumber(await ethOracle.currentValue()))

        //get liquidity
        const vault = IBalancerVault__factory.connect(balancerVault, s.Frank)
        
        const poolTokens = await vault.getPoolTokens("0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080")
        showBody("Balances 0: ", await toNumber(poolTokens.balances[0]))
        showBody("Balances 1: ", await toNumber(poolTokens.balances[1]))


    })

    it("Deploy testing duplicate", async () => {
        testOracle = await new BPTstablePoolOracle__factory(s.Frank).deploy(
            poolAddress,
            balancerVault,
            tokens,
            oracles,
            num,
            den
        )
        await testOracle.deployed()

        showBodyCyan("PRICE: ", await toNumber(await testOracle.currentValue()))
    })
})

