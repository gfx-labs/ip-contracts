import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { mergeLists } from "../../../util/math"
import { s } from "../scope";
import { d } from "../DeploymentInfo";

import { advanceBlockHeight, reset, mineBlock } from "../../../util/block";
import { InterestProtocolTokenDelegate__factory, IERC20__factory, IVOTE__factory, VaultController__factory, USDI__factory, OracleMaster__factory, CurveMaster__factory, ProxyAdmin__factory } from "../../../typechain-types";
//import { assert } from "console";

require("chai").should();
let usdc_minter = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
if (process.env.TENDERLY_KEY) {
    if (process.env.TENDERLY_ENABLE == "true") {
        let provider = new ethers.providers.Web3Provider(tenderly.network())
        ethers.provider = provider
    }
}
describe("hardhat settings", () => {
    it("Set hardhat network to a block after deployment", async () => {
        expect(await reset(15328790)).to.not.throw;//14940917
    });
    it("set automine OFF", async () => {
        expect(await network.provider.send("evm_setAutomine", [false])).to.not
            .throw;
    });
});

describe("Token Setup", () => {
    before(async () => {
        s.mergedList = await mergeLists(s.borrowList, s.uniList)
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
    it("Should succesfully transfer money", async () => {
        await stealMoney(usdc_minter, s.Andy.address, s.usdcAddress, s.Andy_USDC)
        await mineBlock()
        await stealMoney(usdc_minter, s.Dave.address, s.usdcAddress, s.Dave_USDC)
        await mineBlock()
        await stealMoney(s.DEPLOYER._address, s.Frank.address, s.IPT.address, BN("10000000e18"))
        await mineBlock()
        await stealMoney(usdc_minter, s.Bob.address, s.usdcAddress, s.Bob_USDC)
        await mineBlock()

    });
});