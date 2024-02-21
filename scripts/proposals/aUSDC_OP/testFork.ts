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
    VaultNft, IOracleRelay__factory
} from "../../../typechain-types"
import { OptimisimDeploys, oa, od } from "../../../util/addresser"
import { BigNumber } from "ethers"
import { showBody, showBodyCyan } from "../../../util/format"
import { toNumber } from "../../../util/math"
import { impersonateAccount } from "../../../util/impersonator"
import { s } from "../../../test/mainnet/scope"
import { expect } from "chai";
import { BN } from "../../../util/number"

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
    let USDC: IERC20
    let positionId: BigNumber
    let vaultId: number
    let nftVault: VaultNft

    before(async () => {
        //run with --network tenderly
        //https://docs.tenderly.co/forks/sending-transactions-to-forks
        //await resetCustom("https://rpc.tenderly.co/fork/aa5229b9-09be-4887-ac17-f57339649b80")
        //await resetCurrentOP()

        const signers = await ethers.getSigners()
        signer = signers[0]

        nfpManager = INonfungiblePositionManager__factory.connect(oa.nfpManager, signer)
        wrapper = Univ3CollateralToken__factory.connect(od.WrappedPosition, signer)
        V3PositionValuator = V3PositionValuator__factory.connect(od.V3PositionValuator, owner)
        VaultController = VaultController__factory.connect(od.VaultController, signer)
        nftController = NftVaultController__factory.connect(od.NftController, signer)

        WETH = IERC20__factory.connect(oa.wethAddress, signer)
        OP = IERC20__factory.connect(oa.opAddress, signer)
        USDC = IERC20__factory.connect(oa.usdcAddress, signer)
        //await stealMoney(weth_minter, signer.address, WETH.address, wethAmount)

        let op_minter = "0xEbe80f029b1c02862B9E8a70a7e5317C06F62Cae"
        // await stealMoney(op_minter, signer.address, oa.opAddress, opAmount)
    })
    
    it("Verify position LTV", async () => {
        const wethOracle = IOracleRelay__factory.connect(od.EthOracle, signer)

        const positionId = 498192
        const value = await V3PositionValuator.getValue(positionId)
        showBodyCyan("Valueator value: ", await toNumber(value))

        const ownerAddr = await nfpManager.ownerOf(positionId)
        const owner = ethers.provider.getSigner(ownerAddr)
        //vault id 22
        const bp = await VaultController.vaultBorrowingPower(22)
        expect(await toNumber(bp)).to.be.closeTo(await toNumber(value) * .3, 10, "BP correct")

    })

    it("Verify aUSDC LTV", async () => {
        //opt usdc 0x625e7708f30ca75bfd92586e17077590c60eb4cd
        //capped 0x6F7A2f0d9DBd284E274f28a6Fa30e8760C25F9D2
        const amount = BN("500000000")//5000000000000
        const ownerAddr = '0xB5A9621B0397Bfc5B45896CaE5998b6111bcDCe6'
        const vaultId = 23

        expect(await toNumber(await VaultController.vaultBorrowingPower(vaultId))).to.be.closeTo(500 * .94, 1, "Borrow Power is correct")

    })

    /**
    it("Check for registered pools", async () => {
        showBodyCyan(await V3PositionValuator.owner())
        for (const pool of listings) {
            //expect(await V3PositionValuator.registeredPools(pool.addr)).to.eq(true, "Pool Registered")
            showBody(await V3PositionValuator.registeredPools(pool.addr))
        }
    })

    it("Check for position value", async () => {
        const pool = IV3Pool__factory.connect("0xB589969D38CE76D3d7AA319De7133bC9755fD840", signer)
        showBody("T0: ", await pool.token0())
        showBody("T1: ", await pool.token1())

    })
     */
})