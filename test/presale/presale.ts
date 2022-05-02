import { s } from "./scope";
import { ethers } from "hardhat";
import { BigNumber, utils } from "ethers";

import { expect, assert } from "chai";
import { showBody } from "../../util/format";
import {getArgs} from "../../util/math"
import { BN } from "../../util/number";
import { currentBlock, advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "../../util/block";
import { Impersonate, stopImpersonate, Impersonator } from "../../util/impersonator"
import { start } from "repl";
import { treeFromObject, getAccountProof, createTree } from "../../util/wave"
import { sha256, sha224 } from 'js-sha256';
import MerkleTree from "merkletreejs";

const merkleWallets = require("../data/data.json")

const merkletree = createTree();
const root = merkletree.getHexRoot()

const totalSupply_ = BN("1e26")
let Wave: any
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
        await mineBlock()
        await Wave.deployed()
        await mineBlock()
    })
    it("Sanity check state of Wave contract", async () => {
        const _enableTime = await Wave._enableTime()
        showBody(_enableTime)

        const totalReward = await Wave._totalClaimed()
        showBody(totalReward)
        assert.equal(totalReward.toString(), totalSupply_.div(4).toString(), "Total reward is correct")

        const floor = await Wave._floor()
        showBody(floor)

    })
})


describe("Presale", () => {
    it("getPoints", async () => {

        //getPoints
        const claimArray = Object.entries(merkleWallets);
        //const addr = claimArray[2][0];
        const amt = claimArray[3][1];
        const convertMultiplier = BN(amt).div(BN("1e6"));
        showBody("convertMultiplier: ", convertMultiplier)
        //await Wave.getPoints(BN("100e6"), BN("100e12"), root)

        const startingClaimed = await Wave._totalClaimed()

        const pointsResult = await Wave.connect(s.Bob)
            .getPoints(
                convertMultiplier,
                convertMultiplier,
                getAccountProof(merkletree, s.Bob.address, convertMultiplier)
            )
        await mineBlock()
        //const pointsArgs = await getArgs(pointsResult)
        //showBody(pointsArgs)

        const endingClaimed = await Wave._totalClaimed()
        showBody(startingClaimed)
        showBody(endingClaimed)

    })

    it("redeem before time has elapsed", async () => {
        let redeemedState = await Wave.redeemed(s.Bob.address)
        showBody("Initial redeemedState", redeemedState)

        await Wave.connect(s.Bob).redeem()
        await mineBlock()

        redeemedState = await Wave.redeemed(s.Bob.address)
        showBody("new redeemedState", redeemedState)

        let isEnabled = await Wave.isEnabled()
        showBody("isEnabled: ", isEnabled)
    

        showBody("FAST FORWARD")
        await fastForward(OneWeek)
        await mineBlock()

       
        


        //await expect(Wave.connect(s.Frank).redeem()).to.be.revertedWith("can't redeem yet")
    })
})