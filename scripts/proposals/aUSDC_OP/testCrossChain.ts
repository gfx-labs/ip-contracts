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
    VaultNft__factory
} from "../../../typechain-types"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { hardhat_mine_timed, resetCurrentOP, resetOP } from "../../../util/block"
import { oa, od } from "../../../util/addresser"
import { stealMoney } from "../../../util/money"
import { mintPosition } from "../../../util/msc"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { showBody } from "../../../util/format"
import { toNumber } from "../../../util/math"
const { ethers } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const ownerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
const owner = ethers.provider.getSigner(ownerAddr)
const wethOp3000 = {
    addr: "0x68F5C0A2DE713a54991E01858Fd27a3832401849",
    oracle0: od.EthOracle,
    oracle1: od.OpOracle
}

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

    const wethAmount = BN("1e18")
    const opAmount = BN("700e18")

    before(async () => {
        await resetOP(115526670)

        const signers = await ethers.getSigners()
        signer = signers[0]

        nfpManager = INonfungiblePositionManager__factory.connect(oa.nfpManager, signer)
        wrapper = Univ3CollateralToken__factory.connect(od.WrappedPosition, signer)
        V3PositionValuator = V3PositionValuator__factory.connect(od.V3PositionValuator, owner)
        VaultController = VaultController__factory.connect(od.VaultController, signer)
        nftController = NftVaultController__factory.connect(od.NftController, signer)

        WETH = IERC20__factory.connect(oa.wethAddress, signer)
        OP = IERC20__factory.connect(oa.opAddress, signer)

        let weth_minter = "0x274d9E726844AB52E351e8F1272e7fc3f58B7E5F"
        await stealMoney(weth_minter, signer.address, WETH.address, wethAmount)

        let op_minter = "0xEbe80f029b1c02862B9E8a70a7e5317C06F62Cae"
        await stealMoney(op_minter, signer.address, oa.opAddress, opAmount)


    })

    it("perform the listing", async () => {

        await impersonateAccount(ownerAddr)
        await V3PositionValuator.connect(owner).registerPool(
            wethOp3000.addr,
            wethOp3000.oracle0,
            wethOp3000.oracle1
        )
        await ceaseImpersonation(ownerAddr)
    })

    it("mint a position", async () => {

        positionId = await mintPosition(wethOp3000.addr, WETH, OP, wethAmount, opAmount, signer)
        expect(positionId).to.be.gt(0, "Position Minted")
        expect(await nfpManager.balanceOf(signer.address)).to.be.gt(0, "Position balance increased")

        //showBody("WETH delta: ", await toNumber(wethAmount) - await toNumber(await WETH.balanceOf(signer.address)))
        //showBody("OP   delta: ", await toNumber(opAmount) - await toNumber(await OP.balanceOf(signer.address)))

    })

    it("Mint vaults for testing", async () => {

        await VaultController.connect(signer).mintVault()
        vaultId = (await VaultController.vaultsMinted()).toNumber()

        await nftController.connect(signer).mintVault(vaultId)
        const vaultAddr = await nftController.NftVaultAddress(vaultId)
        nftVault = VaultNft__factory.connect(vaultAddr, signer)

        expect((await nftVault._vaultInfo()).id).to.eq(vaultId, "NFT vault minted correctly")

    })

    it("Deposit Position and verify", async () => {

        const startBP = await VaultController.vaultBorrowingPower(vaultId)
        expect(startBP).to.eq(0, "Borrow Power is 0 to start")

        await nfpManager.connect(signer).approve(wrapper.address, positionId)
        await wrapper.connect(signer).deposit(positionId, vaultId)
        expect(await nfpManager.balanceOf(signer.address)).to.eq(0, "Position balance back to 0")

        const endBP = await VaultController.vaultBorrowingPower(vaultId)
        expect(await toNumber(endBP)).to.be.gt(1000, "Borrow Power increased")

    })

    it("Do a loan", async () => {

        const usdiAmount = BN("1000e18")

        await VaultController.connect(signer).borrowUsdi(vaultId, usdiAmount)
        expect(await toNumber(await VaultController.vaultLiability(vaultId))).to.be.closeTo(await toNumber(usdiAmount), 0.0001, "Good Borrow")

    })

    it("Collect", async () => {

        await hardhat_mine_timed(15, 15)

        await expect(nftVault.connect(signer).collect(positionId, signer.address)).to.not.reverted


    })
})