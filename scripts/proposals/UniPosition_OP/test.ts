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
    VaultNft, IOracleRelay__factory, ProxyAdmin__factory
} from "../../../typechain-types"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { currentBlock, resetCurrentOP } from "../../../util/block"
import { oa, od } from "../../../util/addresser"
import { stealMoney } from "../../../util/money"
import { BigNumber } from "ethers"
import { showBody, showBodyCyan } from "../../../util/format"
import { toNumber } from "../../../util/math"
import { setBalance } from "@nomicfoundation/hardhat-network-helpers"
const { ethers } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const wethWBTC500 = {
    addr: "0x85c31ffa3706d1cce9d525a00f1c7d4a2911754c",//not verrified
    oracle0: od.EthOracle,
    oracle1: od.wBtcOracle//double check token0/token1? 
}

require("chai").should();
describe("Testing", () => {
    let nfpManager: INonfungiblePositionManager
    let V3PositionValuator: V3PositionValuator
    let wrapper: Univ3CollateralToken
    let VaultController: VaultController
    let nftController: NftVaultController

    let signer: SignerWithAddress
    let USDC: IERC20
    let WETH: IERC20
    let OP: IERC20
    let WBTC: IERC20
    let positionId: BigNumber
    let vaultId: number
    let nftVault: VaultNft

    const wethAmount = BN("1e18")
    const wbtcAmount = BN("1e7")

    before(async () => {
        await resetCurrentOP()

        const signers = await ethers.getSigners()
        signer = signers[0]

        nfpManager = INonfungiblePositionManager__factory.connect(oa.nfpManager, signer)
        wrapper = Univ3CollateralToken__factory.connect(od.WrappedPosition, signer)
        V3PositionValuator = V3PositionValuator__factory.connect(od.V3PositionValuator, signer)
        VaultController = VaultController__factory.connect(od.VaultController, signer)
        nftController = NftVaultController__factory.connect(od.NftController, signer)

        USDC = IERC20__factory.connect(oa.usdcAddress, signer)
        WETH = IERC20__factory.connect(oa.wethAddress, signer)
        OP = IERC20__factory.connect(oa.opAddress, signer)
        WBTC = IERC20__factory.connect(oa.wbtcAddress, signer)

        let weth_minter = "0x274d9E726844AB52E351e8F1272e7fc3f58B7E5F"
        await stealMoney(weth_minter, signer.address, WETH.address, wethAmount)

        let wbtc_minter = "0xE2b4fd6899E27142edf5298E150205F97Be4DD78"
        await stealMoney(wbtc_minter, signer.address, oa.wbtcAddress, wbtcAmount)

        showBody(await nftController._nfpManager())

    })



    it("Do a thing", async () => {

        const imp = await new V3PositionValuator__factory(signer).deploy()
        const proxy = ProxyAdmin__factory.connect(od.ProxyAdmin, signer)
        //update valueator to use correct oracle
        const ownerAddr = await V3PositionValuator.owner()
        const owner = ethers.provider.getSigner(ownerAddr)

        await setBalance(ownerAddr, BN("1e18"))
        await impersonateAccount(ownerAddr)
        await proxy.connect(owner).upgrade(V3PositionValuator.address, imp.address)
        
        await V3PositionValuator.connect(owner).registerPool(
            "0x85149247691df622eaF1a8Bd0CaFd40BC45154a9",
            "0xcB88cf29121E5380c818A7dd4E8C21d964369dF3",
            od.UsdcStandardRelay
        )
        await V3PositionValuator.connect(owner).registerPool(
            "0x85149247691df622eaF1a8Bd0CaFd40BC45154a9",
            "0xcB88cf29121E5380c818A7dd4E8C21d964369dF3",
            od.UsdcStandardRelay
        )
        await ceaseImpersonation(ownerAddr)

    })

    /**
     * Invalid positions: 482464, 481734, 463935, 462497
     * positions with correct value: 498747, 498743
     * IPT man position: 493972
     * Incorrect low: 579631
     * Incorrect high: 498192(~27%), 498516(~10%)
     */    
    it("Test actual value", async () => {
        const wethOracle = IOracleRelay__factory.connect(od.EthOracle, signer)

        const positionId = 498192
        const value = await V3PositionValuator.getValue(positionId)
        showBodyCyan("Valueator value: ", await toNumber(value))
        const ownerAddr = await nfpManager.ownerOf(positionId)

        //fund
        await setBalance(ownerAddr, BN("1e18"))

        //console.log("OWNER: ", ownerAddr)
        const owner = ethers.provider.getSigner(ownerAddr)
        await impersonateAccount(ownerAddr)

        let data = await nfpManager.positions(positionId)
        //console.log("Data: ", data)

        //collect to reset value
        let collectParams = {
            tokenId: positionId,
            recipient: ownerAddr,
            amount0Max: data.tokensOwed0,
            amount1Max: data.tokensOwed1
        }
        if (data.tokensOwed0 > BN("0") || data.tokensOwed1 > BN("0")) {
            await nfpManager.connect(owner).collect(collectParams)
        }

        const startUSDC = await USDC.balanceOf(ownerAddr)
        const startingWETH = await WETH.balanceOf(ownerAddr)

        //console.log("Liquidity: ", data.liquidity)

        //close position
        const params = {
            tokenId: positionId,
            liquidity: data.liquidity,
            amount0Min: BN("0"),
            amount1Min: BN("0"),
            deadline: (await currentBlock()).timestamp + 500
        }
        const result = await nfpManager.connect(owner).decreaseLiquidity(params)
        //console.log(await getArgs(result))

        data = await nfpManager.positions(positionId)
        //console.log("Liquidity: ", data.liquidity)
        collectParams = {
            tokenId: positionId,
            recipient: ownerAddr,
            amount0Max: data.tokensOwed0,
            amount1Max: data.tokensOwed1
        }
        await nfpManager.connect(owner).collect(collectParams)


        const usdcGained = (await USDC.balanceOf(ownerAddr)).sub(startUSDC)
        const wethGained = (await WETH.balanceOf(ownerAddr)).sub(startingWETH)

        //showBody("USDC delta: ", ethers.utils.formatUnits(usdcGained, 6))
        //showBody("WETH delta: ", await toNumber(wethGained))



        const ethValue = ((await wethOracle.currentValue()).mul(wethGained)).div(BN("1e18"))
        showBodyCyan("Actual   Value: ", await toNumber(ethValue) + Number(ethers.utils.formatUnits(usdcGained, 6)))

        //275316.71370021 +  393097.23 == 668000
        //2582.19 + 88594.423 == 91,176

        await ceaseImpersonation(ownerAddr)

    })

    
})