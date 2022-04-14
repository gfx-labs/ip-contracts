import { s } from "./scope";
import { ethers, upgrades } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../util/format";
import { BN } from "../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "../util/block";

import {
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    CurveMaster,
    CurveMaster__factory,
    IERC20,
    IERC20__factory,
    IOracleRelay,
    OracleMaster,
    OracleMaster__factory,
    ThreeLines0_100,
    ThreeLines0_100__factory,
    UniswapV3OracleRelay__factory,
    USDI,
    USDI__factory,
    Vault,
    VaultController,
    VaultController__factory,
    IVOTE,
    IVOTE__factory,
} from "../../typechain-types";
describe("Test upgradeable", () => {

    let vc: any
    it("Deploy USDI core as Proxy`", async () => {
        showBody("deploying usdi as proxy")
        const bn = await ethers.provider.getBlockNumber()
        showBody(bn)
        let factory = await ethers.getContractFactory("VaultController")
        vc = await upgrades.deployProxy(factory)
        

    })

})