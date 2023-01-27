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

require("chai").should();
describe("Merkle Redeem", () => {
    let LP1: minter
    let LP2: minter

    let claim1: BigNumber
    let claim2: BigNumber

    let proof1: any
    let proof2: any


    let total = BN(0)
    const week = 31

    let startingIPT: BigNumber

    before(async () => {
        LP1 = s.mergedList[0]
        LP2 = s.mergedList[1]

        claim1 = BN(LP1.amount)
        claim2 = BN(LP2.amount)

        let leaf = solidityKeccak256(["address", "uint256"], [LP1.minter, claim1])
        proof1 = s.MERKLE_TREE.getHexProof(leaf)

        leaf = solidityKeccak256(["address", "uint256"], [LP2.minter, claim2])
        proof2 = s.MERKLE_TREE.getHexProof(leaf)

        startingIPT = await s.IPT.balanceOf(s.MerkleRedeem.address)


    })

    it("Check invalid seedAllocations", async () => {

        const amount = BN("50e18")

        await s.IPT.connect(s.Frank).transfer(s.Andy.address, amount)
        await mineBlock()
        await s.IPT.connect(s.Andy).approve(s.MerkleRedeem.address, amount)
        expect(s.MerkleRedeem.connect(s.Andy).seedAllocations(
            week,
            s.ROOT,
            amount
        )).to.be.revertedWith("Ownable: caller is not the owner")
        await mineBlock()

        //return IPT
        await s.IPT.connect(s.Andy).transfer(s.Frank.address, amount)
        await mineBlock()

    })

    it("Admin Seeds Allocations", async () => {

        await impersonateAccount(s.DEPLOYER._address)
        s.mergedList.map((obj) =>
            total = total.add(BN(obj.amount))
        )
        showBody("ADMIN: ", s.DEPLOYER._address)
        showBody("Admin balance: ", await toNumber(await s.IPT.balanceOf(s.DEPLOYER._address)))
        showBody("Total amount : ", await toNumber(total))
        await s.IPT.connect(s.DEPLOYER).approve(s.MerkleRedeem.address, total)
        await s.MerkleRedeem.connect(s.DEPLOYER).seedAllocations(
            week,
            s.ROOT,
            total
        )
        console.log("WEEK: ", week)
        console.log("ROOT: ", s.ROOT)
        console.log("Total: ", total.toString())
        await mineBlock()

        await ceaseImpersonation(s.DEPLOYER._address)

    })

    it("Verify Claim", async () => {

        let result = await s.MerkleRedeem.verifyClaim(LP1.minter, week, claim1, proof1)
        expect(result).to.eq(true, "LP1 passed")

        result = await s.MerkleRedeem.verifyClaim(LP2.minter, week, claim2, proof2)
        expect(result).to.eq(true, "LP2 passed")

    })

    it("Claim Status", async () => {
        let status = await s.MerkleRedeem.claimStatus(LP1.minter, week, week)
        expect(status[0]).to.eq(false, "LP1 has not claimed")

        status = await s.MerkleRedeem.claimStatus(LP2.minter, week, week)
        expect(status[0]).to.eq(false, "LP2 has not claimed")

    })

    it("Do a claim for LP1", async () => {

        const startingIPT = await s.IPT.balanceOf(LP1.minter)

        expect(s.MerkleRedeem.claimWeek(LP1.minter, week, claim1, proof2)).to.be.revertedWith("Incorrect merkle proof")

        const result = await s.MerkleRedeem.claimWeek(LP1.minter, week, claim1, proof1)
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to claimWeek: ", gas)

        let balance = await s.IPT.balanceOf(LP1.minter)
        expect(await toNumber(balance.sub(startingIPT))).to.eq(await toNumber(BN(LP1.amount)))


    })
    it("Do a claim for LP2 using claimWeeks", async () => {

        const startingIPT = await s.IPT.balanceOf(LP2.minter)

        const claims = [
            {
                week: week,
                balance: claim2,
                merkleProof: proof2
            }
        ]
        const result = await s.MerkleRedeem.claimWeeks(LP2.minter, claims)
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to claim 1 week using claimWeeks: ", gas)

        let balance = await s.IPT.balanceOf(LP2.minter)

        expect(await toNumber(balance.sub(startingIPT))).to.eq(await toNumber(BN(LP2.amount)))

    })

    it("Check all verifications", async () => {

        //start from 2 since LP1 and LP2 claimed already above
        for (let i = 2; i < s.mergedList.length; i++) {


            let claim = BN(s.mergedList[i].amount)
            let minter = s.mergedList[i].minter

            let leaf = solidityKeccak256(["address", "uint256"], [minter, claim])
            let proof = s.MERKLE_TREE.getHexProof(leaf)

            let result = await s.MerkleRedeem.verifyClaim(minter, week, claim, proof)
            expect(result).to.eq(true, `${minter} verified`)


            let status = await s.MerkleRedeem.claimStatus(minter, week, week)
            expect(status[0]).to.eq(false, `${minter} has not claimed`)

        }
    })

    it("Everyone redeems for this week", async () => {
        let balance = await s.IPT.balanceOf(s.MerkleRedeem.address)
        expect(balance).to.be.gt(startingIPT, "MerkleRedeem still holds IPT, sanity check")

        showBodyCyan("Redeeming...")
        //start from 2 since LP1 and LP2 claimed already above
        for (let i = 2; i < s.mergedList.length; i++) {
            let claim = BN(s.mergedList[i].amount)
            let minter = s.mergedList[i].minter

            let leaf = solidityKeccak256(["address", "uint256"], [minter, claim])
            let proof = s.MERKLE_TREE.getHexProof(leaf)

            const initIPT = await s.IPT.balanceOf(minter)

            await s.MerkleRedeem.claimWeek(minter, week, claim, proof)
            await mineBlock()
            //const gas = await getGas(result)
            //showBodyCyan("Gas to claimWeek: ", gas)

            let balance = await s.IPT.balanceOf(minter)
            expect(await toNumber(balance.sub(initIPT))).to.eq(await toNumber(BN(claim)))
        }
    })

    it("Check end state", async () => {
        //start from 0 this time, check everyone
        for (let i = 0; i < s.mergedList.length; i++) {

            let minter = s.mergedList[i].minter

            let status = await s.MerkleRedeem.claimStatus(minter, week, week)
            expect(status[0]).to.eq(true, `${minter} has claimed`)

        }

        let balance = await s.IPT.balanceOf(s.MerkleRedeem.address)
        expect(balance).to.eq(startingIPT, "All redemptions done, remaining IPT is exactly what it was before, calculations correct")

    })
})

