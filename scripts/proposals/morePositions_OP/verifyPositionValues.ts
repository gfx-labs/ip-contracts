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
    VaultNft, IOracleRelay__factory, ISwapRouter__factory, IUniswapV3Pool__factory, VaultNft__factory
} from "../../../typechain-types"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { currentBlock, hardhat_mine, resetCurrentOP, resetOP } from "../../../util/block"
import { oa, od } from "../../../util/addresser"
import { stealMoney } from "../../../util/money"
import { mintPosition, valuePosition } from "../../../util/msc"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { showBody, showBodyCyan } from "../../../util/format"
import { toNumber } from "../../../util/math"
import { setBalance } from "@nomicfoundation/hardhat-network-helpers"
import { ExactInputSingleParams, listings } from "./poolData"
import { hexlify } from "ethers/lib/utils"
import axios from "axios"
import Decimal from "decimal.js"
const { ethers } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const ownerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
const owner = ethers.provider.getSigner(ownerAddr)

let positions: number[] = []

require("chai").should();
describe("Testing", () => {
    let nfpManager: INonfungiblePositionManager
    let V3PositionValuator: V3PositionValuator
    let wrapper: Univ3CollateralToken
    let VaultController: VaultController
    let nftController: NftVaultController

    let signer: SignerWithAddress
    let whale: SignerWithAddress
    let WETH: IERC20
    let OP: IERC20
    let WBTC: IERC20
    let SNX: IERC20
    let USDC1: IERC20
    let USDC2: IERC20
    let wstETH: IERC20

    let positionId: BigNumber
    let vaultId: number
    let nftVault: VaultNft

    //all amounts should be ~500 USD
    const wethAmount = BN("2e17")
    const opAmount = BN("135e18")
    const wbtcAmount = BN("1e6")
    const wstEthAmount = BN("15e16")
    const snxAmount = BN("145e18")
    const usdcAmount = BN("500e6")

    const mintAllPositions = async () => {
        showBodyCyan("Minting Positions....")
        const wethOpId = await mintPosition(listings[0].addr, WETH, OP, wethAmount, opAmount, signer)
        const wstEthWethId = await mintPosition(listings[1].addr, wstETH, WETH, wstEthAmount, wethAmount, signer)
        const usdcWethId = await mintPosition(listings[2].addr, USDC2, WETH, usdcAmount, wethAmount, signer)//usdc2
        const wethOp500Id = await mintPosition(listings[3].addr, WETH, OP, wethAmount, opAmount, signer)
        const wethSnxId = await mintPosition(listings[4].addr, WETH, SNX, wethAmount, snxAmount, signer)
        const wethWbtcId = await mintPosition(listings[5].addr, WETH, WBTC, wethAmount, wbtcAmount, signer)
        const wethUsdcId = await mintPosition(listings[6].addr, WETH, USDC1, wethAmount, usdcAmount, signer)//usdc1

        positions.push(Number(wethOpId))
        positions.push(Number(wstEthWethId))
        positions.push(Number(usdcWethId))
        positions.push(Number(wethOp500Id))
        positions.push(Number(wethSnxId))
        positions.push(Number(wethWbtcId))
        positions.push(Number(wethUsdcId))

    }

    before(async () => {
        await resetCurrentOP()
        const signers = await ethers.getSigners()
        signer = signers[0]
        whale = signers[1]

        nfpManager = INonfungiblePositionManager__factory.connect(oa.nfpManager, signer)
        wrapper = Univ3CollateralToken__factory.connect(od.WrappedPosition, signer)
        V3PositionValuator = V3PositionValuator__factory.connect(od.V3PositionValuator, owner)
        VaultController = VaultController__factory.connect(od.VaultController, signer)
        nftController = NftVaultController__factory.connect(od.NftController, signer)

        WETH = IERC20__factory.connect(oa.wethAddress, signer)
        OP = IERC20__factory.connect(oa.opAddress, signer)
        WBTC = IERC20__factory.connect(oa.wbtcAddress, signer)
        wstETH = IERC20__factory.connect(oa.wstethAddress, signer)
        SNX = IERC20__factory.connect(oa.snxAddress, signer)
        USDC1 = IERC20__factory.connect(oa.usdcAddress, signer)
        USDC2 = IERC20__factory.connect(oa.circleUSDCaddress, signer)//circle USDC


    })

    it("List all positions", async () => {
        //get owner
        const ownerAddr = await V3PositionValuator.owner()
        const owner = ethers.provider.getSigner(ownerAddr)

        //fund
        await setBalance(ownerAddr, BN("1e18"))

        await impersonateAccount(ownerAddr)

        for (const pool of listings) {

            await V3PositionValuator.connect(owner).registerPool(
                pool.addr,
                pool.oracle0,
                pool.oracle1
            )

        }

        await ceaseImpersonation(ownerAddr)
    })

    /**
  it("Compare to oku api", async () => {
         const url = "https://cush.apiary.software/optimism"
         const pool = listings[5]
         const request = {
             "jsonrpc": "2.0",
             "method": "cush_topPositions",
             "params": [
                 {
                     "limit": 5,
                     "sort_by": "total_value_current_usd",
                     "pool": pool.addr
                 }
             ],
             "id": 0
         }   
 
         console.log("Posting...")
         const response = await axios.post(url, request)
         const payload = response.data.result.positions
 
         //console.log(payload[0].token_id)
 
        type poolData = {
             positionId: number,
             valueUsd: Decimal
        }
 
         let data: poolData[] = []
 
         for (let i = 0; i<payload.length; i++){
             data.push({
                 positionId: payload[i].token_id,
                 valueUsd: payload[i].total_value_current_usd
             })
 
             //compare data to current value
             console.log("Position ID: ", payload[i].token_id)
             console.log("Current valueUsd: ", payload[i].total_value_current_usd)
             console.log("Valuator value  : ", await toNumber(await V3PositionValuator.getValue(payload[i].token_id)))
 
             //get actual value
             const rawValue = await valuePosition(
                 payload[i].token_id,
                 IOracleRelay__factory.connect(pool.oracle0, signer),
                 IOracleRelay__factory.connect(pool.oracle1, signer),
                 nfpManager,
                 signer
             )
             console.log("Actual value: ", await toNumber(rawValue))
 
 
             console.log(" ")
         }
     })
     */


    it("Fund", async () => {
        const weth_minter = "0x274d9E726844AB52E351e8F1272e7fc3f58B7E5F"
        const op_minter = "0xEbe80f029b1c02862B9E8a70a7e5317C06F62Cae"
        const usdc1Minter = "0xf977814e90da44bfa03b6295a0616a897441acec"
        const usdc2Minter = "0x7809621a6d7e61e400853c64b61568aa773a28ef"
        const snxMinter = "0xf977814e90da44bfa03b6295a0616a897441acec"
        const wbtcMinter = "0x33865e09a572d4f1cc4d75afc9abcc5d3d4d867d"
        const wstEthMinter = "0x26aab17f27cd1c8d06a0ad8e4a1af8b1032171d5"

        //steal 2 x all amounts so we can make more diverse positions
        await stealMoney(weth_minter, signer.address, WETH.address, wethAmount.mul(14))//steal weth x 7 (all pools use it)
        await stealMoney(op_minter, signer.address, oa.opAddress, opAmount.mul(4))//2 op pools
        await stealMoney(usdc1Minter, signer.address, oa.usdcAddress, usdcAmount.mul(2))
        await stealMoney(usdc2Minter, signer.address, oa.circleUSDCaddress, usdcAmount.mul(2))
        await stealMoney(snxMinter, signer.address, oa.snxAddress, snxAmount.mul(2))
        await stealMoney(wbtcMinter, signer.address, oa.wbtcAddress, wbtcAmount.mul(2))
        await stealMoney(wstEthMinter, signer.address, oa.wstethAddress, wstEthAmount.mul(2))

        //fund whale
        const factor = 100
        await stealMoney(weth_minter, whale.address, WETH.address, wethAmount.mul(factor * 14))//steal weth x 7 (all pools use it)
        await stealMoney(op_minter, whale.address, oa.opAddress, opAmount.mul(factor * 4))//2 op pools
        await stealMoney(usdc1Minter, whale.address, oa.usdcAddress, usdcAmount.mul(factor * 2))
        await stealMoney(usdc2Minter, whale.address, oa.circleUSDCaddress, usdcAmount.mul(factor * 2))
        await stealMoney(snxMinter, whale.address, oa.snxAddress, snxAmount.mul(factor * 2))
        await stealMoney(wbtcMinter, whale.address, oa.wbtcAddress, wbtcAmount.mul(factor * 2))
        await stealMoney(wstEthMinter, whale.address, oa.wstethAddress, wstEthAmount.mul(factor * 2))


    })

    it("Test valu func", async () => {

        const testPosition = await mintPosition(listings[0].addr, WETH, OP, wethAmount, opAmount, signer)

        const valuation = await V3PositionValuator.getValue(testPosition)
        const actual = await valuePosition(
            testPosition,
            IOracleRelay__factory.connect(listings[0].oracle0, signer),
            IOracleRelay__factory.connect(listings[0].oracle1, signer),
            nfpManager,
            signer
        )

        expect(await toNumber(valuation)).to.be.closeTo(await toNumber(actual), 5, "Accurate")
    })
    it("Verify values of all positions", async () => {

        //mint positions
        await mintAllPositions()
        showBodyCyan("Testing Values.....")
        for (let i = 0; i < positions.length; i++) {
            const valuation = await V3PositionValuator.getValue(positions[i])
            //this also liquidates the position
            const actual = await valuePosition(
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
        //reset list of positions
        positions = []

    })

    it("Mint positions with skewed values for token0/token1", async () => {
        //mint positions again
        await mintAllPositions()

        //skew positions with swaps
        const router = ISwapRouter__factory.connect("0xE592427A0AEce92De3Edee1F18E0157C05861564", whale)
        
        showBodyCyan("Doing swaps....")
        for (let i = 0; i < positions.length; i++) {

            const pool = IUniswapV3Pool__factory.connect(listings[i].addr, whale)
            let tokenIn = IERC20__factory.connect(await pool.token0(), whale)

            let tokenOut = await pool.token1()
            let balance = await tokenIn.balanceOf(whale.address)

            if (await toNumber(balance) == 0) {
                tokenOut = tokenIn.address
                tokenIn = IERC20__factory.connect(await pool.token1(), whale)
                balance = await tokenIn.balanceOf(whale.address)
            }

            const EIS_Params: ExactInputSingleParams = {
                tokenIn: tokenIn.address,
                tokenOut: tokenOut,
                fee: await pool.fee(),
                recipient: whale.address,
                deadline: (await currentBlock()).timestamp + 120,
                amountIn: balance,
                amountOutMinimum: BN("0"),
                sqrtPriceLimitX96: BN("0"),
            }

            //do a swap as the whale
            await tokenIn.connect(whale).approve(router.address, EIS_Params.amountIn)
            await router.connect(whale).exactInputSingle(EIS_Params)
        }
    })


    it("Verify values of all positions", async () => {
        showBodyCyan("Testing Values.....")
        for (let i = 0; i < positions.length; i++) {
            const valuation = await V3PositionValuator.getValue(positions[i])
            //this also liquidates the position
            const actual = await valuePosition(
                Number(positions[i]),
                IOracleRelay__factory.connect(listings[i].oracle0, signer),
                IOracleRelay__factory.connect(listings[i].oracle1, signer),
                nfpManager,
                signer
            )

            expect(await toNumber(valuation)).to.be.closeTo(await toNumber(actual), 10, "Accurate")

        }

        //reset list of positions
        positions = []

    })

    it("Mint vaults for testing", async () => {
        await VaultController.connect(signer).mintVault()
        vaultId = (await VaultController.vaultsMinted()).toNumber()

        await nftController.connect(signer).mintVault(vaultId)
        const vaultAddr = await nftController.NftVaultAddress(vaultId)
        nftVault = VaultNft__factory.connect(vaultAddr, signer)

        expect((await nftVault._vaultInfo()).id).to.eq(vaultId, "NFT vault minted correctly")

    })

    it("mint again and deposit", async () => {
        showBodyCyan("Minting Positions....")
        await mintAllPositions()

        showBodyCyan("Depositing Positions.....")
        let totalValue: BigNumber = BN('0')
        for (let i = 0; i < positions.length; i++) {
            //aggregate value
            totalValue = totalValue.add(await V3PositionValuator.getValue(positions[i]))

            //approve
            await nfpManager.connect(signer).approve(wrapper.address, positions[i])
            await hardhat_mine(5)

            //deposit
            await wrapper.connect(signer).deposit(positions[i], vaultId)
        }

        const borrowPower = await VaultController.vaultBorrowingPower(vaultId)
        const LTV = await VaultController._tokenId_tokenLTV(await VaultController._tokenAddress_tokenId(wrapper.address))
        const expectedBp = (totalValue.mul(LTV)).div(BN("1e18"))
        expect(borrowPower).to.eq(expectedBp, "Borrow Power is correct")
    })

    it("Do a loan", async () => {

        const usdiAmount = BN("1000e18")

        const result = await VaultController.connect(signer).borrowUsdi(vaultId, usdiAmount)
        showBody((await result.wait()).transactionHash)
        expect(await toNumber(await VaultController.vaultLiability(vaultId))).to.be.closeTo(await toNumber(usdiAmount), 0.0001, "Good Borrow")


    })

})