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
import { toNumber, minter, mergeLists, getGas } from "../../../util/math"
import {
    MerkleRedeem__factory
} from "../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
import { ceaseImpersonation, impersonateAccount } from "../../../util/impersonator";

import { uniMintersWeek2, borrowMintersWeek2 } from "../data"
import { fail } from "assert";
import { start } from "repl";

require("chai").should();

const initMerkle = async (list: minter[]) => {

    let leafNodes = list.map((obj) =>
        solidityKeccak256(["address", "uint256"], [obj.minter, utils.parseEther(obj.amount.toFixed(18).toString())])
    )
    let merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true })

    return merkleTree
}
let root1: string
let root2: string
let root3: string
let merkleTree1: MerkleTree
let merkleTree2: MerkleTree
let merkleTree3: MerkleTree

const week3Data = [
    {
        minter: '0x7Bd82d87F75dC36F47e3508b6F8e77cA63b16e75', //LP1
        amount: 0.147856821456977451
    },
    {
        minter: '0x060a24A6C7a493D2bc58dB7B03becE9e67d2bD53',//LP2
        amount: 0.00022992170953019970514
    },
    {
        minter: '0xC16414AC1fedfDAC4F8A09674D994e1BbB9d7113',
        amount: 0.00014130940795407511552
    }
]

let LP1: minter
let LP2: minter

describe("Merkle Redeem", () => {

    let proof: any
    let leaf: any

    let total = BN(0)
    const week = 1
    //let LP = s.mergedList[0].minter
    let LP: string
    let _claimedBalance: BigNumber
    before(async () => {
        LP1 = s.mergedList[1]
        LP2 = s.mergedList[2]
        LP = LP1.minter

        showBody("ToFixed toString: ", utils.parseEther(LP2.amount.toFixed(18).toString()))
        showBody("Attempt 2       : ", utils.parseEther("0.000210831814646832"))

        _claimedBalance = utils.parseEther(LP1.amount.toFixed(18).toString())

        merkleTree1 = await initMerkle(s.mergedList)
        root1 = merkleTree1.getHexRoot()

        //merkleTree2 = tree
        leaf = solidityKeccak256(["address", "uint256"], [LP, _claimedBalance])

        proof = merkleTree1.getHexProof(leaf)
    })

    it("Check invalid seedAllocations", async () => {

        const amount = BN("50e18")

        await s.IPT.connect(s.Frank).transfer(s.Andy.address, amount)
        await mineBlock()
        await s.IPT.connect(s.Andy).approve(s.MerkleRedeem.address, amount)
        expect(s.MerkleRedeem.connect(s.Andy).seedAllocations(
            week,
            root1,
            amount
        )).to.be.revertedWith("Ownable: caller is not the owner")
        await mineBlock()

        //return IPT
        await s.IPT.connect(s.Andy).transfer(s.Frank.address, amount)
        await mineBlock()

    })

    it("Admin Seeds Allocations", async () => {

        s.mergedList.map((obj) =>
            total = total.add(utils.parseEther(obj.amount.toFixed(18).toString()))
        )

        await s.IPT.connect(s.Frank).approve(s.MerkleRedeem.address, total)
        await s.MerkleRedeem.connect(s.Frank).seedAllocations(
            week,
            root1,
            total
        )
        await mineBlock()

        let balance = await s.IPT.balanceOf(s.MerkleRedeem.address)
        expect(balance).to.eq(total, "Correct amount of IPT transferred")

    })

    it("Verify Claim", async () => {
        const failedResult = await s.MerkleRedeem.verifyClaim(LP, week, _claimedBalance.add(1), proof)
        expect(failedResult).to.eq(false, "Not verified")

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

        expect(s.MerkleRedeem.claimWeek(LP2.minter, week, _claimedBalance, proof)).to.be.revertedWith("Incorrect merkle proof")

        const result = await s.MerkleRedeem.claimWeek(LP, week, _claimedBalance, proof)
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to claimWeek: ", gas)

        let balance = await s.IPT.balanceOf(LP)
        expect(await toNumber(balance)).to.eq(LP1.amount)

    })
})

describe("New week", () => {
    const uniWeek2 = Array.from(uniMintersWeek2)
    const borrowWeek2 = Array.from(borrowMintersWeek2)



    let mergedWeek2: minter[] = []

    before(async () => {
        mergedWeek2 = await mergeLists(borrowWeek2, uniWeek2)
        merkleTree2 = await initMerkle(mergedWeek2)
        root2 = merkleTree2.getHexRoot()
    })

    it("Set up data for new week", async () => {
        let total = BN(0)
        mergedWeek2.map((obj) =>
            total = total.add(utils.parseEther(obj.amount.toFixed(18).toString()))
        )
        await s.IPT.connect(s.Frank).approve(s.MerkleRedeem.address, total)
        await s.MerkleRedeem.connect(s.Frank).seedAllocations(
            2,
            root2,
            total
        )
        await mineBlock()

    })

    it("LP1 claims for week 2", async () => {

        const startingIPT = await s.IPT.balanceOf(LP1.minter)
        expect(await toNumber(startingIPT)).to.eq(LP1.amount)

        //verify claim
        let expected = 0
        for (let i = 0; i < mergedWeek2.length; i++) {

            if (mergedWeek2[i].minter == LP1.minter) {
                expected = mergedWeek2[i].amount
            }

        }
        let leaf = solidityKeccak256(["address", "uint256"], [LP1.minter, utils.parseEther(expected.toFixed(18).toString())])

        let proof = merkleTree2.getHexProof(leaf)

        let result = await s.MerkleRedeem.verifyClaim(LP1.minter, 2, utils.parseEther(expected.toFixed(18).toString()), proof)
        expect(result).to.eq(true, "Proof passed")

        //check claim status
        const status = await s.MerkleRedeem.claimStatus(LP1.minter, 1, 2)
        expect(status[0]).to.eq(true, "week 1 claimed")
        expect(status[1]).to.eq(false, "week 2 not claimed")


        //claim week 2
        await s.MerkleRedeem.claimWeek(LP1.minter, 2, utils.parseEther(expected.toFixed(18).toString()), proof)
        await mineBlock()

        let balance = await s.IPT.balanceOf(LP1.minter)
        expect(await toNumber(balance.sub(startingIPT))).to.eq(expected, "Delta is correct")

    })

    it("Week 3 with new data", async () => {


        merkleTree3 = await initMerkle(week3Data)
        root3 = merkleTree3.getHexRoot()

        //seed allocation 
        let total = BN(0)
        week3Data.map((obj) =>
            total = total.add(utils.parseEther(obj.amount.toFixed(18).toString()))
        )
        await s.IPT.connect(s.Frank).approve(s.MerkleRedeem.address, total)
        await s.MerkleRedeem.connect(s.Frank).seedAllocations(
            3,
            root3,
            total
        )
        await mineBlock()

        //Verify claim
        let leaf = solidityKeccak256(["address", "uint256"], [LP1.minter, utils.parseEther(week3Data[0].amount.toFixed(18).toString())])
        let proof = merkleTree3.getHexProof(leaf)
        const verification = await s.MerkleRedeem.verifyClaim(LP1.minter, 3, utils.parseEther(week3Data[0].amount.toFixed(18).toString()), proof)
        expect(verification).to.eq(true, "Verification works for week 3")

        //do claim
        const startIPT = await s.IPT.balanceOf(LP1.minter)
        await s.MerkleRedeem.claimWeek(LP1.minter, 3, utils.parseEther(week3Data[0].amount.toFixed(18).toString()), proof)
        await mineBlock()

        let balance = await s.IPT.balanceOf(LP1.minter)
        expect(await toNumber(balance)).to.eq(await toNumber(startIPT) + week3Data[0].amount, "Correct IPT received")

    })
})
describe("Claim Weeks", () => {

    const borrowWeek2 = Array.from(borrowMintersWeek2)

    it("Check start state", async () => {
        expect(LP2.minter).to.eq(s.mergedList[2].minter).to.eq(borrowWeek2[2].minter).to.eq(week3Data[1].minter, "LP2 Minter is as expected")
        let balance = await s.IPT.balanceOf(LP2.minter)
        expect(balance).to.eq(0, "LP2 holds 0 IPT")

    })

    it("Claim for all 3 weeks", async () => {

        //Verify claim
        let leaf = solidityKeccak256(["address", "uint256"], [LP2.minter, utils.parseEther(LP2.amount.toFixed(18).toString())])
        let proof1 = merkleTree1.getHexProof(leaf)
        //Verify claim
        leaf = solidityKeccak256(["address", "uint256"], [LP2.minter, utils.parseEther(borrowWeek2[2].amount.toFixed(18).toString())])
        let proof2 = merkleTree2.getHexProof(leaf)
        //Verify claim
        leaf = solidityKeccak256(["address", "uint256"], [LP2.minter, utils.parseEther(week3Data[1].amount.toFixed(18).toString())])
        let proof3 = merkleTree3.getHexProof(leaf)

        const claims = [
            {
                week: 1,
                balance: utils.parseEther(LP2.amount.toFixed(18).toString()),
                merkleProof: proof1
            },
            {
                week: 2,
                balance: utils.parseEther(borrowWeek2[2].amount.toFixed(18).toString()),
                merkleProof: proof2
            },
            {
                week: 3,
                balance: utils.parseEther(week3Data[1].amount.toFixed(18).toString()),
                merkleProof: proof3
            }
        ]


        //verify claims for all 3 weeks
        const claim1 = await s.MerkleRedeem.verifyClaim(LP2.minter, 1, utils.parseEther(LP2.amount.toFixed(18).toString()), claims[0].merkleProof)
        expect(claim1).to.eq(true)

        const claim2 = await s.MerkleRedeem.verifyClaim(LP2.minter, 2, utils.parseEther(borrowWeek2[2].amount.toFixed(18).toString()), claims[1].merkleProof)
        expect(claim2).to.eq(true)

        const claim3 = await s.MerkleRedeem.verifyClaim(LP2.minter, 3, utils.parseEther(week3Data[1].amount.toFixed(18).toString()), claims[2].merkleProof)
        expect(claim3).to.eq(true)

        const result = await s.MerkleRedeem.claimWeeks(LP2.minter, claims)
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to claim 3 weeks: ", gas)

        let balance = await s.IPT.balanceOf(LP2.minter)
        let expected = LP2.amount + borrowWeek2[2].amount + week3Data[1].amount

        expect(await toNumber(balance)).to.be.closeTo(expected, 0.0000001, "Expected IPT received")//not exact due differing decimal lengths

        //check claim status
        const status = await s.MerkleRedeem.claimStatus(LP2.minter, 1, 3)
        expect(status[0]).to.eq(true, "Claimed week 1")
        expect(status[1]).to.eq(true, "Claimed week 2")
        expect(status[2]).to.eq(true, "Claimed week 3")


    })

    it("Check gas for claimWeeks for only 1 week", async () => {
        const LP3 = s.mergedList[3]
        const status = await s.MerkleRedeem.claimStatus(LP3.minter, 1, 3)
        expect(status[0]).to.eq(false, "Not Claimed week 1")
        expect(status[1]).to.eq(false, "Not Claimed week 2")
        expect(status[2]).to.eq(false, "Not Claimed week 3")


        //Verify claim
        let leaf = solidityKeccak256(["address", "uint256"], [LP3.minter, utils.parseEther(LP3.amount.toFixed(18).toString())])
        let proof = merkleTree1.getHexProof(leaf)

        const verification = await s.MerkleRedeem.verifyClaim(LP3.minter, 1, utils.parseEther(LP3.amount.toFixed(18).toString()), proof)
        expect(verification).to.eq(true, "Claim verified")

        //claimWeeks for just week 1

        const claims = [
            {
                week: 1,
                balance: utils.parseEther(LP3.amount.toFixed(18).toString()),
                merkleProof: proof
            }
        ]

        const result = await s.MerkleRedeem.claimWeeks(LP3.minter, claims)
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to claim 1 week using claimWeeks: ", gas)

        const merkleWeekRoots = await s.MerkleRedeem.weekMerkleRoots(57)
        showBody(merkleWeekRoots)




    })

})