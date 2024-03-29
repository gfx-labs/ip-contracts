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
    IVault__factory
} from "../../../typechain-types"
import { OptimisimDeploys, oa, od } from "../../../util/addresser"
import { BigNumber } from "ethers"
import { BN } from "../../../util/number"
import { assert } from "console"
import { toNumber } from "../../../util/math"

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
    let aUSDC: IERC20

    before(async () => {
        //run with --network tenderly
        //https://rpc.tenderly.co/fork/ceffe1b7-ce3c-4193-a26f-1d72eac45e9a
        //https://docs.tenderly.co/forks/sending-transactions-to-forks

        
        //reset to final proposal transaction id from tenderly
        await ethers.provider.send("evm_revert", ["21321bc0-09a8-4e66-903e-153127360017"])//mint vault 29 for signer

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
        aUSDC = IERC20__factory.connect(oa.aOptUsdcAddress, signer)
        //await stealMoney(weth_minter, signer.address, WETH.address, wethAmount)

        let op_minter = "0xEbe80f029b1c02862B9E8a70a7e5317C06F62Cae"
        // await stealMoney(op_minter, signer.address, oa.opAddress, opAmount)
    })

    it("Verify aUSDC LTV", async () => {
        //signer addr 0x1932262E68FDD2AC8470d5B4F326ec5554C81084
        //opt usdc 0x625e7708f30ca75bfd92586e17077590c60eb4cd

        const amount = BN("1000e6")
        const vaultId = 29

        let balance = await aUSDC.balanceOf(signer.address)
        console.log("EOA balance", balance)

        //transfer to vault
        const vault = IVault__factory.connect(await VaultController.vaultAddress(vaultId), signer)

        await aUSDC.connect(signer).transfer(vault.address, amount)

        balance = await aUSDC.balanceOf(vault.address)
        console.log("VLT balance", balance)

        const bp = await VaultController.vaultBorrowingPower(vaultId)

        console.log("BP: ", await toNumber(bp))

    })
})