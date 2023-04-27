import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../../../util/money";
import { showBody } from "../../../../../util/format";
import { BN } from "../../../../../util/number";
import { toNumber } from "../../../../../util/math";
import { s } from "../scope";
import { d } from "../../DeploymentInfo";
import { advanceBlockHeight, reset, mineBlock } from "../../../../../util/block";
import {
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    CurveMaster,
    CurveMaster__factory,
    IERC20,
    IERC20__factory,
    IOracleRelay,
    OracleMaster,
    OracleMaster__factory,
    ProxyAdmin,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    ThreeLines0_100,
    ThreeLines0_100__factory,
    CappedGovToken__factory,
    USDI,
    USDI__factory,
    Vault,
    VotingVaultController__factory,
    VaultController__factory,
    InterestProtocolTokenDelegate__factory,
    IVOTE,
    IVOTE__factory,
} from "../../../../../typechain-types";

require("chai").should();

// configurable variables
const weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
const bank = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
const LINK_WHALE = "0x0757e27AC1631beEB37eeD3270cc6301dD3D57D4"

if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(16525759)).to.not.throw;
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

        s.AuraBal = IERC20__factory.connect("0x616e8BfA43F920657B3497DBf40D6b1A02D4608d", s.Frank)
        //s.gaugeToken = IERC20__factory.connect("0xcD4722B7c24C29e0413BDCd9e51404B4539D14aE", s.Frank)
        s.rewardToken = IERC20__factory.connect("0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2", s.Frank)

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

        //const auraBal_whale = "0xc02A0fFc3a2B142954848f3605B341c42d1D58f4"
        const auraBal_whale = "0x11b82a90b3Ba3ae5C7D430980cA10e8cE208c1c3"

        showBody("Whale blance: ", await toNumber(await s.AuraBal.balanceOf(auraBal_whale)))
        //steal BPTs
        await stealMoney(auraBal_whale, s.Bob.address, s.AuraBal.address, s.BPT_AMOUNT)
        await stealMoney(auraBal_whale, s.Carol.address, s.AuraBal.address, s.BPT_AMOUNT)

        await stealMoney(bank, s.Bob.address, s.USDC.address, s.Bob_USDC)
        await stealMoney(bank, s.Dave.address, s.usdcAddress, s.Dave_USDC)

    });
});
