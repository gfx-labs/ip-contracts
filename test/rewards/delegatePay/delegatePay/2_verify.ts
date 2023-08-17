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

require("chai").should();
describe("Merkle Redeem", () => {
    let LP1: minter
    let LP2: minter

    let claim1: BigNumber
    let claim2: BigNumber

    let proof1: any
    let proof2: any


    let total = BN(0)
    const week = 1007

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
        //0x958892b4a0512b28AaAC890FC938868BBD42f064
        await impersonateAccount(s.DEPLOYER._address)
        s.delegateList.map((obj) =>
            total = total.add(BN(obj.amount))
        )
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

        for(const object of s.delegateList){
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

