import { s } from "../scope";
import { upgrades, ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import * as fs from 'fs';

import { BN } from "../../../util/number";
import {
    IVault__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    CappedGovToken__factory,
    UniswapV3TokenOracleRelay__factory,
    UniswapV3TokenOracleRelay,
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    OracleMaster__factory,
    VaultController__factory,
    VotingVaultController__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    ITestOracle__factory,
    GeneralizedBalancerOracle__factory
} from "../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
    currentBlock
} from "../../../util/block";
import { toNumber } from "../../../util/math";
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";
import { DeployContractWithProxy, DeployContract } from "../../../util/deploy";
import { BigNumber } from "ethers";

let anchorLDO: UniswapV3TokenOracleRelay
let mainLDO: ChainlinkOracleRelay
let anchorViewLDO: AnchoredViewRelay

let anchorDYDX: UniswapV3TokenOracleRelay
let mainDYDX: ChainlinkOracleRelay
let anchorViewDYDX: AnchoredViewRelay

let anchorCRV: UniswapV3TokenOracleRelay
let mainCRV: ChainlinkOracleRelay
let anchorViewCRV: AnchoredViewRelay

require("chai").should();


describe("Do a swap and see result", () =>{

  //etherscan - [{variable: 0, secs: 1400, ago: 0}]
  it("Do the thing", async () => {
      const testOracle = ITestOracle__factory.connect("0x1E19CF2D73a72Ef1332C882F20534B6519Be0276", s.Frank)
      const auth = await testOracle.getAuthorizer()

      showBody("Auth: ", auth)


      type input = {
          variable: BigNumber,
          secs: BigNumber,
          ago: BigNumber
      }

      let inp:input = {
          variable:BN("0"),
          secs:BN("14400"),
          ago:BN("0")
      }


      let result = await testOracle.getTimeWeightedAverage([inp])
      showBody("Var 0 : ", result.toString())

      inp = {
          variable:BN("1"),
          secs:BN("14400"),
          ago:BN("0")
      }

      result = await testOracle.getTimeWeightedAverage([inp])
      showBody("Var 1 : ", result.toString())

      inp = {
          variable:BN("2"),
          secs:BN("14400"),
          ago:BN("0")
      }

      result = await testOracle.getTimeWeightedAverage([inp])
      showBody("Var 2 : ", result.toString())
  })

  it("Do the swap", async () => {
    
  })

})
