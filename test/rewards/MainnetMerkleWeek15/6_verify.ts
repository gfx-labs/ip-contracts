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
describe("Merkle Redeem both weeks at once", () => {
    let LP1: minter
    let LP2: minter

    let claim1: BigNumber
    let claim2: BigNumber

    let proof1: any
    let proof2: any


    let total = BN(0)
    const week = 15
    const extraWeek = 155

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

    it("Admin Seeds Allocations", async () => {

        await impersonateAccount(s.DEPLOYER._address)
        s.mergedList.map((obj) =>
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
        await mineBlock()

        total = BN("0")
        s.mergedList2.map((obj) =>
            total = total.add(BN(obj.amount))
        )
        await s.IPT.connect(s.DEPLOYER).approve(s.MerkleRedeem.address, total)
        await s.MerkleRedeem.connect(s.DEPLOYER).seedAllocations(
            extraWeek,
            s.ROOT2,
            total
        )
        console.log("WEEK: ", extraWeek)
        console.log("ROOT: ", s.ROOT2)
        console.log("Total: ", total.toString())
        await mineBlock()

        await ceaseImpersonation(s.DEPLOYER._address)

    })



    it("test redeem for 2 weeks at once", async () => {
        const minter = "0xd37Ca44e9C70BC155c0E7AB9C0CC4528f4734b96"
        const amount15 = BN("9048234479501678251")
        const amount155 = BN("708937649185731743273")

        let leaf = solidityKeccak256(["address", "uint256"], [minter, amount15])
        const proof1 = s.MERKLE_TREE.getHexProof(leaf)


        leaf = solidityKeccak256(["address", "uint256"], [minter, amount155])
        const proof2 = s.MERKLE_TREE2.getHexProof(leaf)

        const claims = [
            {
                week: week,
                balance: amount15,
                merkleProof: proof1
            },
            {
                week: extraWeek,
                balance: amount155,
                merkleProof: proof2
            }
        ]

        const result = await s.MerkleRedeem.claimWeeks(minter, claims)
        await mineBlock()
        const gas = await getGas(result)
        showBodyCyan("Gas to claim 2 weeks using claimWeeks: ", gas)
    })
})

