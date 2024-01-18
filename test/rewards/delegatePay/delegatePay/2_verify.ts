import { s, minter } from "../scope";
import { d } from "../../DeploymentInfo";
import { upgrades, ethers } from "hardhat";
import { showBody, showBodyCyan } from "../../../../util/format";
import { BN } from "../../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../../util/block";
import { utils, BigNumber } from "ethers";
import { currentBlock, reset } from "../../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import { toNumber, mergeLists, getGas } from "../../../../util/math"
import {
    MerkleRedeem__factory
} from "../../../../typechain-types"
import { red } from "bn.js";
import { DeployContract, DeployContractWithProxy } from "../../../../util/deploy";
import { ceaseImpersonation, impersonateAccount } from "../../../../util/impersonator";
import { stealMoney } from "../../../../util/money";

require("chai").should();
describe("Merkle Redeem", () => {
    let LP1: minter
    let LP2: minter

    let claim1: BigNumber
    let claim2: BigNumber

    let proof1: any
    let proof2: any


    let total = BN(0)
    const week = 1011

    let startingIPT: BigNumber

    before(async () => {
        LP1 = s.delegateList[0]
        //LP2 = s.delegateList[1]

        claim1 = BN(LP1.amount)
        //claim2 = BN(LP2.amount)

        let leaf = solidityKeccak256(["address", "uint256"], [LP1.minter, claim1])
        proof1 = s.MERKLE_TREE.getHexProof(leaf)

        //leaf = solidityKeccak256(["address", "uint256"], [LP2.minter, claim2])
        //proof2 = s.MERKLE_TREE.getHexProof(leaf)

        startingIPT = await s.IPT.balanceOf(s.MerkleRedeem.address)


    })

    it("Admin Seeds Allocations", async () => {

        s.delegateList.map((obj) =>
            total = total.add(BN(obj.amount))
        )


        //fund 
        const beef = "0xa6e8772af29b29B9202a073f8E36f447689BEef6"
        const tx = {
            to: beef,
            value: ethers.utils.parseEther("1")
        }
        const tx2 = {
            to: s.DEPLOYER._address,
            value: ethers.utils.parseEther("1")
        }
        await s.Frank.sendTransaction(tx)
        await mineBlock()
        await s.Frank.sendTransaction(tx2)
        await mineBlock()
        await stealMoney(beef, s.DEPLOYER._address, s.IPT.address, total)
        await mineBlock()

        await impersonateAccount(s.DEPLOYER._address)

        showBody(s.IPT.address)
        await s.IPT.connect(s.DEPLOYER).approve(s.MerkleRedeem.address, total)
        await s.MerkleRedeem.connect(s.DEPLOYER).seedAllocations(
            week,
            s.ROOT,
            total
        )
        console.log("WEEK: ", week)
        console.log("ROOT: ", s.ROOT)
        console.log("Total: ", total.toString())

        //output object
        let formatObject: Record<string, string> = {}

        for (const object of s.delegateList) {
            formatObject[object.minter] = object.amount.toString()
        }
        console.log(formatObject)

        await mineBlock()

        await ceaseImpersonation(s.DEPLOYER._address)

    })

    it("Verify Claim", async () => {

        let result = await s.MerkleRedeem.verifyClaim(LP1.minter, week, claim1, proof1)
        expect(result).to.eq(true, "LP1 passed")

    })

    it("Claim Status", async () => {
        let status = await s.MerkleRedeem.claimStatus(LP1.minter, week, week)
        expect(status[0]).to.eq(false, "LP1 has not claimed")
    })



    it("Everyone redeems for this week", async () => {

        showBodyCyan("Redeeming...")
        //start from 2 since LP1 and LP2 claimed already above
        for (let i = 0; i < s.delegateList.length; i++) {
            let claim = BN(s.delegateList[i].amount)
            let minter = s.delegateList[i].minter

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
        for (let i = 0; i < s.delegateList.length; i++) {

            let minter = s.delegateList[i].minter

            let status = await s.MerkleRedeem.claimStatus(minter, week, week)
            expect(status[0]).to.eq(true, `${minter} has claimed`)

        }

        let balance = await s.IPT.balanceOf(s.MerkleRedeem.address)
        expect(balance).to.eq(startingIPT, "All redemptions done, remaining IPT is exactly what it was before, calculations correct")

    })
})

