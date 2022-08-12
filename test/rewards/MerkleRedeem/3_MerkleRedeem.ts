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

    
     let leafNodes = s.uniList.map((obj) => 
        solidityKeccak256(["address", "uint256"], [obj.minter, utils.parseEther(obj.amount.toString())])
    )
    merkleTree1 = new MerkleTree(leafNodes, keccak256, {sortPairs: true})     
    root1 = merkleTree1.getHexRoot()
}
let root1: string
let root2: string
let merkleTree1: MerkleTree
let merkleTree2: MerkleTree

describe("Merkle Redeem", () => {
    let total = BN(0)

    before(async () => {
        await initMerkle()
    })

    it("Admin Seeds Allocations", async () => {

        const week = 1
        const root = root1        
        
        s.uniList.map((obj) => 
            total = total.add(utils.parseEther(obj.amount.toString()))
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
        const LP = '0xd37Ca44e9C70BC155c0E7AB9C0CC4528f4734b96'
        const _claimedBalance = utils.parseEther(503.32659734721505553.toString())
        let leaf = solidityKeccak256(["address", "uint256"], [LP, _claimedBalance])
        const proof = merkleTree1.getHexProof(leaf)

        //showBody(utils.parseEther("503.32659734721505553"))
        //showBody(utils.parseEther(503.32659734721505553.toString()))

        //showBody(proof)
        //showBody(s.uniList)

        const result = await s.MerkleRedeem.verifyClaim(LP, 1, _claimedBalance, proof)
        expect(result).to.eq(true)
    })





})