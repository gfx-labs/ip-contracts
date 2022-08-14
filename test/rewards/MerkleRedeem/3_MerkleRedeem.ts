import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { upgrades, ethers } from "hardhat";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber } from "../../../util/math"
import {
    MerkleRedeem__factory
} from "../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";


require("chai").should();

const initMerkle = async () => {


    let leafNodes = s.mergedList.map((obj) =>
        solidityKeccak256(["address", "uint256"], [obj.minter, utils.parseEther(obj.amount.toFixed(18).toString())])
    )
    merkleTree1 = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
    root1 = merkleTree1.getHexRoot()
}
let root1: string
let root2: string
let merkleTree1: MerkleTree
let merkleTree2: MerkleTree

describe("Merkle Redeem", () => {

    let proof: any
    let leaf: any

    let total = BN(0)
    const week = 1
    //let LP = s.mergedList[0].minter
    let LP: string
    let _claimedBalance: BigNumber
    before(async () => {
        LP = s.mergedList[1].minter
        _claimedBalance = utils.parseEther(s.mergedList[1].amount.toFixed(18).toString())

        await initMerkle()
        leaf = solidityKeccak256(["address", "uint256"], [LP, _claimedBalance])

        proof = merkleTree1.getHexProof(leaf)
    })




    it("Admin Seeds Allocations", async () => {

        const root = root1

        s.mergedList.map((obj) =>
            total = total.add(utils.parseEther(obj.amount.toFixed(18).toString()))
        )
        await s.IPT.connect(s.Frank).approve(s.MerkleRedeem.address, total)
        await s.MerkleRedeem.connect(s.Frank).seedAllocations(
            week,
            root,
            total
        )
        await mineBlock()

        let balance = await s.IPT.balanceOf(s.MerkleRedeem.address)
        expect(balance).to.eq(total, "Correct amount of IPT transferred")


    })

    it("Verify Claim", async () => {


        //showBody(utils.parseEther("503.32659734721505553"))
        //showBody(utils.parseEther(503.32659734721505553.toString()))

        //showBody(proof)
        //showBody(s.uniList)

        const result = await s.MerkleRedeem.verifyClaim(LP, week, _claimedBalance, proof)
        expect(result).to.eq(true)
    })

    it("Claim Status", async () => {

        const status = await s.MerkleRedeem.claimStatus(LP, week, week)
        expect(status[0]).to.eq(false, "LP has not claimed")

    })

    it("Do a claim", async () => {

        const startingIPT = await s.IPT.balanceOf(LP)
        expect(startingIPT).to.eq(0, "LP has 0 IPT before claim")

        await s.MerkleRedeem.claimWeek(LP, week, _claimedBalance, proof)
        await mineBlock()

        showBody("Balance: ", await toNumber(await s.IPT.balanceOf(LP)))

    })






})