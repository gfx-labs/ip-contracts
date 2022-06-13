import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from ".././scope";
import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import { IERC20__factory, IVOTE__factory } from "../../../typechain-types";
//import { assert } from "console";

require("chai").should();
let usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";

if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}

describe("hardhat settings", () => {
    it("reset hardhat network each run", async () => {
        expect(await reset(0)).to.not.throw;
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [false])).to.not
            .throw;
    });
});

describe("Token Setup", () => {
    it("connect to signers", async () => {
        s.accounts = await ethers.getSigners();
        s.Frank = s.accounts[0];
        s.Andy = s.accounts[1];
        s.Bob = s.accounts[2];
        s.Carol = s.accounts[3];
        s.Dave = s.accounts[4];
        s.Eric = s.accounts[5];
        s.Gus = s.accounts[6];
        s.Hector = s.accounts[7];
        s.Igor = s.accounts[8];
        s.Bank = s.accounts[9];
    });
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank);
    });
    it("Should succesfully transfer money", async () => {
        //showBody(`stealing ${s.Andy_USDC} to Andy from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Andy.address, s.usdcAddress, s.Andy_USDC)
        ).to.not.be.reverted;

        //showBody(`stealing ${s.Bob_USDC} usdc to Bob from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Bob.address, s.usdcAddress, s.Bob_USDC)
        ).to.not.be.reverted

        //showBody(`stealing ${s.Carol_USDC} usdc to Carol from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Carol.address, s.usdcAddress, s.Carol_USDC)
        ).to.not.be.reverted

        //showBody(`stealing ${s.Dave_USDC} to Dave from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Dave.address, s.usdcAddress, s.Dave_USDC)
        ).to.not.be.reverted;

        //showBody(`stealing ${s.Eric_USDC} usdc to Eric from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Eric.address, s.usdcAddress, s.Eric_USDC)
        ).to.not.be.reverted

        //showBody(`stealing ${s.Frank_USDC} usdc to Frank from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Frank.address, s.usdcAddress, s.Frank_USDC)
        ).to.not.be.reverted

        //showBody(`stealing ${s.Gus_USDC} usdc to Gus from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Gus.address, s.usdcAddress, s.Gus_USDC)
        ).to.not.be.reverted

        //showBody(`stealing ${s.Hector_USDC} usdc to Hector from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Hector.address, s.usdcAddress, s.Hector_USDC)
        ).to.not.be.reverted

        //showBody(`stealing ${s.baseUSDC} usdc to Igor from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Igor.address, s.usdcAddress, s.baseUSDC)
        ).to.not.be.reverted

        //showBody(`stealing ${s.Bank_USDC} usdc to Bank from ${s.usdcAddress}`);
        await expect(
            stealMoney(usdc_minter, s.Bank.address, s.usdcAddress, s.Bank_USDC)
        ).to.not.be.reverted

        await mineBlock();

        let balance = await s.USDC.balanceOf(s.Bob.address)
        expect(balance).to.eq(s.Bob_USDC)

    });
});
