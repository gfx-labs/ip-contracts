import { ProxyAdmin__factory } from "@certusone/wormhole-sdk/lib/cjs/ethers-contracts";
import { CappedERC4626__factory, CappedNonStandardToken__factory, GovernorCharlieDelegate__factory, IUniV3Pool__factory, IVault, IVault__factory, USDI__factory, VaultController__factory } from "../../typechain-types";
import { currentBlock, fastForward, hardhat_mine, hardhat_mine_timed, resetCurrent, resetCurrentOP } from "../../util/block";
import { DeployContract } from "../../util/deploy"
import hre from 'hardhat'
import { a, c, d, oa, od } from "../../util/addresser";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ProposalContext } from "../proposals/suite/proposal";
import { IERC20__factory } from "../../typechain-types/factories/contracts/IPTsale/SlowRoll.sol";
import { BN } from "../../util/number";
import { getGas, toNumber } from "../../util/math";
import { showBodyCyan } from "../../util/format";
import { ceaseImpersonation } from "../../util/impersonator";

const { ethers, network, upgrades } = require("hardhat");
const owner = ethers.provider.getSigner("0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89")


const data = "0xf682e04c00000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000002a54ba2964c8cd459dc568853f79813a60761b58000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000197472616e7366657228616464726573732c75696e7432353629000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000400000000000000000000000006dd6934452eb4e6d87b9c874ae0ef83ec3bd580300000000000000000000000000000000000000000000002086ac351052600000000000000000000000000000000000000000000000000000000000000000012923204F63746F6265722044656c65676174652050726f6772616d2041646d696e697374726174696f6e20457870656e7365730a546869732070726f706f73616c207472616e736665727320363030205553446920746f206665656d732e65746820617320636f6d70656e736174696f6e20666f722061646d696e697374726174696f6e20616e64207265706f7274696e672064757469657320696e204F63746F62657220756e64657220746865205265636f676e697a65642044656c65676174652050726f6772616d2e2054686973207061796d656e7420697320617574686f72697a656420756e6465722050726f706f73616c2031343a205265636f676e697a65642044656c6567617465732050726f6772616d2026206362455448204f7261636c65200000000000000000000000000000000000000000000000"
const feems = "0x6DD6934452eB4E6D87B9c874AE0EF83ec3bd5803"
const proposerAddr = "0x958892b4a0512b28AaAC890FC938868BBD42f064"

const propose = async (proposer: SignerWithAddress) => {

    const gov = GovernorCharlieDelegate__factory.connect(d.CharlieDelegator, proposer)

    const tx = {
        to: gov.address,
        from: proposer.address,
        data: data
    }

    const initCount = await gov.proposalCount()
    console.log(initCount)
    await proposer.sendTransaction(tx)

    const proposalId = await gov.proposalCount()
    console.log(proposalId)

    console.log(await gov.proposals(proposalId))
    const USDI = IERC20__factory.connect(d.USDI, proposer)
    const startUSDI = await toNumber(await USDI.balanceOf(feems))

    await quickTest(proposer)

    const endUSDI = await toNumber(await USDI.balanceOf(feems))

    console.log("DIFF: ", endUSDI - startUSDI)


}

const quickTest = async (proposer: SignerWithAddress) => {
    const gov = new GovernorCharlieDelegate__factory(proposer).attach(
        d.CharlieDelegator
    )

    const votingPeriod = await gov.votingPeriod()
    const votingDelay = await gov.votingDelay()
    const timelock = await gov.proposalTimelockDelay()

    const block = await currentBlock()

    const proposal = Number(await gov.proposalCount())
    showBodyCyan("Advancing a lot of blocks...", proposal)
    await hardhat_mine(votingDelay.toNumber())

    await gov.connect(proposer).castVote(proposal, 1)

    await ceaseImpersonation(proposerAddr)
    const whale = "0xa6e8772af29b29b9202a073f8e36f447689beef6"
    const prop = ethers.provider.getSigner(whale)
    await impersonateAccount(whale)
    await gov.connect(prop).castVote(proposal, 1)

    showBodyCyan("Advancing a lot of blocks again...")
    await hardhat_mine(votingPeriod.toNumber())

    await gov.connect(prop).queue(proposal)
    console.log("queued")

    await fastForward(timelock.toNumber())

    const result = await gov.connect(prop).execute(proposal)
    await result.wait()
    showBodyCyan("EXECUTION COMPLETE")

    await ceaseImpersonation(whale)
}

const deposit = async (depositer: SignerWithAddress) => {

    const VC = VaultController__factory.connect(d.VaultController, depositer)
    const CappedWOETH = CappedERC4626__factory.connect(c.CappedWOETH, depositer)
    const OETH = IERC20__factory.connect(a.oethAddress, depositer)
    const vaultID = 101
    const minter = ethers.provider.getSigner("0x0542Bb6Fb48244beA6E59accfb6Da58096CcF89e")
    const baseUnderlying = await CappedWOETH._baseUnderlying()

    console.log("Got the things")

    console.log("OETH: ", OETH.address)
    console.log("Base: ", baseUnderlying)

    //fund minter
    const tx = {
        to: minter._address,
        value: BN('1e18')
    }

    await depositer.sendTransaction(tx)

    //confirm money
    const balance = await OETH.balanceOf(minter._address)
    console.log("Balanc: ", await toNumber(balance))
    const amount = BN("1001090554025809")

    console.log("Amount: ", await toNumber(amount))

    await impersonateAccount(minter._address)
    await OETH.connect(minter).approve(CappedWOETH.address, amount)
    await CappedWOETH.connect(minter).deposit(amount, vaultID, true)




}

const withdraw = async () => {

    console.log("WITHDRAW")

    const vaultID = 11
    const minterAddr = "0x767A60F295AEDd958932088F9Cd6a4951D8739b6"
    const minter = ethers.provider.getSigner(minterAddr)
    const vault: IVault = IVault__factory.connect("0xBd212D1b6f1c31F9B6B1cAc291a00F281C8C7FFb", minter)

    await impersonateAccount(minterAddr)
    await vault.connect(minter).withdrawErc20(od.CappedOp, BN("1e15"))

}

const increseObs = async (signer: SignerWithAddress) => {
    let opPool = IUniV3Pool__factory.connect(oa.OP_UNI_POOL, signer)
    let [,
        ,
        ,
        opObservations,
        ,
        ,
    ] = await opPool.slot0()

    console.log("Current obs: ", opObservations)

    const observations = 4800

    console.log("Setting higher observations...")
    const result = await opPool.increaseObservationCardinalityNext(observations)
    const gas = await getGas(result)
    console.log(`Set OP pool observations to ${observations}, gas: `, gas)


}

async function main() {

    const accounts = await ethers.getSigners();
    let deployer = accounts[0];

    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        console.log("TEST AT BLOCK: ", await (await currentBlock()).number)
        //await impersonateAccount(owner._address)
        //deployer = owner
    } else {
        console.log("TESTING AS: ", deployer.address)
    }

    console.log("TESTING")
    //await deposit(deployer)

    //await impersonateAccount(proposerAddr)
    //await propose(ethers.provider.getSigner(proposerAddr))

    //await increseObs(deployer)
    await hardhat_mine_timed(5000, 15)
    await withdraw()




}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
