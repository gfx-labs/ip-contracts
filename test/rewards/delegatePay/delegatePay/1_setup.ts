import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../../util/money";
import { showBody, showBodyCyan } from "../../../../util/format";
import { BN } from "../../../../util/number";
import { toNumber, mergeLists, getGas } from "../../../../util/math"
import { s, minter } from "../scope";
import { d } from "../../DeploymentInfo";

import { advanceBlockHeight, reset, mineBlock } from "../../../../util/block";
import { InterestProtocolTokenDelegate__factory, IERC20__factory, IVOTE__factory, VaultController__factory, USDI__factory, OracleMaster__factory, CurveMaster__factory, ProxyAdmin__factory, MerkleRedeem__factory } from "../../../../typechain-types";
//import { assert } from "console";
import { mainnetData } from "../../MerkleRedeem/mainnetData"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import MerkleTree from "merkletreejs";

require("chai").should();
//*
// Initial Balances:
// Andy: 100,000,000 usdc ($100) 6dec
// Bob: 10,000,000,000,000,000,000 weth (10 weth) 18dec
// Carol: 100,000,000,000,000,000,000 (100 comp), 18dec
// Dave: 10,000,000,000 usdc ($10,000) 6dec
//
// andy is a usdc holder. he wishes to deposit USDC to hold USDI
// bob is an eth holder. He wishes to deposit his eth and borrow USDI
// carol is a comp holder. she wishes to deposit her comp and then vote
// dave is a liquidator. he enjoys liquidating, so he's going to try to liquidate Bob
// configurable variables
let usdc_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";

if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}
/**
 * CHECKLIST
 * Check that data exists in both files
 * merge lists && change filenames there
 * set blocknum
 * set week for file below for LPS
 * set week num in 2_verify
 */
describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(17069845)).to.not.throw;//14940917
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [false])).to.not
            .throw;
    });
});

describe("Token Setup", () => {
    before(async () => {
        //const LPS = require('../../../../rewardtree/mergedAndFormatWeek31.json')

        s.delegateList = [
            {
                minter: "0x070341aA5Ed571f0FB2c4a5641409B1A46b4961b",//Penn
                amount: BN("12374800000000000000000")
            },
            {
                minter: "0xe967F2232a6030BCc1D05E2CC5Dfa8fBB3ce9B53",//Adonis
                amount: BN("9805600000000000000000")
            },
            {
                minter: "0x5fee8d7d02B0cfC08f0205ffd6d6B41877c86558",//IPTman
                amount: BN("12022300000000000000000")
            }


        ]
    })
    it("connect to signers", async () => {
        let accounts = await ethers.getSigners();
        s.Frank = accounts[0];
        s.Eric = accounts[5];
        s.Andy = accounts[6];
        s.Bob = accounts[7];
        s.Carol = accounts[8];
        s.Dave = accounts[9];
        s.Gus = accounts[10];
    });
    it("Connect to existing contracts", async () => {
        s.USDC = IERC20__factory.connect(s.usdcAddress, s.Frank);
    });

    it("Connect to mainnet deployments for interest protocol", async () => {
        s.VaultController = VaultController__factory.connect(d.VaultController, s.Frank)
        s.USDI = USDI__factory.connect(d.USDI, s.Frank)
        s.Curve = CurveMaster__factory.connect(d.Curve, s.Frank)
        s.Oracle = OracleMaster__factory.connect(d.Oracle, s.Frank)

        s.ProxyAdmin = ProxyAdmin__factory.connect(d.ProxyAdmin, s.Frank)
        const IPTaddress = "0xd909C5862Cdb164aDB949D92622082f0092eFC3d"
        s.IPT = InterestProtocolTokenDelegate__factory.connect(IPTaddress, s.Frank);


    })

    it("Connect to mainnet deploy for MerkleRedeem contract, and initialize root", async () => {

        s.MerkleRedeem = MerkleRedeem__factory.connect("0x91a1Fb8eEaeB0E05629719938b03EE3C32348CF7", s.Frank)

        let leafNodes = s.delegateList.map((obj) =>
            solidityKeccak256(["address", "uint256"], [obj.minter, obj.amount])
        )

        s.MERKLE_TREE = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
        s.ROOT = s.MERKLE_TREE.getHexRoot()
    })

    it("Should succesfully transfer money", async () => {
        //showBody(`stealing ${s.Andy_USDC} to andy from ${s.usdcAddress}`);
        await stealMoney(usdc_minter, s.Andy.address, s.usdcAddress, s.Andy_USDC)
        await mineBlock()

        //showBody(`stealing`,s.Bob_USDC,`usdc to bob from ${s.usdcAddress}`);
        await stealMoney(usdc_minter, s.Bob.address, s.usdcAddress, s.Bob_USDC)
        await mineBlock()

        //steal 10 MM IPT for Admin
        //await stealMoney(s.DEPLOYER._address, s.Frank.address, s.IPT.address, BN("10000000e18"))
        //await mineBlock()


    });
});