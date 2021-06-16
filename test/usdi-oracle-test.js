const { expect } = require("chai");

const DECIMALS = 6;
const TOTAL_GONS = ethers.BigNumber.from(10).pow(34)

const dollars = (n)=>{
  return ethers.BigNumber.from(n).mul(ethers.BigNumber.from(10).pow(6))
}

const weth_addr = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

let accounts;
let Relay
let relay
let deployer;

let A;

const first = async ()=>{
   accounts = await ethers.getSigners()
   deployer = accounts[0]
   A = accounts[1]
}

const setupUniswapRelay = async ()=>{
  Relay = await ethers.getContractFactory('UniswapV3OracleRelay');
  relay = await Relay.deploy("0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",true);
}

const setupMasterOracle = async () =>{
  OracleMaster = await ethers.getContractFactory('OracleMaster');
  oraclemaster= await OracleMaster.deploy();

  await oraclemaster.connect(deployer).create_oracle(weth_addr);
  await oraclemaster.connect(deployer).add_relay(0,relay.address);
}


describe("ORACLE-RELAY-UNISWAP:", ()=> {
  before('deploy contracts',first);
  before('deploy contracts',setupUniswapRelay);
  it('fetch eth price', async () => {
    let dog = await relay.currentValue();
    console.log("eth price:",dog.div(1e10).toNumber()/100)
    expect(1).to.eq(1);
    //expect(await usdi.owner()).to.eq(await deployer.getAddress())
  })
});



describe("ORACLE-MASTER:", ()=> {
  before('setup master oracle',setupMasterOracle);
  it('fetch eth price', async () => {
    let dog = await oraclemaster.get_live_priceE12(weth_addr);
    console.log("eth price:",dog.div(1e10).toNumber()/100)
    expect(1).to.eq(1);
    //expect(await usdi.owner()).to.eq(await deployer.getAddress())
  })
});

