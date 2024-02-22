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
    IOracleRelay__factory,
    IOracleMaster__factory
} from "../../../typechain-types"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { hardhat_mine_timed, resetCurrentOP, resetOP } from "../../../util/block"
import { OptimisimDeploys, a, oa, od } from "../../../util/addresser"
import { stealMoney } from "../../../util/money"
import { mintPosition, valuePosition } from "../../../util/msc"
import { expect } from "chai"
import { BigNumber, Signer } from "ethers"
import { showBody, showBodyCyan } from "../../../util/format"
import { toNumber } from "../../../util/math"
import { setBalance } from "@nomicfoundation/hardhat-network-helpers"
import { sign } from "crypto"
import { wrap } from "module"
const { ethers } = require("hardhat")
const d = new OptimisimDeploys()
type poolData = {
    addr: string,
    oracle0: string,
    oracle1: string
}
const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const ownerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
const owner = ethers.provider.getSigner(ownerAddr)
const wethOp3000: poolData = {
    addr: "0x68F5C0A2DE713a54991E01858Fd27a3832401849",
    oracle0: d.EthOracle,
    oracle1: d.OpOracle
}
const wstethWeth100: poolData = {
    addr: "0x04F6C85A1B00F6D9B75f91FD23835974Cc07E65c",
    oracle0: d.wstEthOracle,
    oracle1: d.EthOracle
}
const usdcWeth500: poolData = {
    addr: "0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b",
    oracle0: d.UsdcStandardRelay,
    oracle1: d.EthOracle
}
const wethOp500: poolData = {
    addr: "0xFC1f3296458F9b2a27a0B91dd7681C4020E09D05",
    oracle0: d.EthOracle,
    oracle1: d.OpOracle
}
const wethSnx3000: poolData = {
    addr: "0x0392b358CE4547601BEFa962680BedE836606ae2",//not verrified
    oracle0: d.EthOracle,
    oracle1: d.SnxOracle//double check token0/token1? 
}
const wethWBTC500: poolData = {
    addr: "0x85c31ffa3706d1cce9d525a00f1c7d4a2911754c",//not verrified
    oracle0: d.EthOracle,
    oracle1: d.wbtcOracleScaler//double check token0/token1? 
}
const wethUSDC3000: poolData = {
    addr: "0xB589969D38CE76D3d7AA319De7133bC9755fD840",//not verrified
    oracle0: d.EthOracle,
    oracle1: d.UsdcStandardRelay
}
const listings: poolData[] = [
    wethOp3000,
    wstethWeth100,
    usdcWeth500,//usdc2
    wethOp500,
    wethSnx3000,
    wethWBTC500,
    wethUSDC3000//usdc1
]
let positions: number[] = []

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

    before(async () => {
        await resetCurrentOP()

        const signers = await ethers.getSigners()
        signer = signers[0]

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


    })

    it("Test valu func", async () => {

        const testPosition = await mintPosition(listings[0].addr, WETH, OP, wethAmount, opAmount, signer)

        const valuation = await V3PositionValuator.getValue(testPosition)
        const actual = await valuePosition(
            listings[0].addr,
            testPosition,
            IOracleRelay__factory.connect(listings[0].oracle0, signer),
            IOracleRelay__factory.connect(listings[0].oracle1, signer),
            nfpManager,
            signer
        )

        expect(await toNumber(valuation)).to.be.closeTo(await toNumber(actual), 5, "Accurate")


    })

    it("Mint positions", async () => {
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

    })




    it("Verify values of all positions", async () => {
        showBodyCyan("Testing Values.....")
        for (let i = 0; i < positions.length; i++) {
            const valuation = await V3PositionValuator.getValue(positions[i])
            //this also liquidates the position
            const actual = await valuePosition(
                listings[i].addr,
                Number(positions[i]),
                IOracleRelay__factory.connect(listings[i].oracle0, signer),
                IOracleRelay__factory.connect(listings[i].oracle1, signer),
                nfpManager,
                signer
            )

            expect(await toNumber(valuation)).to.be.closeTo(await toNumber(actual), 5, "Accurate")


            /**
            showBody("IDX: ", i)
            showBody("valuation: ", await toNumber(valuation))
            showBody("Actual   : ", await toNumber(actual))
            console.log(" ")
             */

        }

        //reset list of positions
        positions = []

    })

    it("Mint positions with skewed values for token0/token1", async () => {
        showBodyCyan("Minting Positions....")
        const wethOpId = await mintPosition(listings[0].addr, WETH, OP, wethAmount.div(2), (opAmount.mul(2)).sub(opAmount.div(2)), signer)
        const wstEthWethId = await mintPosition(listings[1].addr, wstETH, WETH, wstEthAmount.div(2), (wethAmount.mul(2)).sub(wethAmount.div(2)), signer)
        const usdcWethId = await mintPosition(listings[2].addr, USDC2, WETH, usdcAmount.div(2), (wethAmount.mul(2)).sub(wethAmount.div(2)), signer)//usdc2
        const wethOp500Id = await mintPosition(listings[3].addr, WETH, OP, wethAmount.div(2), (opAmount.mul(2)).sub(opAmount.div(2)), signer)
        const wethSnxId = await mintPosition(listings[4].addr, WETH, SNX, wethAmount.div(2), (snxAmount.mul(2)).sub(snxAmount.div(2)), signer)
        const wethWbtcId = await mintPosition(listings[5].addr, WETH, WBTC, wethAmount.div(2), (wbtcAmount.mul(2)).sub(wbtcAmount.div(2)), signer)
        const wethUsdcId = await mintPosition(listings[6].addr, WETH, USDC1, wethAmount.div(2), (usdcAmount.mul(2)).sub(usdcAmount.div(2)), signer)//usdc1

        positions.push(Number(wethOpId))
        positions.push(Number(wstEthWethId))
        positions.push(Number(usdcWethId))
        positions.push(Number(wethOp500Id))
        positions.push(Number(wethSnxId))
        positions.push(Number(wethWbtcId))
        positions.push(Number(wethUsdcId))


    })

    it("Verify values of all positions", async () => {
        showBodyCyan("Testing Values.....")
        for (let i = 0; i < positions.length; i++) {
            const valuation = await V3PositionValuator.getValue(positions[i])
            //this also liquidates the position
            const actual = await valuePosition(
                listings[i].addr,
                Number(positions[i]),
                IOracleRelay__factory.connect(listings[i].oracle0, signer),
                IOracleRelay__factory.connect(listings[i].oracle1, signer),
                nfpManager,
                signer
            )

            expect(await toNumber(valuation)).to.be.closeTo(await toNumber(actual), 5, "Accurate")

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

        showBodyCyan("Depositing Positions.....")
        let totalValue: BigNumber = BN('0')
        for (let i = 0; i < positions.length; i++) {
            //aggregate value
            totalValue = totalValue.add(await V3PositionValuator.getValue(positions[i]))

            //approve
            await nfpManager.connect(signer).approve(wrapper.address, positions[i])

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

        await VaultController.connect(signer).borrowUsdi(vaultId, usdiAmount)
        expect(await toNumber(await VaultController.vaultLiability(vaultId))).to.be.closeTo(await toNumber(usdiAmount), 0.0001, "Good Borrow")

    })
})