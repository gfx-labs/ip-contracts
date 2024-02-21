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
    OracleScaler__factory,
    VotingVaultController__factory,
    ProxyAdmin__factory
} from "../../../typechain-types"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { hardhat_mine_timed, resetCurrentOP, resetOP } from "../../../util/block"
import { oa, od } from "../../../util/addresser"
import { stealMoney } from "../../../util/money"
import { mintPosition } from "../../../util/msc"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { showBody, showBodyCyan } from "../../../util/format"
import { toNumber } from "../../../util/math"
import { setBalance } from "@nomicfoundation/hardhat-network-helpers"
import { DeployContract } from "../../../util/deploy"
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

        WETH = IERC20__factory.connect(oa.wethAddress, signer)
        OP = IERC20__factory.connect(oa.opAddress, signer)
        WBTC = IERC20__factory.connect(oa.wbtcAddress, signer)

        let weth_minter = "0x274d9E726844AB52E351e8F1272e7fc3f58B7E5F"
        await stealMoney(weth_minter, signer.address, WETH.address, wethAmount)

        let wbtc_minter = "0xE2b4fd6899E27142edf5298E150205F97Be4DD78"
        await stealMoney(wbtc_minter, signer.address, oa.wbtcAddress, wbtcAmount)

        showBody(await nftController._nfpManager())

    })

    it("perform the listing", async () => {

        const ownerAddr = await V3PositionValuator.owner()
        const owner = ethers.provider.getSigner(ownerAddr)

        await setBalance(ownerAddr, BN("1e18"))

        await impersonateAccount(ownerAddr)
        await V3PositionValuator.connect(owner).registerPool(
            wethWBTC500.addr,
            wethWBTC500.oracle0,
            wethWBTC500.oracle1
        )
        await ceaseImpersonation(ownerAddr)
    })


    it("mint a position", async () => {

        positionId = await mintPosition(wethWBTC500.addr, WETH, WBTC, wethAmount, wbtcAmount, signer)
        expect(positionId).to.be.gt(0, "Position Minted")
        expect(await nfpManager.balanceOf(signer.address)).to.be.gt(0, "Position balance increased")

        //showBody("WETH delta: ", await toNumber(wethAmount) - await toNumber(await WETH.balanceOf(signer.address)))
        //showBody("WBTC delta: ", ethers.utils.formatUnits(wbtcAmount.sub(await WBTC.balanceOf(signer.address)), 8))

        //expected value is 3773.8507500000005 in BTC + 2771.63 in ETH == ~6,545.48

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

        const value = await V3PositionValuator.getValue(positionId)
        //showBody(value)
        //showBody(await toNumber(value))

        const endBP = await VaultController.vaultBorrowingPower(vaultId)
        //showBody("Initial BP: ", await toNumber(endBP))
        //expect(await toNumber(endBP)).to.be.gt(1000, "Borrow Power increased")

    })

    it("Deploy updated oracle, register, and verify", async () => {

        //deploy updated oracle
        const oracleScaler = await DeployContract(
            new OracleScaler__factory(signer),
            signer,
            od.wBtcOracle,
            BN("1e10"),
            true
        )

        //register
        const ownerAddr = await V3PositionValuator.owner()
        const owner = ethers.provider.getSigner(ownerAddr)
        await impersonateAccount(ownerAddr)
        //need to call twice, as it is a toggle, first call turns off the pool
        await V3PositionValuator.connect(owner).registerPool(
            wethWBTC500.addr,
            wethWBTC500.oracle0,
            oracleScaler.address
        )
        await V3PositionValuator.connect(owner).registerPool(
            wethWBTC500.addr,
            wethWBTC500.oracle0,
            oracleScaler.address
        )
        await ceaseImpersonation(ownerAddr)

        //check value again 
        const value = await V3PositionValuator.getValue(positionId)
        //showBody(value)
        //showBodyCyan(await toNumber(value))
        const endBP = await VaultController.vaultBorrowingPower(vaultId)
        showBodyCyan("End BP: ", await toNumber(endBP))


    })

    
    it("Do a loan", async () => {

        const usdiAmount = BN("1000e18")

        await VaultController.connect(signer).borrowUsdi(vaultId, usdiAmount)
        expect(await toNumber(await VaultController.vaultLiability(vaultId))).to.be.closeTo(await toNumber(usdiAmount), 0.0001, "Good Borrow")

    })
     

    it("Collect", async () => {

        await hardhat_mine_timed(15, 15)
        const result = await nftVault._vaultInfo()
        showBody(result)
        showBody(await nftController._nfpManager())
        await nftVault.connect(signer).collect(positionId, signer.address)
        //await expect(nftVault.connect(signer).collect(positionId, signer.address)).to.not.reverted


    })

})