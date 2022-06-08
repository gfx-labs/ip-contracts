import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import { IERC20__factory, IVOTE__factory } from "../../../typechain-types";
import { JsonRpcSigner } from "@ethersproject/providers"
import { Wallet } from "@ethersproject/wallet"

import { utils, BigNumber } from "ethers"
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

// configurable variables
let usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";
let comp_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let wbtc_minter = "0xf977814e90da44bfa03b6295a0616a897441acec"
let uni_minter = "0xf977814e90da44bfa03b6295a0616a897441acec"
let dydx_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let ens_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let aave_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let tribe_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let weth_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";

let carol_voting_address = "0x1F2AB8Ac759Fb0E3185630277A554Ae3110bF530";

if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}


const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.rpc.gfx.xyz/"))
const isContract = async (address: string) => {
    const res = await web3.eth.getCode(address)
    return res.length > 5
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

    /**
     * filter for contracts first, use ./scripts/filterForContracts.ts
     * otherwise, sending ether will fail, these contracts need some ether to claim points
     */
    it("initialize signers", async () => {

/**
 



        let wallets: Wallet[] = new Array(s.whitelist1.length)
        for (let i = 0; i < s.whitelist1.length; i++) {
            showBody("Setting up wallet: ", i)
            wallets[i] = ethers.Wallet.createRandom();
            wallets[i] = wallets[i].connect(ethers.provider)

            await s.Bank.sendTransaction({ to: s.whitelist1[i], value: utils.parseEther("0.5") })
            await advanceBlockHeight(1)
            
            await s.USDC.connect(s.Bank).transfer(wallets[i].address, BN("500e6"))
            await advanceBlockHeight(1)

        }
        await mineBlock()
        s.wallets1 = wallets

        showBodyCyan("WALLETS 1 DONE")

        let wallets2: Wallet[] = new Array(s.whitelist2.length)
        for (let i = 0; i < s.whitelist2.length; i++) {
            showBody("Setting up wallet: ", i, `of ${s.whitelist2.length}`)
            wallets2[i] = ethers.Wallet.createRandom();
            wallets2[i] = wallets2[i].connect(ethers.provider)

            await s.Bank.sendTransaction({ to: s.whitelist2[i], value: utils.parseEther("0.5") })
            await advanceBlockHeight(1)
            
            await s.USDC.connect(s.Bank).transfer(wallets2[i].address, BN("500e6"))
            await advanceBlockHeight(1)

        }
        await mineBlock()
        s.wallets2 = wallets2

        showBodyCyan("WALLETS 2 DONE")


 */






        /**
         let wallets: any[] = new Array(s.whitelist1.length)

        for( let i=0; i < s.whitelist1.length; i++){
            // Get a new wallet
            let wallet = ethers.Wallet.createRandom();
            // add the provider from Hardhat
            wallet =  wallet.connect(ethers.provider);
            // send ETH to the new wallet so it can perform a tx
            await s.Bank.sendTransaction({to: wallet.address, value: ethers.utils.parseEther("1")});
            
            wallets[i] = wallet
        }
         */









        /**
         
                let signers: JsonRpcSigner[] = new Array(s.whitelist1.length)
                for (let i = 0; i < s.whitelist1.length; i++) {
        
                    let contract = await isContract(s.whitelist1[i])
        
                    if (!contract) {
                        let signer = ethers.provider.getSigner(s.whitelist1[i])
                        showBody(`sending tx ${i} ${s.whitelist1[i]} `)
        
                        await s.Bank.sendTransaction({ to: s.whitelist1[i], value: utils.parseEther("0.5") })
                        await advanceBlockHeight(1)
        
        
                        signers[i] = signer
                    }
                    else {
                        showBodyCyan(s.whitelist1[i], "is a contract")
                    }
        
        
                }
                await mineBlock()
        
                s.accounts1 = signers
        
                let signers2: JsonRpcSigner[] = new Array(s.whitelist2.length)
                for (let i = 0; i < s.whitelist2.length; i++) {
                    let signer = ethers.provider.getSigner(s.whitelist2[i])
                    signers2[i] = signer
                }
                s.accounts2 = signers2
        
        
         */


    })
});
