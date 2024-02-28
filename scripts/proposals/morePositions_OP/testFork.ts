import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    V3PositionValuator,
    V3PositionValuator__factory,
    IERC20,
    IERC20__factory,
    INonfungiblePositionManager,
    INonfungiblePositionManager__factory,
    Univ3CollateralToken,
    Univ3CollateralToken__factory,
    VaultController__factory,
    VaultController,
    NftVaultController__factory,
    NftVaultController,
    VaultNft,
    VaultNft__factory,
    IV3Pool__factory,
    ISwapRouter__factory,
    IUniswapV3Pool__factory,
    IOracleRelay__factory
} from "../../../typechain-types"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { currentBlock, hardhat_mine_timed, resetCurrentOP, resetCustom, resetOP } from "../../../util/block"
import { OptimisimDeploys, oa, od } from "../../../util/addresser"
import { stealMoney } from "../../../util/money"
import { mintPosition, valueOwnedPosition, valuePosition } from "../../../util/msc"
import { expect } from "chai"
import { BigNumber, providers } from "ethers"
import { showBody, showBodyCyan } from "../../../util/format"
import { toNumber } from "../../../util/math"
import axios from "axios"
import Decimal from "decimal.js"
import { ExactInputSingleParams, listings } from "./poolData"
import { IWETH__factory } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts"
const { ethers } = require("hardhat")
const d = new OptimisimDeploys()

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const ownerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
const owner = ethers.provider.getSigner(ownerAddr)



require("chai").should();
describe("Testing", () => {
    let nfpManager: INonfungiblePositionManager
    let V3PositionValuator: V3PositionValuator
    let wrapper: Univ3CollateralToken
    let VaultController: VaultController
    let nftController: NftVaultController

    let signer: SignerWithAddress
    let WETH: IERC20
    let OP: IERC20
    let positionId: BigNumber
    let vaultId: number
    let nftVault: VaultNft


    const ethAmount = BN("5e17")

    let positions: number[] = []

    before(async () => {
        //run with --network tenderly
        //https://docs.tenderly.co/forks/sending-transactions-to-forks
        //https://rpc.tenderly.co/fork/52e8b21e-4477-42e0-a2ff-0d4e6e972a23
        //await resetCustom("https://rpc.tenderly.co/fork/aa5229b9-09be-4887-ac17-f57339649b80")
        //await resetCurrentOP()

        //reset to final proposal transaction from tenderly
        await ethers.provider.send("evm_revert", ["cc43df76-8186-406d-81d8-8d88f1a4e807"])


        const signers = await ethers.getSigners()
        signer = signers[0]

        nfpManager = INonfungiblePositionManager__factory.connect(oa.nfpManager, signer)
        wrapper = Univ3CollateralToken__factory.connect(od.WrappedPosition, signer)
        V3PositionValuator = V3PositionValuator__factory.connect(od.V3PositionValuator, owner)
        VaultController = VaultController__factory.connect(od.VaultController, signer)
        nftController = NftVaultController__factory.connect(od.NftController, signer)

        WETH = IERC20__factory.connect(oa.wethAddress, signer)
        OP = IERC20__factory.connect(oa.opAddress, signer)

        //await stealMoney(weth_minter, signer.address, WETH.address, wethAmount)

        let op_minter = "0xEbe80f029b1c02862B9E8a70a7e5317C06F62Cae"
        // await stealMoney(op_minter, signer.address, oa.opAddress, opAmount)



    })

    /**
     * tenderly set balance of signer
     * wrap to weth
     * swap for token on the given pool
     * make position
     * check value both ways
     */
    it("setup balances", async () => {

        await ethers.provider.send('tenderly_addBalance', [
            [signer.address],
            ethers.utils.hexValue(ethers.utils.parseUnits('10', 'ether').toHexString())
        ])

        expect(await toNumber(await ethers.provider.getBalance(signer.address))).to.be.gt(9.999, "Ether had")

    })

    it("Do the swaps to fund, and mint positions", async () => {

        const router = ISwapRouter__factory.connect("0xE592427A0AEce92De3Edee1F18E0157C05861564", signer)

        //wrap 10 eth => weth
        const WETH_CONTRACT = IWETH__factory.connect(oa.wethAddress, signer)
        await WETH_CONTRACT.connect(signer).deposit({ value: BN("10e18") })

        expect(await toNumber(await WETH.balanceOf(signer.address))).to.eq(10, "Weth deposit")

        showBodyCyan("Swapping eth for tokens...")
        for (let i = 0; i < listings.length; i++) {

            const pool = IUniswapV3Pool__factory.connect(listings[i].addr, signer)

            let token0 = IERC20__factory.connect(await pool.token0(), signer)
            let token1 = IERC20__factory.connect(await pool.token1(), signer)

            let tokenIn: IERC20
            let tokenOut: IERC20

            let zf1 = true

            if ((await pool.token0()).toString() == oa.wethAddress) {
                tokenIn = token0
                tokenOut = token1
            } else {
                tokenIn = token1
                tokenOut = token0
                zf1 = false
            }

            const EIS_Params: ExactInputSingleParams = {
                tokenIn: tokenIn.address,
                tokenOut: tokenOut.address,
                fee: await pool.fee(),
                recipient: signer.address,
                deadline: (await currentBlock()).timestamp + 120,
                amountIn: ethAmount,
                amountOutMinimum: BN("0"),
                sqrtPriceLimitX96: BN("0"),
            }

            await tokenIn.connect(signer).approve(router.address, EIS_Params.amountIn)
            await router.connect(signer).exactInputSingle(EIS_Params)

            let amount0: BigNumber
            let amount1: BigNumber

            if (zf1) {
                amount0 = ethAmount
                amount1 = await token1.balanceOf(signer.address)
            } else {
                amount0 = await token0.balanceOf(signer.address)
                amount1 = ethAmount
            }

            //mint positions
            const pid = await mintPosition(
                listings[i].addr,
                token0,
                token1,
                amount0,
                amount1,
                signer
            )
            positions.push(Number(pid))
            console.log("Finished ", i)
        }
        showBodyCyan("Done")
    })

    it("Compare pool value", async () => {

        showBodyCyan("Testing Values.....")
        for (let i = 0; i < positions.length; i++) {
            expect(await V3PositionValuator.registeredPools(listings[i].addr)).to.eq(true, "Pool registered")

            const valuation = await V3PositionValuator.getValue(positions[i])
            
            //this also liquidates the position
            const actual = await valueOwnedPosition(
                Number(positions[i]),
                IOracleRelay__factory.connect(listings[i].oracle0, signer),
                IOracleRelay__factory.connect(listings[i].oracle1, signer),
                nfpManager,
                signer
            )

            expect(await toNumber(valuation)).to.be.closeTo(await toNumber(actual), 5, "Accurate")

            const data = await nfpManager.positions(Number(positions[i]))
            expect(data.liquidity).to.eq(0, `Position ${positions[i]} closed`)
        }
    })
})