import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { toNumber } from "../../../util/math"
import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import { IERC20, IERC20__factory, IVOTE__factory, VaultController__factory, USDI__factory, OracleMaster__factory, CurveMaster__factory, ProxyAdmin__factory, IBalancerVault__factory, VotingVaultController__factory, IGauge__factory, IOracleRelay__factory } from "../../../typechain-types";
import { BigNumber, BytesLike } from "ethers";
import { BPT_VaultController__factory } from "../../../typechain-types/factories/lending/BPT_VaultController__factory";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
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

const auraLPminter = "0x3004E7d0bA11BcD506349F1062eA57f7037F0BBd"
const auraLPrewardsMinter = "0xBB19053E031D9B2B364351B21a8ed3568b21399b"


let weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";

const mtaPool = "0xe2469f47aB58cf9CF59F9822e3C5De4950a41C49" // 80/20 MTA/WETH balancer pool BPT token
const primaryPool = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56"
const mtaPoolID = "0xe2469f47ab58cf9cf59f9822e3c5de4950a41c49000200000000000000000089"
const primaryPoolID = "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014"
const primaryPoolBPTaddr = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56"
const stETH_BPT = "0x32296969Ef14EB0c6d29669C550D4a0449130230"
const stETHstableGauge = "0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE" //B-stETH-STABLE-gauge
//aura voter proxy 0xaF52695E1bB01A16D33D7194C28C42b10e0Dbec2


if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(16579084)).to.not.throw;//16579684, 14940917
    });
    it("set automine", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
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
        s.stETH_Gauge = IGauge__factory.connect(stETHstableGauge, s.Frank)

        s.wethOracle = IOracleRelay__factory.connect(s.wethOracleAddr, s.Frank)

        s.BAL = IERC20__factory.connect("0xba100000625a3754423978a60c9317c58a424e3D", s.Frank)
        s.auraBal = IERC20__factory.connect("0x616e8BfA43F920657B3497DBf40D6b1A02D4608d", s.Frank)
        s.auraBalRewards = IERC20__factory.connect("0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2", s.Frank)

        //'prime' BPT / auraBal LP token 0x3dd0843a028c86e0b760b1a76929d1c5ef93a2dd
        s.primeAuraBalLP = IERC20__factory.connect("0x3dd0843a028c86e0b760b1a76929d1c5ef93a2dd", s.Frank)//B-auraBAL-STABLE
        s.primeAuraBalRewardToken = IERC20__factory.connect("0xacada51c320947e7ed1a0d0f6b939b0ff465e4c2", s.Frank)//auraB-auraBAL-STABLE-vaul

    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Curve = CurveMaster__factory.connect(d.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)

        const vvc = "0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2"
        s.VotingVaultController = VotingVaultController__factory.connect(vvc, s.Frank)


    })
    it("Should succesfully transfer money", async () => {

        await stealMoney(usdc_minter, s.Frank.address, s.USDC.address, s.USDC_AMOUNT)
        await stealMoney(usdc_minter, s.Bob.address, s.USDC.address, s.USDC_AMOUNT.mul(10))
        await stealMoney(usdc_minter, s.Carol.address, s.USDC.address, s.USDC_AMOUNT)
        await stealMoney(usdc_minter, s.Dave.address, s.USDC.address, s.USDC_AMOUNT.mul(5))

        await stealMoney(weth_minter, s.Bob.address, s.WETH.address, s.WETH_AMOUNT)

        await stealMoney(mta_minter, s.Bob.address, s.MTA.address, s.MTA_AMOUNT)

        await stealMoney(stETH_BPT_minter, s.Bob.address, stETH_BPT, s.stETH_BPT_Amount)
        await stealMoney(stETH_Gauge_minter, s.Bob.address, stETHstableGauge, s.stETH_Gauge_Amount)

        //steal auraBal
        const auraBalWhale = "0x0BE2340d942e79DFeF172392429855DE8A4f5b14"
        await stealMoney(auraBalWhale, s.Bob.address, s.auraBal.address, s.AuraBalAmount)

        await stealMoney(auraLPminter, s.Bob.address, s.primeAuraBalLP.address, s.AuraLPamount)
    })


});