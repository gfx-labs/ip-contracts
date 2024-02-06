import { BN } from "../../../util/number"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
    CappedGovToken__factory,
    CrossChainAccount__factory,
    FromL1_ControlL2Greeter__factory,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, ILayer1Messenger, ILayer1Messenger__factory, INonfungiblePositionManager__factory, IOracleMaster__factory, IVault__factory, NftVaultController, NftVaultController__factory, OracleMaster__factory,
    ProxyAdmin__factory,
    Univ3CollateralToken,
    Univ3CollateralToken__factory,
    VaultController__factory,
    VotingVaultController__factory
} from "../../../typechain-types"
import { ProposalContext } from "../suite/proposal"
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"
import { showBody, showBodyCyan } from "../../../util/format"
import * as fs from 'fs'
import { currentBlock, fastForward, hardhat_mine, hardhat_mine_timed, resetCurrent, resetCurrentOP, resetOP } from "../../../util/block"
import hre from 'hardhat'
import { OptimisimAddresses, OptimisimDeploys, MainnetAddresses, MainnetDeploys, oa } from "../../../util/addresser";
import { BytesLike } from "ethers"
import { getGas, toNumber } from "../../../util/math"
import { IERC20__factory } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts"
import { stealMoney } from "../../../util/money"
import { send } from "process"
import { NonfungiblePositionManager } from "@uniswap/v3-sdk"
const a = new OptimisimAddresses()
const od = new OptimisimDeploys()
const m = new MainnetAddresses()
const d = new MainnetDeploys()
const { ethers, network } = require("hardhat")

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"



/*****************************CHANGE THESE/*****************************/
const proposeFromScript = true //IF TRUE, PRIVATE KEY MUST BE IN .env as PERSONAL_PRIVATE_KEY=42bb...
const SnxLTV = BN("70e16")
const SnxLiqInc = BN("75e15")


const proposerAddr = "0x3Df70ccb5B5AA9c300100D98258fE7F39f5F9908"

const execute = async (sender: SignerWithAddress) => {

    const governor = GovernorCharlieDelegate__factory.connect("0x266d1020A84B9E8B0ed320831838152075F8C4cA", sender)

    const result = await governor.connect(sender).execute(44)
    const gas = await getGas(result)
    const receipt = await result.wait()
    console.log("GAS: ", gas)
    //console.log(receipt)

}

const verifyUpgrade = async (sender: SignerWithAddress) => {
    await resetOP(115575217)
    const block = await currentBlock()
    console.log("reset to block ", block.number)


    const vc = VaultController__factory.connect(od.VaultController, sender)
    const pa = ProxyAdmin__factory.connect(od.ProxyAdmin, sender)
    const nftController: NftVaultController = NftVaultController__factory.connect(od.NftController, sender)
    const wrapper: Univ3CollateralToken = Univ3CollateralToken__factory.connect(od.WrappedPosition, sender)
    const vvc = VotingVaultController__factory.connect(od.VotingVaultController, sender)
    const imp = await pa.getProxyImplementation(od.VaultController)


    /**
    //get snx
    const snx = IERC20__factory.connect(oa.snxAddress, sender)
    const snxWhale = "0xF977814e90dA44bFA03b6295A0616a897441aceC"
    const user = ethers.provider.getSigner(snxWhale)
    await impersonateAccount(snxWhale)
    //mint
    await vc.connect(user).mintVault()
    const vaultId = await vc.vaultsMinted()
    await vvc.connect(user).mintVault(vaultId)
    //showBody("Minted vault: ", vaultId)

    //deposit
    const amount = BN("50e18")
    const cappedSNX = CappedGovToken__factory.connect(od.CappedSNX, sender)
    await snx.connect(user).approve(cappedSNX.address, amount)
    await cappedSNX.connect(user).deposit(amount, vaultId)


    //check borrow power
    const bp = await vc.vaultBorrowingPower(vaultId)
    //showBodyCyan(await toNumber(bp))



     */

    //test withdraw of position
    const minterAddr = "0x0542Bb6Fb48244beA6E59accfb6Da58096CcF89e"
    const minter = ethers.provider.getSigner(minterAddr)
    const positionId = 488901
    const positionVaultId = 2
    await impersonateAccount(minterAddr)

    //get vault
    const vaultAddr = await vc._vaultId_vaultAddress(positionVaultId)
    const vault = IVault__factory.connect(vaultAddr, minter)
    showBodyCyan("VALUE: ", await toNumber(await wrapper.balanceOf(vaultAddr)))

    //withdraw
    const nfpManager = INonfungiblePositionManager__factory.connect(oa.nfpManager, minter)
    showBody(await nfpManager.balanceOf(minterAddr))
    await vault.connect(minter).withdrawErc20(wrapper.address, 0)
    console.log("Done")
    showBody(await nfpManager.balanceOf(minterAddr))


    await ceaseImpersonation(minterAddr)


}

async function main() {

    let proposer: SignerWithAddress


    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST PROPOSAL")
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrent()
        const block = await currentBlock()
        console.log("reset to block ", block.number)
        await impersonateAccount(proposerAddr)
        console.log("Impersonated ", proposerAddr)
        proposer = ethers.provider.getSigner(proposerAddr)

    } else {
        const accounts = await ethers.getSigners()
        proposer = accounts[1]
        console.log("PROPOSING ON MAINNET AS: ", proposer.address)
    }

    //await execute(proposer)
    await verifyUpgrade(proposer)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

