import { s } from "../scope";
import {  ethers } from "hardhat";
import { expect } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number";
import {
  IVault__factory,
  GovernorCharlieDelegate,
  GovernorCharlieDelegate__factory,
  CappedGovToken__factory,
  UniswapV3TokenOracleRelay,
  AnchoredViewRelay,
  ChainlinkOracleRelay,
} from "../../../../typechain-types";
import {
  advanceBlockHeight,
  fastForward,
  mineBlock,
  OneWeek,
  OneYear,
  currentBlock
} from "../../../../util/block";
import { toNumber } from "../../../../util/math";

require("chai").should();
describe("Verify Contracts", () => {
  it("Should return the right name, symbol, and decimals", async () => {

    expect(await s.USDI.name()).to.equal("USDI Token");
    expect(await s.USDI.symbol()).to.equal("USDI");
    expect(await s.USDI.decimals()).to.equal(18);
    //expect(await s.USDI.owner()).to.equal(s.Frank.address);
    //s.owner = await s.USDI.owner()
    s.pauser = await s.USDI.pauser()
  });


  it("Check data on VaultControler", async () => {
    let tokensRegistered = await s.VaultController.tokensRegistered()
    expect(tokensRegistered).to.be.gt(0)
    let interestFactor = await s.VaultController.interestFactor()
    expect(await toNumber(interestFactor)).to.be.gt(1)

  });

  it("mint vaults for testing", async () => {
    //showBody("bob mint vault")
    await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
      .reverted;
    await mineBlock();
    s.BobVaultID = await s.VaultController.vaultsMinted()
    let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
    s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
    expect(await s.BobVault.minter()).to.eq(s.Bob.address);

    //showBody("carol mint vault")
    await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
      .reverted;
    await mineBlock();
    s.CaroLVaultID = await s.VaultController.vaultsMinted()
    vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
    s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
    expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
  });
});

describe("Deploy Cap Tokens and Oracles", () => {

  const chainlinkLDOFeed = "0x4e844125952d32acdf339be976c98e22f6f318db"
  const LDO_USDC = "0x78235D08B2aE7a3E00184329212a4d7AcD2F9985"
  const LDO_WETH_3k = "0xa3f558aebAecAf0e11cA4b2199cC5Ed341edfd74"
  const LDO_WETH_10k = "0xf4aD61dB72f114Be877E87d62DC5e7bd52DF4d9B"

  const chainlinkDYDXfeed = "0x478909D4D798f3a1F11fFB25E4920C959B4aDe0b"
  const DYDX_WETH_10k = "0xe0CfA17aa9B8f930Fd936633c0252d5cB745C2C3"

  const chainlinkCRVfeed = "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f"
  const CRV_WETH_10k = "0x4c83A7f819A5c37D64B4c5A2f8238Ea082fA1f4e"


  it("Connect to deployed contracts", async () => {
    s.CappedLDO = CappedGovToken__factory.connect("0x7C1Caa71943Ef43e9b203B02678000755a4eCdE9", s.Frank)
    s.CappedDYDX = CappedGovToken__factory.connect("0xDDB3BCFe0304C970E263bf1366db8ed4DE0e357a", s.Frank)
    s.CappedCRV = CappedGovToken__factory.connect("0x9d878eC06F628e883D2F9F1D793adbcfd52822A8", s.Frank)

  })
})


describe("Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  const bal3k = "0xDC2c21F1B54dDaF39e944689a8f90cb844135cc9"//bal/weth ~$280k liquidity, the only viable pool
  const balDataFeed = "0xdf2917806e30300537aeb49a7663062f4d1f2b5f"

  const aave3k = "0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB"//aave/weth ~$906k liqudiity, the best pool by far
  const aaveDataFeed = "0x547a514d5e3769680ce22b2361c10ea13619e8a9"




  let out: any

 

  it("just execute", async () => {
    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );

    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()
    const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
    expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")
    proposal = 11

    await impersonateAccount(proposer)
    
    await fastForward(timelock.toNumber());
    await mineBlock()

    await gov.connect(prop).execute(proposal);
    await mineBlock();

    await ceaseImpersonation(proposer)

  })

})
