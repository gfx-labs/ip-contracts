const { expect } = require("chai");


const dollars = (n)=>{
  return ethers.BigNumber.from(n).mul(ethers.BigNumber.from(10).pow(6))
}


const INITIAL_DEPOSIT = dollars(100);

let accounts;

let ERC20;

let usdc
let USDI;
let usdi;

let usdc_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

let comp_address = "0xc00e94cb662c3520282e6f5717214004a7f26888";

let weth_address =  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

let Frank; // frank is the Frank and master of USDI

let Alice; // alice is a usdc holder. She wishes to deposit her USDC to hold USDI
let Bob; // bob is an eth holder. He wishes to deposit his eth and borrow USDI
let Carol; // carol is a comp holder. she wishes to deposit her comp and then vote
let Dave; // dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob



let usdc_minter = "0x55FE002aefF02F77364de339a1292923A15844B8"; // i think this is some random account

let comp_minter = "0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b"; // robbing okex

let weth_minter = "0x0C4809bE72F9E117D75381438c5dAeC8AbE75BaD"; // idk who dis


const setupInitial = async ()=>{
  //setting up accounts
  accounts = await ethers.getSigners()
  Frank = accounts[0];
  Alice = accounts[1];
  Bob = accounts[2];
  Carol = accounts[3];
  Dave = accounts[4];

  USDI = await ethers.getContractFactory("USDI");
  usdi = await USDI.deploy(usdc_address);
  await usdi.connect(Frank).setMonetaryPolicy(await Frank.getAddress());
  initialSupply = await usdi.totalSupply();

  usdc = await ethers.getContractAt("IERC20",usdc_address)
  // send some USDC to our accounts
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [usdc_minter]}
  )
  let signer = await ethers.provider.getSigner(usdc_minter);
  await usdc.connect(signer).transfer(await Alice.getAddress(),Alice_USDC);
  await usdc.connect(signer).transfer(await Dave.getAddress(),Dave_USDC);
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [usdc_minter]}
  )

  comp = await ethers.getContractAt("IERC20",comp_address)
  // send some comp to our accounts
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [comp_minter]}
  )
  signer = await ethers.provider.getSigner(comp_minter);
  await comp.connect(signer).transfer(await Carol.getAddress(),Carol_COMP);
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [comp_minter]}
  )

  weth = await ethers.getContractAt("IERC20",weth_address)
  // send some weth to our accounts
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [weth_minter]}
  )
  signer = await ethers.provider.getSigner(weth_minter);
  await weth.connect(signer).transfer(await Bob.getAddress(),Bob_WETH);
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [weth_minter]}
  )
}

let Relay, OracleMaster
let relay_weth, relay_comp, oraclemaster;
const setupOracles = async () => {
  Relay = await ethers.getContractFactory('UniswapV3OracleRelay');
  relay_weth = await Relay.deploy("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",true);
  relay_comp = await Relay.deploy("0xf15054bc50c39ad15fdc67f2aedd7c2c945ca5f6",true);

  OracleMaster = await ethers.getContractFactory('OracleMaster');
  oraclemaster = await OracleMaster.deploy()

  await oraclemaster.connect(Frank).set_relay(weth_address,relay_weth.address);
  await oraclemaster.connect(Frank).set_relay(comp_address,relay_comp.address);
}


let VaultMaster;
let vaultmaster;
let bob_vault,carol_vault;
const setupVaults = async () => {
  VaultMaster = await ethers.getContractFactory('VaultMaster')
  vaultmaster = await VaultMaster.deploy();
  await vaultmaster.connect(Frank).register_usdi(usdi.address);
  await vaultmaster.connect(Frank).register_oracle_master(oraclemaster.address);
  await vaultmaster.connect(Frank).register_erc20(weth_address,600,weth_address);
  await vaultmaster.connect(Frank).register_erc20(comp_address,400,comp_address);

  await vaultmaster.connect(Bob).mint_vault();
  const bob_vault_addr = await vaultmaster._vaultId_vaultAddress(1);
  bob_vault = await ethers.getContractAt("Vault",bob_vault_addr);

  await vaultmaster.connect(Carol).mint_vault();
  const carol_vault_addr = await vaultmaster._vaultId_vaultAddress(2);
  carol_vault = await ethers.getContractAt("IVault",carol_vault_addr);
}

const usdcDeposits = async () => {
  await usdc.connect(Alice).approve(usdi.address,Alice_USDC);
  await usdi.connect(Alice).deposit(Alice_USDC);

  await usdc.connect(Dave).approve(usdi.address,Dave_USDC);
  await usdi.connect(Dave).deposit(Dave_USDC);
}

const tokenDeposits = async () => {
  await weth.connect(Bob).approve(bob_vault.address,Bob_WETH);
  await comp.connect(Carol).approve(carol_vault.address,Carol_COMP);

  await bob_vault.connect(Bob).deposit_erc20(weth_address,Bob_WETH);
  await carol_vault.connect(Carol).deposit_erc20(comp_address,Carol_COMP);

}



//*
// Initial Balances:
// Alice: 100,000,000,000 usdc ($100,000) 6dec
// Bob: 10,000,000,000,000,000,000 weth (10 weth) 18dec
// Carol: 100,000,000,000,000,000,000 (100 comp), 18dec
// Dave: 100,000,000,000 usdc ($100,000) 6dec
//
// alice is a usdc holder. She wishes to deposit her USDC to hold USDI
// bob is an eth holder. He wishes to deposit his eth and borrow USDI
// carol is a comp holder. she wishes to deposit her comp and then vote
// dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob

// configurable variables

Alice_USDC = 1e8;
Bob_WETH = ethers.utils.parseEther('10');
Carol_COMP = ethers.utils.parseEther('100');
Dave_USDC = 1e8;


describe("USDI-TOKEN:Init", ()=> {
  before('deploy contracts',setupInitial);
  it("Should return the right name, symbol, and decimals", async ()=> {
    await usdi.deployed();
    expect(await usdi.symbol()).to.equal("USDI");
    expect(await usdi.name()).to.equal("USDI Token");
    expect(await usdi.decimals()).to.equal(6);
  });
  it(`The contract creator should have ${1e6.toLocaleString()} fragment`, async ()=> {
    expect(await usdi.balanceOf(await Frank.getAddress())).to.eq(1e6)
  });
  it(`the totalSupply should be ${1e6.toLocaleString()}`, async () => {
    expect(await usdi.totalSupply()).to.eq(1e6)
  })
  it('the owner should be the Frank', async () => {
    expect(await usdi.owner()).to.eq(await Frank.getAddress())
  })
});


// deploy the oracles
describe("ORACLES:Init", ()=> {
  before('deploy oracles',setupOracles);
  it('weth price should be nonzero', async () =>{
    const price = await oraclemaster.get_live_price(weth_address);
    console.log('weth:',price.toLocaleString())
    expect(price).to.not.eq(0);
  })

  it('comp price should be nonzero', async () =>{
    const price = await oraclemaster.get_live_price(comp_address);
    console.log('comp:',price.toLocaleString())
    expect(price).to.not.eq(0);
  })
})

// deploy the vaultmaster and also mint bob and carols vaults;
describe("VAULTS:Init", ()=> {
  before('deploy vaults',setupVaults);
  it(`there should be 2 enabled currencies`, async()=>{
    expect(await vaultmaster._tokensRegistered()).to.eq(2);
  })
  it(`bobs vault should exist`,()=>{
    expect(bob_vault.address).to.not.eq(undefined)
  })

  it(`carols vault should exist`,()=>{
    expect(carol_vault.address).to.not.eq(undefined)
  })
})
// everyboth who deposits usdc to mint usdi does it here
describe("USDC-DEPOSITS", ()=>{
  before('usdc deposits', usdcDeposits);
  it(`alice should have ${Alice_USDC} usdi`, async () =>{
    expect(await usdi.balanceOf(await Alice.getAddress())).to.eq(Alice_USDC);
  })

  it(`Dave should have ${Dave_USDC} usdi`, async () =>{
    expect(await usdi.balanceOf(await Dave.getAddress())).to.eq(Dave_USDC);
  })
})

//deposits for lending here,
describe("TOKEN-DEPOSITS", () =>{
  before('token deposits', tokenDeposits);
  it(`bob should have ${Bob_WETH} deposited`, async() =>{
    expect(await bob_vault.connect(Bob).getBalances(weth.address)).to.eq(Bob_WETH)
  })
  it(`carol should have ${Carol_COMP} deposited`, async() =>{
    expect(await carol_vault.connect(Carol).getBalances(comp.address)).to.eq(Carol_COMP)
  })
})
describe("TOKEN-DEPOSITS", () =>{
  it(`bob should not be able to borrow 2*${Bob_WETH} usdi`, async ()=>{
  })
})




