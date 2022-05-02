import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../util/format";
import { BN } from "../../util/number";
import { currentBlock, advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "../../util/block";
import { start } from "repl";
import {treeFromObject, getAccountProof, createTree } from "../../util/wave"
import { sha256, sha224 } from 'js-sha256';
import MerkleTree from "merkletreejs";

const merkletree = createTree();
const root = merkletree.getHexRoot()

const totalSupply_ = BN("1e26")
let Wave:any
describe("Deploy wave", () => {
    it("deploys wave", async () => {

        //init constructor args

        const totalReward = totalSupply_.div(4)
        const floor = BN("5e5")//500,000 - .5 USDC
        const block = await currentBlock()
        const enableTime = block.timestamp
        const disableTime = enableTime + OneWeek
        const receiver = s.Frank.address
        //showBody(s.Frank.address)

        const waveFactory = await ethers.getContractFactory("Wave")
        Wave = await waveFactory.connect(s.Frank).deploy(root, totalReward, floor, enableTime, disableTime, receiver)

    })
})


describe("Presale", () => {
    it("does the presale ", async () => {

        showBody(root)

    })
})