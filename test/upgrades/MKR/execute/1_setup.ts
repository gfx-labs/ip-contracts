import { expect } from "chai";
import { ethers, network } from "hardhat";
import { stealMoney } from "../../../../util/money";
import { s } from "../scope";
import { a, c, d } from "../../../../util/addresser"
import { reset, mineBlock } from "../../../../util/block";
import {
    IERC20__factory,
    OracleMaster__factory,
    ProxyAdmin__factory,
    USDI__factory,
    MKRVotingVaultController__factory,
    VaultController__factory,
    IVOTE__factory,
} from "../../../../typechain-types";

require("chai").should();

// configurable variables
const weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
const bank = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
const MKR_WHALE = "0x741AA7CFB2c7bF2A1E7D4dA2e3Df6a56cA4131F3"
const MKR = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(17389671)).to.not.throw;
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw;
    });
});

describe("Initial Setup - MKR - test proposal", () => {
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
        s.MKR = IERC20__factory.connect(MKR, s.Frank)
    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank);
        s.USDI = USDI__factory.connect(d.USDI, s.Frank);
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank);
        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank);

        const vvc = ""
        s.MKRVotingVaultController = MKRVotingVaultController__factory.connect(vvc, s.Frank)
    });

    it("Should succesfully transfer money", async () => {
        //send GOV some eth to adjust caps
        let tx = {
            to: s.owner._address,
            value: ethers.utils.parseEther('1')
        }
        await s.Frank.sendTransaction(tx);
        await mineBlock();


        await stealMoney(weth_minter, s.Bob.address, s.wethAddress, s.Bob_WETH);
        await stealMoney(weth_minter, s.Carol.address, s.wethAddress, s.Carol_WETH);
        await mineBlock();

        for (let i = 0; i < s.accounts.length; i++) {
            await s.USDC.connect(s.accounts[i]).transfer(bank, await s.USDC.balanceOf(s.accounts[i].address));

            await stealMoney(bank, s.accounts[i].address, s.USDC.address, s.USDC_AMOUNT);
            await mineBlock();
            expect(await s.USDC.balanceOf(s.accounts[i].address)).to.eq(s.USDC_AMOUNT, "USDC received");
        }

        await stealMoney(bank, s.Dave.address, s.USDC.address, s.Dave_USDC);

        await stealMoney(MKR_WHALE, s.Bob.address, s.MKR.address, s.MKR_AMOUNT);
        await stealMoney(MKR_WHALE, s.Carol.address, s.MKR.address, s.MKR_AMOUNT);
        await stealMoney(MKR_WHALE, s.Gus.address, s.MKR.address, s.MKR_AMOUNT);

        //Eric should not hold any USDC for the tests
        await s.USDC.connect(s.Eric).transfer(bank, await s.USDC.balanceOf(s.Eric.address));
        await mineBlock();
    });
});
