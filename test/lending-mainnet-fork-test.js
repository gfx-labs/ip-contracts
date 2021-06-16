const { expect } = require("chai");

const DECIMALS = 6;
const TOTAL_GONS = ethers.BigNumber.from(10).pow(34)

const dollars = (n)=>{
  return ethers.BigNumber.from(n).mul(ethers.BigNumber.from(10).pow(6))
}

const wethabi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"guy","type":"address"},{"name":"wad","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"src","type":"address"},{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"deposit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"guy","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Withdrawal","type":"event"}]

const WHOLE = dollars(1);
const HALF = WHOLE.div(2)

const INITIAL_DEPOSIT = dollars(100);


let WETH;
let weth;
let USDI;
let usdi;
let accounts;
let USDC;
let usdc
let Lender;
let lender;
let deployer;

let OracleMaster;
let oraclemaster;
let UniswapRelay;
let uniswaprelay;

let _reserveAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
let A;

let A_USDC_BALANCE = dollars(10000);

const transfer = async (token,from,to,amount) =>{
  return token.connect(from).transfer(await to.getAddress(),amount)
}

const allowAndTransfer = async (token,sender,from,to,amount) =>{
  await token.connect(from).increaseAllowance(await sender.getAddress(),WHOLE)
  return token.connect(sender).transferFrom(from,to,amount)
}

let minter = "0x55FE002aefF02F77364de339a1292923A15844B8";

let weth_addr = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
let pool_addr = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";

const setupContracts = async ()=>{
  accounts = await ethers.getSigners()
  deployer = accounts[0]
  A = accounts[1]

  WETH = await ethers.getContractAt(wethabi,weth_addr,deployer);
  weth = await WETH.connect(deployer);

  await deployer.sendTransaction({
    from: await deployer.getAddress(),
    to:weth_addr,
    value: ethers.utils.parseEther("1")
  })
  await A.sendTransaction({
    from: await A.getAddress(),
    to:weth_addr,
    value: ethers.utils.parseEther("1")
  })

  USDI = await ethers.getContractFactory('USDI');
  usdi = await USDI.deploy(_reserveAddress);

  Lender = await ethers.getContractFactory("Lender");
  lender = await Lender.deploy(usdi.address,weth_addr);
  await lender.deployed();
  await A.sendTransaction({
    from: await A.getAddress(),
    to: minter,
    value: ethers.utils.parseEther("100")
  });
  await usdi.connect(deployer).setLender(lender.address);
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [minter]}
  )
  USDC = await ethers.getContractFactory("tUSDC");
  usdc = await USDC.attach(_reserveAddress)
  const signer = await ethers.provider.getSigner(minter);
  await usdc.connect(signer).transfer(await A.getAddress(),A_USDC_BALANCE);
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [minter]}
  )
}

const depositUSDC = async () => {
  await weth.connect(A).approve(lender.address,ethers.utils.parseEther('1'));
  await usdi.connect(A).increaseAllowance(lender.address,500);
  await lender.connect(A).deposit(weth.address,ethers.utils.parseEther('1'));
  await lender.connect(A).borrow(1000);
};

const setupUniswapRelay = async ()=>{
  UniswapRelay = await ethers.getContractFactory('UniswapV3OracleRelay');
  uniswaprelay = await UniswapRelay.deploy("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",true);
}

const setupMasterOracle = async () =>{
  OracleMaster = await ethers.getContractFactory('OracleMaster');
  oraclemaster= await OracleMaster.deploy();

  await oraclemaster.connect(deployer).create_oracle(weth_addr);
  await oraclemaster.connect(deployer).add_relay(0,uniswaprelay.address);
  await lender.connect(deployer).setOracleAddress(oraclemaster.address);
}

describe("Lender:Init", ()=> {
  before('deploy contracts',setupContracts);
  it('there should be 0 open accounts', async () => {
    expect(await lender._openAccounts()).to.eq(0);
  })
});

describe("Lender:Deposit", ()=> {
  before('deploy contracts',depositUSDC);
  it('there should be 1 open account', async () => {
    expect(await lender._openAccounts()).to.eq(1);
  })

  it('there should be 1 WETH balance after deposit', async () => {
    expect(await lender.getBalance(await A.getAddress(),weth.address)).to.eq(ethers.utils.parseEther('1'));
  })

  it('there should be 1000 usdi balance after borrow', async () => {
    expect(await usdi.balanceOf(await A.getAddress())).to.eq(1000);
  })

  it('there should be 501 usdi balance & liability after repay', async () => {
    await lender.connect(A).repay(500);
    expect(await usdi.balanceOf(await A.getAddress())).to.eq(500);
    expect(await lender.liabilityOf(await A.getAddress())).to.eq(500);
  })
});


describe("Lender:Interest", ()=> {
  it('there should be 1000 usdi balance after the interest rate constant becomes doubled', async () => {
    await lender.connect(deployer).setOwedPerBase(2e12);
    expect(await lender.liabilityOf(await A.getAddress())).to.eq(1000);
    await lender.connect(deployer).setOwedPerBase(1e12);
  })
})

describe("Lender:Health", ()=> {

  before('deploy relay',setupUniswapRelay);
  before('deploy master',setupMasterOracle);

  it('the lender should have a healthy balance', async () => {
    expect(await lender.connect(A).checkAddress(await A.address)).to.eq(true);
  })

  it('the lender should have a unhealthy balance after withdrawing all their money', async () => {
    await lender.connect(A).withdraw(weth.address,ethers.utils.parseEther('1'));
    expect(await lender.connect(A).checkAddress(await A.address)).to.eq(false);
  })
})
