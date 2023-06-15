import { expect } from "chai";
import { ethers, network } from "hardhat";
import { stealMoney } from "../../../../../util/money";
import { showBody } from "../../../../../util/format";
import { BN } from "../../../../../util/number";
import { s } from "../scope";
import { d } from "../../DeploymentInfo";
import { reset } from "../../../../../util/block";
import {
    IERC20__factory,
    OracleMaster__factory,
    ProxyAdmin__factory,
    USDI__factory,
    VotingVaultController__factory,
    VaultController__factory,
    InterestProtocolTokenDelegate__factory,
    IVOTE,
    IVOTE__factory,
} from "../../../../../typechain-types";

require("chai").should();

// configurable variables
const bank = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(17487484)).to.not.throw;
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw;
    });
});

describe("Initial Setup - wstETH/wETH - B-stETH-STABLE-gauge", () => {
    it("connect to signers", async () => {
        s.accounts = await ethers.getSigners();
        s.Frank = s.accounts[0];
        s.Eric = s.accounts[5];
        s.Andy = s.accounts[6];
        s.Bob = s.accounts[7];
        s.Carol = s.accounts[8];
        s.Dave = s.accounts[9];
        s.Gus = s.accounts[10];
    });
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank);
        s.WETH = IERC20__factory.connect(s.wethAddress, s.Frank);

        //BAL is standard reward
        s.BAL = IVOTE__factory.connect("0xba100000625a3754423978a60c9317c58a424e3D", s.Frank)
        /**
         * BPT: 0x32296969Ef14EB0c6d29669C550D4a0449130230
         * GAUGE: 0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE
         * AURA LP: 0x32296969ef14eb0c6d29669c550d4a0449130230 - match BPT
         * Aura Gauge: 0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE - list this, matches GAUGE
         * Aura Rewards: 0xe4683Fe8F53da14cA5DAc4251EaDFb3aa614d528 - not liquid, get this after stake from vault
         */
        s.wstETH_wETH = IERC20__factory.connect("0x32296969Ef14EB0c6d29669C550D4a0449130230", s.Frank)
        s.gaugeToken = IERC20__factory.connect("0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE", s.Frank)
        s.rewardToken = IERC20__factory.connect("0x59D66C58E83A26d6a0E35114323f65c3945c89c1", s.Frank)

    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        //s.Curve = CurveMaster__factory.connect(d.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)

        s.IPT = InterestProtocolTokenDelegate__factory.connect(d.IPTDelegator, s.Frank)

        const vvc = "0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2"
        s.VotingVaultController = VotingVaultController__factory.connect(vvc, s.Frank)


    })
    it("Should succesfully transfer money", async () => {

        const tx = {
            to: s.owner._address,
            value: BN("1e18")
        }
        await s.Frank.sendTransaction(tx)

        const BPT_whale = "0x64aE36eeaC5BF9c1F4b7Cc6F0Fa32bBa19aaF9Bc"
        //steal BPTs
        await stealMoney(BPT_whale, s.Bob.address, s.wstETH_wETH.address, s.BPT_AMOUNT)
        await stealMoney(BPT_whale, s.Carol.address, s.wstETH_wETH.address, s.BPT_AMOUNT)

        await stealMoney(bank, s.Bob.address, s.USDC.address, s.Bob_USDC)
        await stealMoney(bank, s.Dave.address, s.usdcAddress, s.Dave_USDC)

    });
});
