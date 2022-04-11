import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { Mainnet } from "../util/addresser";
import { fastForward } from "../util/block";
import { Deployment } from "../util/contractor";
import { stealMoney } from "../util/money";
import { utils } from "ethers";
//import { assert } from "console";

//import {ERC20ABI} from "../../scripts/erc20ABI"
const ERC20ABI = require('../../scripts/erc20ABI.ts')

let con = Deployment;

let Frank: any; // frank is the Frank and master of USDI
let Andy: any; // andy is a usdc holder. He wishes to deposit his USDC to hold USDI
let Bob: any; // bob is an eth holder. He wishes to deposit his eth and borrow USDI
let Carol: any; // carol is a comp holder. she wishes to deposit her comp and then vote
let Dave: any; // dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob

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

let Andy_USDC = 1e8;
let Bob_WETH = ethers.utils.parseEther("10");
let Carol_COMP = ethers.utils.parseEther("100");
let Dave_USDC = 1e8;

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
  ).catch(console.log);
  await stealMoney(
    usdc_minter,
    Dave.address,
    Mainnet.usdcAddress,
    Dave_USDC
  ).catch(console.log);
  await stealMoney(
    comp_minter,
    Carol.address,
    Mainnet.compAddress,
    Carol_COMP
  ).catch(console.log);
  await stealMoney(
    weth_minter,
    Bob.address,
    Mainnet.wethAddress,
    Bob_WETH
  ).catch(console.log);
};

let bob_vault: any;
let carol_vault: any;
const setupVaults = async () => {
  await con.VaultMaster!.connect(Bob).mint_vault();
  const bob_vault_addr = await con.VaultMaster!._vaultId_vaultAddress(1);
  bob_vault = await ethers.getContractAt("Vault", bob_vault_addr);

  await con.VaultMaster!.connect(Carol).mint_vault();
  const carol_vault_addr = await con.VaultMaster!._vaultId_vaultAddress(2);
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
require('chai')
  .should()
describe("USDI-TOKEN:Init", () => {
  before("deploy contracts", setupInitial);
  it("Should return the right name, symbol, and decimals", async () => {
    expect(await con.USDI?.name()).to.equal("USDI Token");
    expect(await con.USDI?.symbol()).to.equal("USDI");
    expect(await con.USDI?.decimals()).to.equal(6);
  });
  it(`The contract creator should have ${(1e6).toLocaleString()} fragment`, async () => {
    expect(await con.USDI!.balanceOf(await Frank.getAddress())).to.eq(1e6);
  });
  it(`the totalSupply should be ${(1e6).toLocaleString()}`, async () => {
    expect(await con.USDI!.totalSupply()).to.eq(1e6);
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
    //console.log("comp:", price.toLocaleString());
    expect(price).to.not.eq(0);
  });
});

// deploy the con.VaultMaster! and also mint bob and carols vaults;
describe("VAULTS:Init", () => {
  before("deploy vaults", setupVaults);
  it(`there should be 2 enabled currencies`, async () => {
    expect(await con.VaultMaster!._tokensRegistered()).to.eq(2);
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
  it(`andy should have ${Andy_USDC} usdi`, async () => {
    expect(await con.USDI!.balanceOf(await Andy.getAddress())).to.eq(Andy_USDC);
  });

  it(`Dave should have ${Dave_USDC} usdi`, async () => {
    expect(await con.USDI!.balanceOf(await Dave.getAddress())).to.eq(Dave_USDC);
  });
});

//deposits for lending here,
describe("TOKEN-DEPOSITS", () => {
  before("token deposits", tokenDeposits);
  it(`bob should have ${Bob_WETH} deposited`, async () => {
    expect(await bob_vault.connect(Bob).getBalances(con.WETH!.address)).to.eq(
      Bob_WETH
    );
    console.log(
      "bob value:",
      (await con.VaultMaster!.account_borrowing_power(1)).toString()
    );
  });
  it(`carol should have ${Carol_COMP} deposited`, async () => {
    expect(
      await carol_vault.connect(Carol).getBalances(con.COMP!.address)
    ).to.eq(Carol_COMP);
    console.log(
      "carol value:",
      (await con.VaultMaster!.account_borrowing_power(2)).toString()
    );
  });
});
describe("TOKEN-DEPOSITS", async () => {
  it(`bob should not be able to borrow 2*${Bob_WETH} usdi`, async () => {

    await expect(con.VaultMaster!.connect(Bob).borrow_usdi(1, Bob_WETH.mul(2)))
      .to.be.revertedWith("this borrow would make your account insolvent");

  });

  it(`bob should able to borrow ${10e6} usdi`, async () => {
    await expect(con.VaultMaster!.connect(Bob).borrow_usdi(1, 10e6)).to.not.be
      .reverted;
  });

  it(`after a few days, bob should have a liability greater than ${10e6}`, async () => {
    await fastForward(60 * 60 * 24 * 7);//1 week
    await con.VaultMaster!.connect(Frank).calculate_interest();
    const liability_amount = await con
      .VaultMaster!.connect(Bob)
      .get_account_liability(1);
    expect(liability_amount).to.be.gt(10e6);
    //console.log("bob_liability:", liability_amount.toString());
  });

});
describe("Checking interest generation", () => {
  it("check change in balance over a long period of time", async () => {
    const initBalance = await con.USDI!.balanceOf(Dave.address)
    //fastForward
    await fastForward(60 * 60 * 24 * 7 * 52);//1 year

    //calculate and pay interest
    let result: any = await con.VaultMaster!.calculate_interest()
    result = await result.wait()
    let args = result.events![result.events!.length - 1].args

    //console.log(args)

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
  const borrowAmount = 10e6
  before(async () => {
    //await setupInitial()
    //await setupVaults()
  })
  it(`bob should able to borrow ${borrowAmount} usdi`, async () => {
    await expect(con.VaultMaster!.connect(Bob).borrow_usdi(1, borrowAmount)).to.not.be
      .reverted;
  });
  it("partial repay", async () => {
    const liability = await bob_vault.connect(Bob).getBaseLiability()
    const partialLiability = liability.div(2) //half
    const vaultId = 1
    const initBalance = await con.USDI!.balanceOf(Bob.address)
    //console.log("Bob's Initial Balance: ", initBalance.toString())
    await con.VaultMaster!.connect(Bob).repay_usdi(vaultId, partialLiability)

    let updatedLiability = await bob_vault.connect(Bob).getBaseLiability()
    let balance = await con.USDI!.balanceOf(Bob.address)

    //console.log("Partial liability: ", partialLiability.toString())
    //console.log("Balance after repay", balance.toString())
    //console.log("Updated Liability after repay: ", updatedLiability.toString())
    
    //TODO - TEST MATH
    //assert.equal(updatedLiability.toString(), partialLiability.toString(), "Half of liability has been filled")
    //assert.equal(balance.toString(), (initBalance.toNumber() - partialLiability).toString(), "Balances are correct")

  })
  it("complete repay", async () => {
    const vaultId = 1
    const initBalance = await con.USDI!.balanceOf(Bob.address)
    const liability = await bob_vault.connect(Bob).getBaseLiability()

    await con.VaultMaster!.connect(Bob).repay_all_usdi(vaultId)

    let updatedLiability = await bob_vault.connect(Bob).getBaseLiability()
    assert.equal(updatedLiability.toNumber(), 0, "Liability is now 0")

    let balance = await con.USDI!.balanceOf(Bob.address)
    //console.log("Balance after complete repay: ", balance.toString())
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
     console.log(
      "bob value:",
      (await con.VaultMaster!.account_borrowing_power(1)).toString()
    );
    */
  });
  it("borrow maximum and liquidate", async () => {
    /**
     * LIQUIDATE QUESTIONS
     * what is max_usdi for? 
     * seems like usdi_to_repurchase is total_proceeds + 1, so a guaranteed underflow if we do total_proceeds - usdi_to_repurchase
     *  ** this is unless usdi_to_repurchase is limited by the above max-usdi arg, what scenario is this for? Partial liquidation? 
     * 
     * is that if you borrow up to your max (account_borrowing_power) your total_liquidity_value will be usdi_liability + 1 but only until pay_interest() happens again, at which point you will be insolvent even if the price of collateral doesn't move
     * 
     * _e4_liquidatorShare is never set? 
     * 
     * vault.claim_erc20() is master only, there is no function to call this on vaultMaster? 
     */
    const abi = new ERC20ABI()
    const wETH_Contract = new ethers.Contract(Mainnet.wethAddress, abi.erc20ABI(), ethers.provider)
    const vaultID = 1
    const max_usdi = 1e5
    const initBalance = await con.USDI!.balanceOf(Bob.address)
    console.log("Bob starting USDI balance: ", initBalance.toString())


    let balance = await wETH_Contract.balanceOf(bob_vault.address)
    console.log("bob_vault wETH balance initially", balance.toString())
    balance = await con.USDI!.balanceOf(Dave.address)
    console.log("Dave starting USDI balance: ", balance.toString())

    balance = await wETH_Contract.balanceOf(Dave.address)
    console.log("Dave wETH balance init: ", balance.toString())


    //BUG FOUND = need to transfer from vault instead of from vaultMaster in liquidation 
    

    
    //borrow maximum - borrow amount == collateral value 
    const account_borrowing_power = await con.VaultMaster!.account_borrowing_power(vaultID)
    console.log("account_borrowing_power", account_borrowing_power.toString())
    await con.VaultMaster!.connect(Bob).borrow_usdi(1, account_borrowing_power)

    //withdraw collateral, vault is below liquidation threshold 
    //const result = await bob_vault.connect(Bob).withdraw_erc20(Mainnet.hh wethAddress, 1e8) 
    //const receipt = await result.wait()
    //const args = receipt.events

    //balance = await wETH_Contract.balanceOf(bob_vault.address)
    //console.log("bob_vault wETH balance after withdraw", balance.toString())

    //console.log(args)
 
    //calculate interest to update protocol, vault is now able to be liquidated 
    await con.VaultMaster!.calculate_interest()
    balance = await ethers.provider.getBalance(Dave.address)
    console.log("Dave ether balance inits: ", utils.formatEther(balance.toString()))


    //liquidate account
    const result = await con.VaultMaster!.connect(Dave).liquidate_account(vaultID, Mainnet.wethAddress, max_usdi)
    const receipt = await result.wait()
    let args = receipt.events![receipt.events!.length - 1]
    //console.log(args)
    //check ending balances

    balance = await ethers.provider.getBalance(Dave.address)
    console.log("Dave ether balance end: ", utils.formatEther(balance.toString()))

    balance = await wETH_Contract.balanceOf(bob_vault.address)
    //console.log("bob_vault wETH balance after liquidation", balance.toString())

    balance = await con.USDI!.balanceOf(Dave.address)
    //console.log("Dave ending USDI balance: ", balance.toString())

    balance = await wETH_Contract.balanceOf(Dave.address)
    //console.log("Dave wETH balance end: ", balance.toString())
    
  })
})



