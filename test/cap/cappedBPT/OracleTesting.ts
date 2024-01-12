import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { ethers, network } from "hardhat";
import { BN } from "../../../util/number";
import { currentBlock, mineBlock, reset } from "../../../util/block";
import { expect } from "chai";

import { IERC20__factory, VaultController__factory, USDI__factory, OracleMaster__factory, ProxyAdmin__factory, IBalancerVault__factory, VotingVaultController__factory, IGauge__factory, IOracleRelay__factory, WstETHRelay__factory, BPTstablePoolOracle__factory, StablePoolShowcase__factory, IOracleRelay, StablePoolShowcase, UniswapV3TokenOracleRelay__factory, BPT_WEIGHTED_ORACLE__factory, ChainlinkOracleRelay__factory, UniswapV3OracleRelay__factory, BPTstablePoolOracle } from "../../../typechain-types";
import { showBody, showBodyCyan } from "../../../util/format";
import { toNumber } from "../../../util/math";
import { MainnetBPTaddresses } from "../../../util/addresser";

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


describe("Setup", () => {
    it("Set hardhat network to a block after deployment", async () => {
        await reset(18486191)
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

    it("Get live feed", async () => {
        showBodyCyan(await toNumber(await oracle.currentValue()))
    })
})

