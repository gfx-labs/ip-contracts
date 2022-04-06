import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { Mainnet } from "../util/addresser";
import { fastForward } from "../util/block";
import { Deployment } from "../util/contractor";
import { stealMoney } from "../util/money";
import { utils } from "ethers";
//import { assert } from "console";

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
      (await con.VaultMaster!.account_collateral_value(1)).toString()
    );
  });
  it(`carol should have ${Carol_COMP} deposited`, async () => {
    expect(
      await carol_vault.connect(Carol).getBalances(con.COMP!.address)
    ).to.eq(Carol_COMP);
    console.log(
      "carol value:",
      (await con.VaultMaster!.account_collateral_value(2)).toString()
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
    await setupInitial()
    await setupVaults()
  })
  it(`bob should able to borrow ${borrowAmount} usdi`, async () => {
    await expect(con.VaultMaster!.connect(Bob).borrow_usdi(1, borrowAmount)).to.not.be
      .reverted;
  });
  it("partial repay", async () => {
    const liability = await bob_vault.connect(Bob).getBaseLiability()
    const partialLiability = liability / 2 //half
    const vaultId = 1
    const initBalance = await con.USDI!.balanceOf(Bob.address)
    console.log("Bob's Initial Balance: ", initBalance.toString())
    await con.VaultMaster!.connect(Bob).repay_usdi(vaultId, partialLiability)

    let updatedLiability = await bob_vault.connect(Bob).getBaseLiability()
    let balance = await con.USDI!.balanceOf(Bob.address)

    console.log(liability.toString())
    console.log((liability-partialLiability).toString())
    console.log(updatedLiability.toString())
    
    //assert.equal(updatedLiability.toString(), partialLiability.toString(), "Half of liability has been filled")

  })
  it("complete repay", async () => {

  })
})




