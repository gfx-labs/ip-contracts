import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { hardhat_mine_timed, resetCurrentOP } from "../../../util/block";
import { BigNumber } from "ethers";
import { getArgs, getGas } from "../../../util/math";
import { currentBlock } from "../../../util/block";
import { ethers, network } from "hardhat";

import { expect } from "chai";
import { toNumber } from "../../../util/math";
import {
    VaultNft__factory, IVault,
    IVault__factory,
    V3PositionValuator,
    V3PositionValuator__factory,
    Univ3CollateralToken,
    Univ3CollateralToken__factory,
    NftVaultController,
    NftVaultController__factory,
    UsdcRelay__factory,
    IVaultController__factory,
    IVaultController,
    IERC20__factory,
    IERC20,
    IUniV3Pool__factory,
    INonfungiblePositionManager__factory,
    VaultNft
} from "../../../typechain-types";
import { nearestUsableTick } from "@uniswap/v3-sdk";
import { stealMoney } from "../../../util/money";
import { oa, od } from "../../../util/addresser";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";
import { INonfungiblePositionManager } from "../../../typechain-types/contracts/_external/uniswap";
import { MintParams } from "../../cap/cappedUniV3Position/scope";
require("chai").should();

//test using live deployments
describe("Verify OP deployment and first listing", () => {
    let V3PositionValuator: V3PositionValuator
    let WrappedPosition: Univ3CollateralToken

    let NftController: NftVaultController
    let VaultController: IVaultController
    let nfpManager: INonfungiblePositionManager
    let Bob: SignerWithAddress
    let BobVaultId: BigNumber
    let BobVault: IVault
    let BobNftVault: VaultNft
    let BobPositionId: BigNumber
    let usdc: IERC20
    let weth: IERC20

    let ethSpent: BigNumber
    let usdcSpent: BigNumber

    const usdcAmount = BN("230e6")
    const wethAmount = BN("1e17")
    const poolAddr = oa.wETH_UNI_POOL

    it("Setup", async () => {

        await resetCurrentOP()
        await network.provider.send("evm_setAutomine", [true])

        let accounts = await ethers.getSigners()
        Bob = accounts[7]

        V3PositionValuator = V3PositionValuator__factory.connect(od.V3PositionValuator, Bob)
        WrappedPosition = Univ3CollateralToken__factory.connect(od.WrappedPosition, Bob)
        NftController = NftVaultController__factory.connect(od.NftController, Bob)
        VaultController = IVaultController__factory.connect(od.VaultController, Bob)
        nfpManager = INonfungiblePositionManager__factory.connect(oa.nfpManager, Bob)

        weth = IERC20__factory.connect(oa.wethAddress, Bob)
        usdc = IERC20__factory.connect(oa.usdcAddress, Bob)

        const minter = "0x86Bb63148d17d445Ed5398ef26Aa05Bf76dD5b59"
        await stealMoney(minter, Bob.address, usdc.address, usdcAmount)
        await stealMoney(minter, Bob.address, weth.address, wethAmount)

        //temp
        //config oracles

    })

    /**
    //this tx has been done on OP
    it("Config oracle", async () => {
        //impersonate myself
        const me = ethers.provider.getSigner("0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89")
        await impersonateAccount(me._address)

        const usdcRelay = await new UsdcRelay__factory(me).deploy()

        //do the tx
        const v3Pv = V3PositionValuator__factory.connect(od.V3PositionValuator, me)
        await v3Pv.connect(me).registerPool(
            "0x85149247691df622eaF1a8Bd0CaFd40BC45154a9",//v3 weth/usdc pool @500
            "0xcB88cf29121E5380c818A7dd4E8C21d964369dF3",//eth oracle
            "0xcEe78cE44e98d16f59C775494Be24E0D2cFF19A4"//usdc relay returns 1e36 for scaling

        )

        await ceaseImpersonation(me._address)
    })
     */

    it("Mint and deposit a position", async () => {

        //mint standard vault
        await VaultController.connect(Bob).mintVault()
        BobVaultId = await VaultController.vaultsMinted()
        let vaultAddress = await VaultController.vaultAddress(BobVaultId)
        BobVault = IVault__factory.connect(vaultAddress, Bob)


        const POOL = IUniV3Pool__factory.connect(poolAddr, Bob)
        const [fee, tickSpacing, slot0] =
            await Promise.all([
                POOL.fee(),
                POOL.tickSpacing(),
                POOL.slot0(),
            ])

        showBody("Token0: ", await POOL.token0())
        showBody("Token1: ", await POOL.token1())



        const nut = nearestUsableTick(slot0[1], tickSpacing)
        const tickLower = nut - (tickSpacing * 2)
        const tickUpper = nut + (tickSpacing * 2)
        const block = await currentBlock()
        const params: MintParams = {
            token0: weth.address,
            token1: usdc.address,
            fee: 500,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: wethAmount,
            amount1Desired: usdcAmount,
            amount0Min: BN("0"),
            amount1Min: BN("0"),
            recipient: Bob.address,
            deadline: block.timestamp + 500
        }


        let startWeth = await weth.balanceOf(Bob.address)
        let startUSDC = await usdc.balanceOf(Bob.address)
       
        //approve
        await weth.connect(Bob).approve(nfpManager.address, wethAmount)
        await usdc.connect(Bob).approve(nfpManager.address, usdcAmount)

        //mint position
        const result = await nfpManager.connect(Bob).mint(params)
        await hardhat_mine_timed(500, 15)
        const args = await getArgs(result)
        BobPositionId = args.tokenId

        expect(await nfpManager.balanceOf(Bob.address)).to.eq(BN("1"), "Bob has 1 NFT")

        ethSpent = startWeth.sub(await weth.balanceOf(Bob.address))
        usdcSpent = startUSDC.sub(await usdc.balanceOf(Bob.address))

    })

    it("Mint nftVaults", async () => {
        let _vaultId_votingVaultAddress = await NftController._vaultId_nftVaultAddress(BobVaultId)
        expect(_vaultId_votingVaultAddress).to.eq("0x0000000000000000000000000000000000000000", "Voting vault not yet minted")

        const result = await NftController.connect(Bob).mintVault(BobVaultId)
        const gas = await getGas(result)
        showBodyCyan("Gas to mint NFT vault: ", gas)

        let vaultAddr = await NftController._vaultId_nftVaultAddress(BobVaultId)
        BobNftVault = VaultNft__factory.connect(vaultAddr, Bob)

        expect(BobNftVault.address.toString().toUpperCase()).to.eq(vaultAddr.toString().toUpperCase(), "Bob's nft vault setup complete")
    })

    it("verify wp", async () => {

        const nfpResult = await WrappedPosition._underlying()
        expect(nfpResult).to.eq(nfpManager.address)

        const vcResult = await WrappedPosition._vaultController()
        expect(vcResult).to.eq(VaultController.address)

        const nftContResult = await WrappedPosition._nftVaultController()
        expect(nftContResult).to.eq(NftController.address)

        const pvalResult = await WrappedPosition._positionValuator()
        expect(pvalResult).to.eq(V3PositionValuator.address)

    })

    it("Deposit Position", async () => {

        //deposit position
        await nfpManager.connect(Bob).approve(WrappedPosition.address, BobPositionId)

        const deposit = await WrappedPosition.connect(Bob).deposit(BobPositionId, BobVaultId)
        const gas = await getGas(deposit)
        showBodyCyan("Gas to deposit a position: ", gas)

    })

    it("Confirm value", async () => {

        showBody("Input USDC: ", ethers.utils.formatUnits(usdcSpent, 6))
        showBody("Input WETH: ", await toNumber(ethSpent))

        const value = await WrappedPosition.balanceOf(BobVault.address)
        showBodyCyan("VALUE: ", await toNumber(value))

    })
})