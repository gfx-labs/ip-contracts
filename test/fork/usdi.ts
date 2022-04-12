import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { Mainnet } from "../util/addresser";
import { fastForward } from "../util/block";
import { Deployment } from "../util/contractor";
import { stealMoney } from "../util/money";
import { ContractReceipt, Event, utils } from "ethers";
import { showBody } from "../util/format";
import { BN } from "../util/number";
//import { assert } from "console";

//import {ERC20ABI} from "../../scripts/erc20ABI"
const ERC20ABI = require('../../scripts/erc20ABI.ts')

let con = Deployment;

let Frank: any; // frank is the Frank and master of USDI
let Andy: any; // andy is a usdc holder. He wishes to deposit his USDC to hold USDI
let Bob: any; // bob is an eth holder. He wishes to deposit his eth and borrow USDI
let Carol: any; // carol is a comp holder. she wishes to deposit her comp and then vote
let Dave: any; // dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob

require('chai').should()
//*
// Initial Balances:
// Andy: 100,000,000,000 usdc ($100,000) 6dec
// Bob: 10,000,000,000,000,000,000 weth (10 weth) 18dec
// Carol: 100,000,000,000,000,000,000 (100 comp), 18dec
// Dave: 100,000,000,000 usdc ($100,000) 6dec
//
// andy is a usdc holder. She wishes to deposit her USDC to hold USDI
// bob is an eth holder. He wishes to deposit his eth and borrow USDI
// carol is a comp holder. she wishes to deposit her comp and then vote
// dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob

// configurable variables

let Andy_USDC = BN("1e8");
let Bob_WETH = ethers.utils.parseEther("10");
let Carol_COMP = ethers.utils.parseEther("100");
let Dave_USDC = BN("1e10");

let usdc_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";
let comp_minter = "0xf977814e90da44bfa03b6295a0616a897441acec";
let weth_minter = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";

const setupInitial = async () => {
    //setting up accounts
    let accounts = await ethers.getSigners();
    Frank = accounts[0];
    Andy = accounts[1];
    Bob = accounts[2];
    Carol = accounts[3];
    Dave = accounts[4];
    await con.deploy(Frank);
    await stealMoney(
        usdc_minter,
        Andy.address,
        Mainnet.usdcAddress,
        Andy_USDC
    ).catch(showBody);
    await stealMoney(
        usdc_minter,
        Dave.address,
        Mainnet.usdcAddress,
        Dave_USDC
    ).catch(showBody);
    await stealMoney(
        comp_minter,
        Carol.address,
        Mainnet.compAddress,
        Carol_COMP
    ).catch(showBody);
    await stealMoney(
        weth_minter,
        Bob.address,
        Mainnet.wethAddress,
        Bob_WETH
    ).catch(showBody);
};

let bob_vault: any;
let carol_vault: any;
const setupVaults = async () => {
    await con.VaultController!.connect(Bob).mint_vault();
    const bob_vault_addr = await con.VaultController!._vaultId_vaultAddress(1);
    bob_vault = await ethers.getContractAt("Vault", bob_vault_addr);

    await con.VaultController!.connect(Carol).mint_vault();
    const carol_vault_addr = await con.VaultController!._vaultId_vaultAddress(2);
    carol_vault = await ethers.getContractAt("IVault", carol_vault_addr);
};

const usdcDeposits = async () => {
    await con.USDC!.connect(Andy).approve(con.USDI!.address, Andy_USDC);
    await con.USDI!.connect(Andy).deposit(Andy_USDC);

    await con.USDC!.connect(Dave).approve(con.USDI!.address, Dave_USDC);
    await con.USDI!.connect(Dave).deposit(Dave_USDC);
};

const tokenDeposits = async () => {
    await con.WETH!.connect(Bob).approve(bob_vault.address, Bob_WETH);
    await con.COMP!.connect(Carol).approve(carol_vault.address, Carol_COMP);
    await bob_vault.connect(Bob).deposit_erc20(Mainnet.wethAddress, Bob_WETH);
    await carol_vault
        .connect(Carol)
        .deposit_erc20(Mainnet.compAddress, Carol_COMP);
};
describe("USDI-TOKEN:Init", () => {
    before("deploy contracts", setupInitial);
    it("Should return the right name, symbol, and decimals", async () => {
        expect(await con.USDI?.name()).to.equal("USDI Token");
        expect(await con.USDI?.symbol()).to.equal("USDI");
        expect(await con.USDI?.decimals()).to.equal(18);
    });
    it(`The contract creator should have ${BN("1e18").toLocaleString()} fragment`, async () => {
        expect(await con.USDI!.balanceOf(await Frank.getAddress())).to.eq(BN("1e18"));
    });
    it(`the totalSupply should be ${BN("1e18").toLocaleString()}`, async () => {
        expect(await con.USDI!.totalSupply()).to.eq(BN("1e18"));
    });
    it("the owner should be the Frank", async () => {
        expect(await con.USDI!.owner()).to.eq(await Frank.getAddress());
    });
});

// deploy the oracles
describe("ORACLES:Init", () => {
    before("deploy contracts", setupInitial);
    it("comp price should be nonzero", async () => {
        const price = await con.Oracle!.get_live_price(Mainnet.compAddress);
        //showBody("comp:", price.toLocaleString());
        expect(price).to.not.eq(0);
    });
});

// deploy the con.VaultController! and also mint bob and carols vaults;
describe("VAULTS:Init", () => {
    before("deploy vaults", setupVaults);
    it(`there should be 2 enabled currencies`, async () => {
        expect(await con.VaultController!._tokensRegistered()).to.eq(2);
    });
    it(`bobs vault should exist`, () => {
        expect(bob_vault.address).to.not.eq(undefined);
    });

    it(`carols vault should exist`, () => {
        expect(carol_vault.address).to.not.eq(undefined);
    });
});
// everyboth who deposits usdc to mint usdi does it here
describe("USDC-DEPOSITS", () => {
    before("usdc deposits", usdcDeposits);
    let av = BN(Andy_USDC).mul(BN("1e12"))
    it(`andy should have ${av} usdi`, async () => {
        expect(await con.USDI!.balanceOf(await Andy.getAddress())).to.eq(av);
    });
    let dv = BN(Dave_USDC).mul(BN("1e12"))
    it(`Dave should have ${dv} usdi`, async () => {
        expect(await con.USDI!.balanceOf(await Dave.getAddress())).to.eq(dv);
    });
});

//deposits for lending here,
describe("TOKEN-DEPOSITS", () => {
    before("token deposits", tokenDeposits);
    it(`bob should have ${Bob_WETH} deposited`, async () => {
        expect(await bob_vault.connect(Bob).getBalances(con.WETH!.address)).to.eq(
            Bob_WETH
        );
        /**
         showBody(
          "bob value:",
          (await con.VaultController!.account_borrowing_power(1)).toString()
        );
         */
    });
    it(`carol should have ${Carol_COMP} deposited`, async () => {
        expect(
            await carol_vault.connect(Carol).getBalances(con.COMP!.address)
        ).to.eq(Carol_COMP);
        /**
         showBody(
          "carol value:",
          (await con.VaultController!.account_borrowing_power(2)).toString()
        );
         */
    });
});
describe("TOKEN-DEPOSITS", async () => {
    it(`bob should not be able to borrow 1e6 * 1e18 * ${Bob_WETH} usdi`, async () => {
        await expect(con.VaultController!.connect(Bob).borrow_usdi(1,
            Bob_WETH.mul(BN("1e18")).mul(1e6),
        )).to.be.revertedWith("account insolvent");

    });

    it(`bob should able to borrow ${"5000e18"} usdi`, async () => {
        await expect(con.VaultController!.connect(Bob).borrow_usdi(1, BN("5000e18"))).to.not.be
            .revertedWith("account insolvent");
    });

    it(`after a few days, bob should have a liability greater than ${"BN(5000e18)"}`, async () => {
        await fastForward(60 * 60 * 24 * 7);//1 week
        await con.VaultController!.connect(Frank).calculate_interest();
        const liability_amount = await con
            .VaultController!.connect(Bob)
            .get_account_liability(1);
        showBody("liability", liability_amount)
        expect(liability_amount).to.be.gt(BN("5000e18"));
        //showBody("bob_liability:", liability_amount.toString());
    });

});
describe("Checking interest generation", () => {
    it("check change in balance over a long period of time", async () => {
        const initBalance = await con.USDI!.balanceOf(Dave.address)
        //fastForward
        await fastForward(60 * 60 * 24 * 7 * 52 * 1);//1 year


        //calculate and pay interest
        let result: any = await con.VaultController!.calculate_interest()
        result = await result.wait()
        let args = result.events![result.events!.length - 1].args

        //showBody(args)

        //check for yeild    
        let balance = await con.USDI!.balanceOf(Dave.address)
        expect(balance > initBalance)

    })
})
/**
 untested functions: 
  repay_usdi + repay_all_usdi
  liquidate_account
  check_account
  getInterestFactor
 */


describe("Testing repay", () => {
    const borrowAmount = BN("10e18")
    before(async () => {
        //await setupInitial()
        //await setupVaults()
    })
    it(`bob should able to borrow ${borrowAmount} usdi`, async () => {
        await expect(con.VaultController!.connect(Bob).borrow_usdi(1, borrowAmount)).to.not.be
            .reverted;
    });
    it("partial repay", async () => {
        const liability = await bob_vault.connect(Bob).getBaseLiability()
        const partialLiability = liability.div(2) //half
        const vaultId = 1
        const initBalance = await con.USDI!.balanceOf(Bob.address)
        showBody("Bob's Initial Balance: ", initBalance.toString())
        await con.VaultController!.connect(Bob).repay_usdi(vaultId, partialLiability)

        let updatedLiability = await bob_vault.connect(Bob).getBaseLiability()
        let balance = await con.USDI!.balanceOf(Bob.address)

        showBody("Partial liability: ", partialLiability.toString())
        showBody("Balance after repay", balance.toString())
        showBody("Updated Liability after repay: ", updatedLiability.toString())

        //TODO - TEST MATH
        //assert.equal(updatedLiability.toString(), partialLiability.toString(), "Half of liability has been filled")
        //assert.equal(balance.toString(), (initBalance.toNumber() - partialLiability).toString(), "Balances are correct")

    })
    it("complete repay", async () => {
        const vaultId = 1
        const initBalance = await con.USDI!.balanceOf(Bob.address)
        const liability = await bob_vault.connect(Bob).getBaseLiability()

        await con.VaultController!.connect(Bob).repay_all_usdi(vaultId)

        let updatedLiability = await bob_vault.connect(Bob).getBaseLiability()
        assert.equal(updatedLiability.toNumber(), 0, "Liability is now 0")

        let balance = await con.USDI!.balanceOf(Bob.address)
        //showBody("Balance after complete repay: ", balance.toString())
    })
})

describe("Testing liquidations", () => {
    before(async () => {
        //await setupInitial()
        //await setupVaults()
    })
    it(`bob should have ${Bob_WETH} wETH deposited`, async () => {
        expect(await bob_vault.connect(Bob).getBalances(con.WETH!.address)).to.eq(
            Bob_WETH
        );
        /**
          showBody(
           "bob value:",
           (await con.VaultController!.account_borrowing_power(1)).toString()
         );
         */
    });


    /**
     it("test convert scale", async () => {
      const usdcAmount = 3247687117 //should resolve to 3247.687117 USDC decimal 6
      const sats = 3200000000 //should resolve to 32 wBTC decimal 8
      const etherAmount = utils.parseEther("12")//should resolve to 12 ether decimal 18
  
      const wBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
  
  
      let amount = await con.VaultController!.convertScaleTest(Mainnet.usdcAddress, usdcAmount)
      assert.equal(utils.formatEther(amount!.toString()), "3247.687117")
      
      amount = await con.VaultController!.convertScaleTest(wBTC, sats)
      assert.equal(utils.formatEther(amount!.toString()), "32.0")
  
      amount = await con.VaultController!.convertScaleTest(Mainnet.wethAddress, etherAmount)
      assert.equal(utils.formatEther(amount!.toString()), "12.0")
    })
     */


    it("borrow maximum and liquidate", async () => {
        /**
         * LIQUIDATE QUESTIONS
         * what is max_usdi for? 
         * seems like usdi_to_repurchase is total_proceeds + 1, so a guaranteed underflow if we do total_proceeds - usdi_to_repurchase
         *  ** this is unless usdi_to_repurchase is limited by the above max-usdi arg, what scenario is this for? Partial liquidation? 
         * 
         * is that if you borrow up to your max (account_borrowing_power) your total_liquidity_value will be usdi_liability + 1 but only until pay_interest() happens again, at which point you will be insolvent even if the price of collateral doesn't move
         * to this end, it may be possible to borrow maximum, then withdraw some amount of collateral before pay_interest()
         * 
         * _e4_liquidatorShare is never set? 
         * 
         * vault.claim_erc20() is master only, there is no function to call this on VaultController? Looks like this sends from vault to vault master, what is the use case for this? 
         * 
         * deficit is USDC denominated? How much USDC underwater is the vault? 
         * tokens_to_liquidate = deficit / getScaledPrice()
         * both deficit and getScaledPrice() should be the same decimal, 18? 
         * 
         * 
         * borrow against multiple assets? 
         * 
         */
        const abi = new ERC20ABI()
        const wETH_Contract = new ethers.Contract(Mainnet.wethAddress, abi.erc20ABI(), ethers.provider)
        const vaultID = 1
        const initBalanceBob = await con.USDI!.balanceOf(Bob.address)
        const initBalanceDave = await con.USDI!.balanceOf(Dave.address)
        const initWethBalanceDave = await wETH_Contract.balanceOf(Dave.address)
        //showBody("Bob starting USDI balance: ", initBalance.toString())
        const bobVaultInit = await wETH_Contract.balanceOf(bob_vault.address)

        //borrow maximum - borrow amount == collateral value 
        const account_borrowing_power = await con.VaultController!.account_borrowing_power(vaultID)
        showBody("borrow power:", account_borrowing_power)
        showBody("dave balance: ", initBalanceDave)
        await con.VaultController!.connect(Bob).borrow_usdi(1, account_borrowing_power)


        /******** CHECK WITHDRAW BEFORE CALCULATE INTEREST ********/
        //skip time so we can put vault below liquidation threshold 
        await fastForward(60 * 60 * 24 * 7 * 52 * 10);//10 year
        //await bob_vault.connect(Bob).withdraw_erc20(Mainnet.wethAddress, BN("9e17"))
        //calculate interest to update protocol, vault is now able to be liquidated 
        await con.VaultController!.calculate_interest()
        //liquidate account
        const result = await con.VaultController!.connect(Dave).liquidate_account(vaultID, Mainnet.wethAddress, BN("1e16"))
        const receipt = await result.wait()
        let interestEvent = receipt.events?.filter((x: Event) => {
            return x.event == "Interest"
        }).pop()?.event
        assert.equal(interestEvent, "Interest", "Correct event captured and emitted")

        let liquidateEvent = receipt.events![receipt.events!.length - 1]
        let args = liquidateEvent.args
        assert.equal(liquidateEvent.event, "Liquidate", "Correct event captured and emitted")
        //assert.equal(args!.asset_address.toString(), Mainnet.wethAddress.toString(), "Asset address is correct")
        //showBody(liquidateEvent)

        /******** check ending balances ********/

        //Bob's vault has less collateral than before
        let balance = await wETH_Contract.balanceOf(bob_vault.address)
        let difference = bobVaultInit.sub(balance)
        //expect(difference.toNumber()).to.be.greaterThan(0)

        //Dave spent USDi to liquidate
        balance = await con.USDI!.balanceOf(Dave.address)
        //expect(balance.toNumber()).to.be.lessThan(initBalanceDave.toNumber())

        //Dave received wETH
        balance = await wETH_Contract.balanceOf(Dave.address)
        //expect(balance.toNumber()).to.be.greaterThan(initWethBalanceDave.toNumber())
        //showBody("Dave wETH balance end: ", balance.toString())

    })
})



