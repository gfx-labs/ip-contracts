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
    IV3Pool__factory
} from "../../../typechain-types"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { currentBlock, hardhat_mine_timed, resetCurrentOP, resetCustom, resetOP } from "../../../util/block"
import { OptimisimDeploys, oa, od } from "../../../util/addresser"
import { stealMoney } from "../../../util/money"
import { mintPosition } from "../../../util/msc"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { showBody, showBodyCyan } from "../../../util/format"
import { toNumber } from "../../../util/math"
const { ethers } = require("hardhat")
const d = new OptimisimDeploys()

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
const ownerAddr = "0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89"
const owner = ethers.provider.getSigner(ownerAddr)

type poolData = {
    addr: string,
    oracle0: string,
    oracle1: string
}


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
    oracle0: d.UsdcRelay,
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
    addr: "0x85C31FFA3706d1cce9d525a00f1C7D4A2911754c",//not verrified
    oracle0: d.EthOracle,
    oracle1: d.wBtcOracle//double check token0/token1? 
}
const wethUSDC3000: poolData = {
    addr: "0xB589969D38CE76D3d7AA319De7133bC9755fD840",//not verrified
    oracle0: d.EthOracle,
    oracle1: d.UsdcRelay
}

const listings: poolData[] = [
    wethOp3000,
    wstethWeth100,
    usdcWeth500,
    wethOp500,
    wethSnx3000,
    wethWBTC500,
    wethUSDC3000
]

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
        //run with --network tenderly
        //https://docs.tenderly.co/forks/sending-transactions-to-forks
        //await resetCustom("https://rpc.tenderly.co/fork/aa5229b9-09be-4887-ac17-f57339649b80")

        
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
        //await stealMoney(weth_minter, signer.address, WETH.address, wethAmount)

        let op_minter = "0xEbe80f029b1c02862B9E8a70a7e5317C06F62Cae"
       // await stealMoney(op_minter, signer.address, oa.opAddress, opAmount)
        


    })

    it("Check for registered pools", async () => {
        showBodyCyan(await V3PositionValuator.owner())
        for (const pool of listings) {
            expect(await V3PositionValuator.registeredPools(pool.addr)).to.eq(true, "Pool Registered")
        }
    })

    it("Check for position value", async () => {
        const pool = IV3Pool__factory.connect("0xB589969D38CE76D3d7AA319De7133bC9755fD840", signer)
        showBody("T0: ", await pool.token0())
        showBody("T1: ", await pool.token1())

    })

})