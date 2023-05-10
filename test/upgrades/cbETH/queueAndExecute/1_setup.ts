import { expect } from "chai";
import { ethers, network } from "hardhat";
import { stealMoney } from "../../../../util/money";
import { showBody } from "../../../../util/format";
import { BN } from "../../../../util/number";
import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { reset, mineBlock } from "../../../../util/block";
import {
    IERC20__factory,
    OracleMaster__factory,
    ProxyAdmin__factory,
    USDI__factory,
    VotingVaultController__factory,
    VaultController__factory,
    InterestProtocolTokenDelegate__factory,
} from "../../../../typechain-types";

require("chai").should();

// configurable variables
const weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
const bank = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
const rETH_WHALE = "0xEADB3840596cabF312F2bC88A4Bb0b93A4E1FF5F"
const cbETH_WHALE = "0xFA11D91e74fdD98F79E01582B9664143E1036931"


describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(16120579)).to.not.throw;
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
  
        s.rETH = IERC20__factory.connect("0xae78736cd615f374d3085123a210448e74fc6393", s.Frank)
        s.cbETH = IERC20__factory.connect("0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", s.Frank)


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

        tx = {
            to: cbETH_WHALE,
            value: ethers.utils.parseEther('1')
        }
        await s.Frank.sendTransaction(tx)
        await mineBlock()

        //showBody(`stealing ${s.Bob_WETH} weth to bob from ${s.wethAddress}`);
        await stealMoney(weth_minter, s.Bob.address, s.wethAddress, s.Bob_WETH)
        await mineBlock()


        //for some reason at this block, account 1 has 1 USDC, need to burn so all accounts are equal
        await s.USDC.connect(s.accounts[1]).transfer(bank, await s.USDC.balanceOf(s.accounts[1].address))
        await mineBlock()

        for (let i = 0; i < s.accounts.length; i++) {
            await stealMoney(bank, s.accounts[i].address, s.USDC.address, s.USDC_AMOUNT)
            await mineBlock()
            expect(await s.USDC.balanceOf(s.accounts[i].address)).to.eq(s.USDC_AMOUNT, "USDC received")

            await stealMoney(rETH_WHALE, s.accounts[i].address, s.rETH.address, s.rETH_Amount)
            await mineBlock()
            expect(await s.rETH.balanceOf(s.accounts[i].address)).to.eq(s.rETH_Amount, "rETH received")

            await stealMoney(cbETH_WHALE, s.accounts[i].address, s.cbETH.address, s.cbETH_Amount)
            await mineBlock()
            expect(await s.cbETH.balanceOf(s.accounts[i].address)).to.eq(s.cbETH_Amount, "cbETH received")

        }


        //Eric should not hold any USDC for the tests
        await s.USDC.connect(s.Eric).transfer(bank, await s.USDC.balanceOf(s.Eric.address))
        await mineBlock()


    });
});
