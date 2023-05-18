import { s } from "./scope";
import { d } from "../DeploymentInfo";
import { upgrades, ethers } from "hardhat";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear, hardhat_mine, hardhat_mine_timed } from "../../../util/block";
import { utils, BigNumber, BigNumberish } from "ethers";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber, getGas, getArgs } from "../../../util/math"
import { stealMoney } from "../../../util/money";

import {
  AnchoredViewRelay__factory,
  BPT_WEIGHTED_ORACLE__factory,
  CappedBptToken__factory,
  IOracleRelay,
  IVault__factory,
  UniswapV3TokenOracleRelay__factory,
  VaultBPT__factory,
  WstETHRelay__factory,
  RateProofOfConcept__factory,
  IOracleRelay__factory,
  BPTstablePoolOracle__factory,
  INFPmanager__factory,
  INonfungiblePositionManager__factory,
  UniV3LPoracle__factory,
  Univ3CollateralToken__factory,
  NftVaultController__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegate,
  OracleMaster__factory,
  VaultController__factory,
  V3PositionValuator,
  V3PositionValuator__factory
} from "../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
import { PromiseOrValue } from "../../../typechain-types/common";

import {
  abi as FACTORY_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import {
  abi as POOL_ABI,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import {
  abi as ROUTERV3,
} from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"
import {
  MintOptions,
  nearestUsableTick,
  NonfungiblePositionManager,
  Pool,
  Position,
} from '@uniswap/v3-sdk'
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";
const nfpManagerAddr = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const wETHwBTC_pool_addr = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD"

require("chai").should();
describe("Check Interest Protocol contracts", () => {
  describe("Sanity check USDi deploy", () => {
    it("Should return the right name, symbol, and decimals", async () => {

      expect(await s.USDI.name()).to.equal("USDI Token");
      expect(await s.USDI.symbol()).to.equal("USDI");
      expect(await s.USDI.decimals()).to.equal(18);
      //expect(await s.USDI.owner()).to.equal(s.Frank.address);
      //s.GOV = await s.USDI.owner()
      s.pauser = await s.USDI.pauser()
    });
  });

  describe("Sanity check VaultController deploy", () => {
    it("Check data on VaultControler", async () => {
      let tokensRegistered = await s.VaultController.tokensRegistered()
      expect(tokensRegistered).to.be.gt(0)
      let interestFactor = await s.VaultController.interestFactor()
      expect(await toNumber(interestFactor)).to.be.gt(1)

    });

    it("Mint vault for Bob", async () => {
      await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
        .reverted;
      await mineBlock();
      s.BobVaultID = await s.VaultController.vaultsMinted()
      let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
      s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
      expect(await s.BobVault.minter()).to.eq(s.Bob.address);
    })

    it("Mint vault for Carol", async () => {

      const result = await s.VaultController.connect(s.Carol).mintVault()
      const gas = await getGas(result)
      showBodyCyan("Gas to mint standard vault: ", gas)

      s.CaroLVaultID = await s.VaultController.vaultsMinted()
      let vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
      s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
      expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
    })



  });
});

type MintParams = {
  token0: PromiseOrValue<string>,
  token1: PromiseOrValue<string>,
  fee: PromiseOrValue<BigNumberish>,
  tickLower: PromiseOrValue<BigNumberish>,
  tickUpper: PromiseOrValue<BigNumberish>,
  amount0Desired: PromiseOrValue<BigNumberish>,
  amount1Desired: PromiseOrValue<BigNumberish>,
  amount0Min: PromiseOrValue<BigNumberish>,
  amount1Min: PromiseOrValue<BigNumberish>,
  recipient: PromiseOrValue<string>,
  deadline: PromiseOrValue<BigNumberish>
}
let targetAmount: BigNumber

describe("Mint position", () => {
  //const token0 = s.WBTC
  //const token1 = s.WETH
  it("Approve", async () => {
    await s.WBTC.connect(s.Bob).approve(nfpManagerAddr, s.wBTC_Amount)
    await s.WETH.connect(s.Bob).approve(nfpManagerAddr, s.WETH_AMOUNT)
  })

  it("Create instance of pool", async () => {
    s.nfpManager = INonfungiblePositionManager__factory.connect(nfpManagerAddr, s.Frank)

    const poolContract = new ethers.Contract(
      wETHwBTC_pool_addr,
      POOL_ABI,
      ethers.provider
    )
    const [fee, tickSpacing, slot0] =
      await Promise.all([
        poolContract.fee(),
        poolContract.tickSpacing(),
        poolContract.slot0(),
      ])
    //showBody(slot0)

    /**
       const pool = new Pool(
          token0,
          token1,
          fee,
          slot0[0],
          liquidity,
          slot0[1]
      )
     */



    const nut = nearestUsableTick(slot0[1], tickSpacing)
    const tickLower = nut - (tickSpacing * 2)
    const tickUpper = nut + (tickSpacing * 2)


    //const intermediary = await new TestContract__factory(s.Frank).deploy()
    //await intermediary.deployed()

    const block = await currentBlock()

    const params: MintParams = {
      token0: s.WBTC.address,
      token1: s.WETH.address,
      fee: fee,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: s.wBTC_Amount,
      amount1Desired: s.WETH_AMOUNT,
      amount0Min: BN("0"),
      amount1Min: BN("0"),
      recipient: s.Bob.address,
      deadline: block.timestamp + 500
    }

    //mint position
    const result = await s.nfpManager.connect(s.Bob).mint(params)
    await hardhat_mine_timed(500, 15)
    const args = await getArgs(result)

    expect(await s.nfpManager.balanceOf(s.Bob.address)).to.eq(BN("1"), "Bob has 1 NFT")


    //derive value based on price
    let p0: BigNumber = (await s.wbtcOracle.currentValue()).div(BN("1e10"))
    let p1: BigNumber = await s.wethOracle.currentValue()

    let v0: BigNumber = (p0.mul(BN(args.amount0))).div(BN("1e18"))
    let v1: BigNumber = (p1.mul(BN(args.amount1))).div(BN("1e18"))
    targetAmount = v1.add(v0)
    showBodyCyan("Target: ", await toNumber(targetAmount))
    const tokenId = args.tokenId
    s.BobPositionId = tokenId
    await mineBlock()

    const manager = INFPmanager__factory.connect(nfpManagerAddr, s.Frank)
    const [
      nonce,
      operator,
      token0,
      token1,
      _fee,
      tLow,
      tUp,
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1
    ] = await s.nfpManager.positions(tokenId)

    //showBody("TokensOwed0: ", tokensOwed0)
    //showBody("TokensOwed1: ", tokensOwed1)
    //showBody("liquidity: ", await toNumber(liquidity))

  })
})
let UniV3LPoracle: IOracleRelay

describe("deploy oracles and cap tokens", () => {
  let positionValuator: V3PositionValuator

  it("deploly oracles", async () => {
    UniV3LPoracle = await new UniV3LPoracle__factory(s.Frank).deploy(
      wETHwBTC_pool_addr,
      s.wbtcOracle.address,
      s.wethOracle.address,
      await s.WBTC.decimals(),
      await s.WETH.decimals()
    )
    await UniV3LPoracle.deployed()

    //showBody(await toNumber(await UniV3LPoracle.currentValue()))
  })

  it("Deploy nft vault controller", async () => {
    s.NftVaultController = await DeployContractWithProxy(
      new NftVaultController__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      s.VaultController.address
    )
    await s.NftVaultController.deployed()
    await s.NftVaultController.transferOwnership(s.GOV._address)
  })

  it("Deploy position valuator", async () => {
    positionValuator = await new V3PositionValuator__factory(s.Frank).deploy(
      wETHwBTC_pool_addr,
      s.wbtcOracle.address,
      s.wethOracle.address,
      await s.WBTC.decimals(),
      await s.WETH.decimals()
    )
    await positionValuator.deployed()
  })

  it("Deploy cap token", async () => {

    s.CappedPosition = await DeployContractWithProxy(
      new Univ3CollateralToken__factory(s.Frank),
      s.Frank,
      s.ProxyAdmin,
      "Capped V3 Position",
      "cV3Pos",
      nfpManagerAddr,
      s.VaultController.address,
      s.NftVaultController.address,
      positionValuator.address
    )
    await s.CappedPosition.deployed()

  })
})

describe("Setup, Queue and Execute proposal", () => {
  const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
  const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064"//0xa6e8772af29b29b9202a073f8e36f447689beef6 ";
  const prop = ethers.provider.getSigner(proposer)

  let gov: GovernorCharlieDelegate;

  let proposal: number

  let out: any

  //connect to gov
  before(async () => {
    gov = new GovernorCharlieDelegate__factory(prop).attach(
      governorAddress
    );
  })

  it("Makes the proposal", async () => {
    const proposal = new ProposalContext("Uni V3 Position")

    const addOracle = await new OracleMaster__factory(prop).
      attach(s.Oracle.address).
      populateTransaction.setRelay(
        s.CappedPosition.address,
        UniV3LPoracle.address
      )

    const list = await new VaultController__factory(prop).
      attach(s.VaultController.address).
      populateTransaction.registerErc20(
        s.CappedPosition.address,
        s.LTV,
        s.CappedPosition.address,
        s.LiquidationIncentive
      )

    const registerNftController = await new NftVaultController__factory(prop).
      attach(s.NftVaultController.address).
      populateTransaction.registerUnderlying(s.CappedPosition.address, nfpManagerAddr)

    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(list, "registerErc20(address,uint256,address,uint256)")

    //todo this is not working for some reason
    //proposal.addStep(registerNftController, "registerNftController(address,address)")

    out = proposal.populateProposal()

  })


  it("test execution", async () => {
    //fund governor to make TXs
    const tx = {
      to: gov.address,
      value: BN("1e18")
    }
    await s.Frank.sendTransaction(tx)

    await impersonateAccount(s.GOV._address)
    /**
     await s.Oracle.connect(s.GOV).setRelay(s.CappedPosition.address, UniV3LPoracle.address)
    await s.VaultController.connect(s.GOV).registerErc20(
      s.CappedPosition.address,
      s.LTV,
      s.CappedPosition.address,
      s.LiquidationIncentive
    )
     */

    await s.NftVaultController.connect(s.GOV).registerUnderlying(
      s.CappedPosition.address,
      nfpManagerAddr
    )

    await ceaseImpersonation(s.GOV._address)
  })



  it("queue and execute", async () => {
    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()
    const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
    expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")

    await impersonateAccount(proposer)
    await gov.connect(prop).propose(
      out.targets,
      out.values,
      out.signatures,
      out.calldatas,
      "B-stETH-STABLE-gauge",
      false
    )
    await mineBlock()
    proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...")
    await hardhat_mine(votingDelay.toNumber());

    await gov.connect(prop).castVote(proposal, 1)
    await mineBlock()

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber());
    await mineBlock()

    await gov.connect(prop).queue(proposal);
    await mineBlock()
    showBody("Queued")

    await fastForward(timelock.toNumber());
    await mineBlock()
    showBody("bouda execute")

    await gov.connect(prop).execute(proposal);
    await mineBlock();

    showBody("done")

    await ceaseImpersonation(proposer)
  })

})