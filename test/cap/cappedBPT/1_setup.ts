import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { toNumber } from "../../../util/math"
import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import { IERC20, IERC20__factory, IVOTE__factory, VaultController__factory, USDI__factory, OracleMaster__factory, CurveMaster__factory, ProxyAdmin__factory, IBalancerVault__factory, VotingVaultController__factory } from "../../../typechain-types";
import { BigNumber, BytesLike } from "ethers";
import { BPT_VaultController__factory } from "../../../typechain-types/factories/lending/BPT_VaultController__factory";
//import { assert } from "console";

require("chai").should();
//*
// Initial Balances:
// Andy: 100,000,000 usdc ($100) 6dec
// Bob: 10,000,000,000,000,000,000 weth (10 weth) 18dec
// Carol: 100,000,000,000,000,000,000 (100 comp), 18dec
// Dave: 10,000,000,000 usdc ($10,000) 6dec
//
// andy is a usdc holder. he wishes to deposit USDC to hold USDI
// bob is an eth holder. He wishes to deposit his eth and borrow USDI
// carol is a comp holder. she wishes to deposit her comp and then vote
// dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob
// configurable variables
let usdc_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
let mta_minter = "0xE93381fB4c4F14bDa253907b18faD305D799241a"//huboi

const stETH_BPT_minter = "0x4d73EF089CD9B59405eb303e08B76a4e8da3a1C9"
const stETH_Gauge_minter = "0xe8343fd029561289CF7359175EE84DA121817C71"


let weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";

const mtaPool = "0xe2469f47aB58cf9CF59F9822e3C5De4950a41C49" // 80/20 MTA/WETH balancer pool BPT token
const primaryPool = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56"
const mtaPoolID = "0xe2469f47ab58cf9cf59f9822e3c5de4950a41c49000200000000000000000089"
const primaryPoolID = "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014"
const primaryPoolBPTaddr = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56"
const veBALaddr = "0xC128a9954e6c874eA3d62ce62B468bA073093F25"
const stETH_BPT = "0x32296969Ef14EB0c6d29669C550D4a0449130230"
const stETHstableGauge = "0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE"


if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(16379074)).to.not.throw;//14940917
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [false])).to.not
            .throw;
    });
});

describe("Token Setup", () => {
    it("connect to signers", async () => {
        let accounts = await ethers.getSigners();
        s.Frank = accounts[0];
        s.Eric = accounts[5];
        s.Andy = accounts[6];
        s.Bob = accounts[7];
        s.Carol = accounts[8];
        s.Dave = accounts[9];
        s.Gus = accounts[10];
    });
    it("Connect to existing contracts", async () => {

        const balVaultAddr = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
        const mtaAddr = "0xa3BeD4E1c75D00fa6f4E5E6922DB7261B5E9AcD2"

        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank)
        s.WETH = IERC20__factory.connect(s.wethAddress, s.Frank)
        s.MTA = IERC20__factory.connect(mtaAddr, s.Frank)
        s.BalancerVault = IBalancerVault__factory.connect(balVaultAddr, s.Frank)

        s.stETH_BPT = IERC20__factory.connect(stETH_BPT, s.Frank)
        s.stETH_Gauge = IERC20__factory.connect(stETHstableGauge, s.Frank)


    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Curve = CurveMaster__factory.connect(d.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)

        const vvc = "0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2"
        s.VotingVaultController = BPT_VaultController__factory.connect(vvc, s.Frank)


    })
    it("Should succesfully transfer money", async () => {

        await stealMoney(usdc_minter, s.Frank.address, s.USDC.address, s.USDC_AMOUNT)
        await stealMoney(usdc_minter, s.Bob.address, s.USDC.address, s.USDC_AMOUNT)
        await stealMoney(usdc_minter, s.Carol.address, s.USDC.address, s.USDC_AMOUNT)

        await stealMoney(weth_minter, s.Bob.address, s.WETH.address, s.WETH_AMOUNT)

        await stealMoney(mta_minter, s.Bob.address, s.MTA.address, s.MTA_AMOUNT)

        await stealMoney(stETH_BPT_minter, s.Bob.address, stETH_BPT, s.stETH_BPT_Amount)
        await stealMoney(stETH_Gauge_minter, s.Bob.address, stETHstableGauge, s.stETH_Gauge_Amount)

    })





    /**
     * steal BPT
     */





    /**
     * BPT == LP tokens received for depositing into a pool
     * 
     * gauges  == Stake BPTs to earn BAL
     * Boost up to 2.5x based on veBAL balance     
     * 
     * veBAL - voting escrow BAL - https://docs.balancer.fi/ecosystem/vebal-and-gauges/vebal/how-vebal-works
     * obtain by locking BPT from BAL/WETH 
     * lock BPT ==> receive veBAL - not transferrable 
     * 0.00877 veBAL
     * locked for 1-52 weeks
     * 
     * veBAL == gauges?
     * 
     * AUROA
     * Lock the same BPT for auraBAL which is liquid
     * exchange auraBAL == veBAL 1:1
     * Auroa supports 80/20 BAL/WETH BPT - https://docs.aura.finance/aura/what-is-aura/for-usdbal-stakers
     * is this the BPT we are going to support, or others too? 
     * 
     * 
     * 
     * PLAN
     * send BPT to special vault
     * there you can stake on gauges and earn BAL
     * need to claim? 
     * 
     * 
     * 
     */


    /**
     * BPT plan 
     * 
     * deposit BPT or staked BPT receipt token
     * these exchange 1:1 for eachother at any time, no lock
     * 
     * BPT functionality only needs a deposit/withdraw support function
     * 1 parameter, how much, uses msg.sender
     * 
     * Can't support the 'primary' BPT 80/20 BAL/WETH 0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56
     * because this one is only locked for some amount of time for veBAL
     * veBAL can't be transferred nor swapped for the BPT if locked, so liquidations won't work
     * I think
     */

    /**
     * AURA PLAN
     * 
     * TODO
     */

});