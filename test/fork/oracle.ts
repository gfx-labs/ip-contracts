import { expect } from "chai";
import { ethers } from "hardhat";
import { Mainnet } from "../util/addresser";
import { Deployment } from "../util/contractor";
import { showBody, showLine } from "../util/format";

let contracts = Deployment;

const first = async () => {
    let accounts = await ethers.getSigners();
    await contracts.deploy(accounts[0]).catch(console.log);
};

describe("ORACLE-RELAY-UNISWAP:", () => {
    before("deploy contracts", first);
    it("fetch eth price", async () => {
        let dog = await (await contracts.UniswapRelayEthUsdc!.currentValue()).div(1e14).toNumber() / 1e4
        showBody(dog);
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });
});

describe("ORACLE-MASTER:", () => {
    before("deploy contracts", first);
    it("fetch eth price", async () => {
        let dog = (await contracts.Oracle!.get_live_price(Mainnet.wethAddress)).div(1e14).toNumber() / 1e4
        showBody(dog)
        expect(dog).to.be.above(1000).and.to.be.below(10000);
        //expect(await usdi.owner()).to.eq(await deployer.getAddress())
    });

    it("comp price", async () => {
        let dog = (await contracts.Oracle!.get_live_price(Mainnet.compAddress)).div(1e14).toNumber() / 1e4
        showBody(dog)
        expect(dog).to.be.above(50).and.to.be.below(2000);
    })
});
