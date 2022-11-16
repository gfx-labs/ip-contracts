import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import {
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
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
    UniswapV3OracleRelay__factory,
    USDI,
    USDI__factory,
    Vault,
    VotingVaultController__factory,
    VaultController__factory,
    InterestProtocolTokenDelegate__factory,
    IVOTE,
    IVOTE__factory,
} from "../../../typechain-types";

require("chai").should();

// configurable variables
const weth_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";
const bank = "0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2"


if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(15978439)).to.not.throw;//15978276
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [false])).to.not
            .throw;
    });
});

describe("Initial Setup - Bal and Aave", () => {
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
    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Curve = CurveMaster__factory.connect(d.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)

        s.IPT = InterestProtocolTokenDelegate__factory.connect(d.IPTDelegator, s.Frank)

        const vvc = "0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2"
        s.VotingVaultController = VotingVaultController__factory.connect(vvc, s.Frank)

        s.rETH = IVOTE__factory.connect("0xae78736Cd615f374D3085123A210448E74Fc6393", s.Frank)


    })
    it("Should succesfully transfer money", async () => {
        /**
         //showBody(`stealing ${s.Bob_WETH} weth to bob from ${s.wethAddress}`);
        await expect(
            stealMoney(weth_minter, s.Bob.address, s.wethAddress, s.Bob_WETH)
        ).to.not.be.reverted;

        //for some reason at this block, account 1 has 1 USDC, need to burn so all accounts are equal
        await s.USDC.connect(s.accounts[1]).transfer(bank, await s.USDC.balanceOf(s.accounts[1].address))
        await mineBlock()

        for (let i = 0; i < s.accounts.length; i++) {
            await expect(
                stealMoney(bank, s.accounts[i].address, s.USDC.address, s.USDC_AMOUNT)
            ).to.not.be.reverted;
            await mineBlock()
            expect(await s.USDC.balanceOf(s.accounts[i].address)).to.eq(s.USDC_AMOUNT, "USDC received")
            showBody("Sent loop ", i)
        }


        //Eric should not hold any USDC for the tests
        await s.USDC.connect(s.Eric).transfer(bank, await s.USDC.balanceOf(s.Eric.address))
        await mineBlock()
         */
    });
});






/**
 
 */
