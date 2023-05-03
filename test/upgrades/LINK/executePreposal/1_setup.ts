import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../../util/money";
import { showBody } from "../../../../util/format";
import { BN } from "../../../../util/number";
import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { advanceBlockHeight, reset, mineBlock } from "../../../../util/block";
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
} from "../../../../typechain-types";

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
        expect(await reset(17175095)).to.not.throw;
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw;
    });
});

describe("Initial Setup - LINK", () => {
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

        s.UNI = IVOTE__factory.connect(s.uniAddress, s.Frank)
        s.LINK = IERC20__factory.connect("0x514910771AF9Ca656af840dff83E8264EcF986CA", s.Frank)

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

        //send GOV some eth to adjust caps
        let tx = {
            to: s.owner._address,
            value: ethers.utils.parseEther('1')
        }
        await s.Frank.sendTransaction(tx)
        await mineBlock()


        //showBody(`stealing ${s.Bob_WETH} weth to bob from ${s.wethAddress}`);
        await stealMoney(weth_minter, s.Bob.address, s.wethAddress, s.Bob_WETH)
        await stealMoney(weth_minter, s.Carol.address, s.wethAddress, s.Carol_WETH)
        await mineBlock()


        for (let i = 0; i < s.accounts.length; i++) {
            await s.USDC.connect(s.accounts[i]).transfer(bank, await s.USDC.balanceOf(s.accounts[i].address))

            await stealMoney(bank, s.accounts[i].address, s.USDC.address, s.USDC_AMOUNT)
            await mineBlock()
            expect(await s.USDC.balanceOf(s.accounts[i].address)).to.eq(s.USDC_AMOUNT, "USDC received")

        }

        await stealMoney(bank, s.Dave.address, s.USDC.address, s.Dave_USDC)

        await stealMoney(LINK_WHALE, s.Bob.address, s.LINK.address, s.LINK_AMOUNT)
        await stealMoney(LINK_WHALE, s.Carol.address, s.LINK.address, s.LINK_AMOUNT)
        await stealMoney(LINK_WHALE, s.Gus.address, s.LINK.address, s.LINK_AMOUNT)


        //Eric should not hold any USDC for the tests
        await s.USDC.connect(s.Eric).transfer(bank, await s.USDC.balanceOf(s.Eric.address))
        await mineBlock()


    });
});
