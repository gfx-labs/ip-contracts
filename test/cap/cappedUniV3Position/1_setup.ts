import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody } from "../../../util/format";
import { BN } from "../../../util/number";
import { s } from "./scope";
import { d } from "../DeploymentInfo";
import { toNumber } from "../../../util/math"
import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import { BigNumber, BytesLike } from "ethers";
import { IERC20__factory, INonfungiblePositionManager__factory, IOracleRelay__factory, OracleMaster__factory, ProxyAdmin__factory, USDI__factory, VaultController__factory, VotingVaultController__factory } from "../../../typechain-types";
//import { assert } from "console";

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

require("chai").should();



if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}

describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(17167757)).to.not.throw;//16579684, 14940917
    });
    it("set automine", async () => {
        expect(await network.provider.send("evm_setAutomine", [true])).to.not
            .throw;
    });
});

describe("Token Setup", () => {
    it("connect to signers", async () => {
        let accounts = await ethers.getSigners();
        s.Frank = accounts[0];
        s.Eric = accounts[5];
        s.Andy = accounts[6];
        s.Bob = accounts[7];
        s.Carol = accounts[8];
        s.Dave = accounts[9];
        s.Gus = accounts[10];
    });
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank)
        s.WETH = IERC20__factory.connect(s.wethAddress, s.Frank)
        s.WBTC = IERC20__factory.connect(s.wbtcAddress, s.Frank)
        s.wethOracle = IOracleRelay__factory.connect(s.wethOracleAddr, s.Frank)


    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)

        const vvc = "0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2"
        s.VotingVaultController = VotingVaultController__factory.connect(vvc, s.Frank)


    })
    it("Should succesfully transfer money", async () => {
        let usdc_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
        const wbtc_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28"
        let weth_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";

        await stealMoney(usdc_minter, s.Frank.address, s.USDC.address, s.USDC_AMOUNT)
        await stealMoney(usdc_minter, s.Bob.address, s.USDC.address, s.USDC_AMOUNT.mul(10))
        await stealMoney(usdc_minter, s.Carol.address, s.USDC.address, s.USDC_AMOUNT)
        await stealMoney(usdc_minter, s.Dave.address, s.USDC.address, s.USDC_AMOUNT.mul(5))

        await stealMoney(weth_minter, s.Bob.address, s.WETH.address, s.WETH_AMOUNT)
        await stealMoney(wbtc_minter, s.Bob.address, s.wbtcAddress, s.wBTC_Amount)

    })




});

describe("Mint position", () => {
    const nfpManagerAddr = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
    const nfpManager = INonfungiblePositionManager__factory.connect(nfpManagerAddr, s.Frank)
    const wETHwBTC_pool_addr = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD"


    //const token0 = s.WBTC
    //const token1 = s.WETH
    it("Approve", async () => {
        await s.WBTC.connect(s.Bob).approve(nfpManagerAddr, s.wBTC_Amount)
        await s.WETH.connect(s.Bob).approve(nfpManagerAddr, s.WETH_AMOUNT)
    })

    it("Create instance of pool", async () => {
        const poolContract = new ethers.Contract(
            wETHwBTC_pool_addr,
            POOL_ABI,
            ethers.provider
        )
        const [token0, token1, fee, tickSpacing, liquidity, slot0] =
            await Promise.all([
                poolContract.token0(),
                poolContract.token1(),
                poolContract.fee(),
                poolContract.tickSpacing(),
                poolContract.liquidity(),
                poolContract.slot0(),
            ])

        const pool = new Pool(
            token0,
            token1,
            fee,
            slot0[0],
            liquidity,
            slot0[1]
        )

        const nut = nearestUsableTick(slot0[1], tickSpacing)
        const tickLower = nut - (tickSpacing * 2)
        const tickUpper = nut + (tickSpacing * 2)
        showBody(tickLower)
        showBody(tickUpper)

    })
})