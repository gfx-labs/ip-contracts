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

describe("ETH:", () => {
    before("deploy contracts", first);
    it("fetch uniswap relay price", async () => {
        let anchorPrice = await (await contracts.UniswapRelayEthUsdc!.currentValue()).div(1e14).toNumber() / 1e4
        expect(anchorPrice).to.be.above(1000).and.to.be.below(10000);
        showBody(anchorPrice);
    });
    it("fetch chainlink relay price", async () => {
        let chainlinkPrice = await (await contracts.ChainlinkEth!.currentValue()).div(1e14).toNumber() / 1e4
        expect(chainlinkPrice).to.be.above(1000).and.to.be.below(10000);
        showBody(chainlinkPrice);
    });
    it("verify chainlink price within anchor bounds", async () => {
        let anchorPrice = await (await contracts.UniswapRelayCompUsdc!.currentValue()).div(1e14).toNumber() / 1e4
        let chainlinkPrice = await (await contracts.ChainlinkEth!.currentValue()).div(1e14).toNumber() / 1e4
        let numerator = (await contracts.AnchoredViewEth!._widthNumerator()).toNumber();
        let denominator = (await contracts.AnchoredViewEth!._widthDenominator()).toNumber();
        let buffer = (numerator * anchorPrice) / denominator;
        let upperBounds = anchorPrice + buffer;
        let lowerBounds = anchorPrice - buffer;
        expect(chainlinkPrice < upperBounds);
        expect(chainlinkPrice > lowerBounds);
    });
    it("fetch oracle master price", async () => {
        let mainPrice = await (await contracts.AnchoredViewEth!.currentValue()).div(1e14).toNumber() / 1e4
        let oraclePrice = (await contracts.Oracle!.get_live_price(Mainnet.wethAddress)).div(1e14).toNumber() / 1e4
        let chainlinkPrice = await (await contracts.ChainlinkEth!.currentValue()).div(1e14).toNumber() / 1e4
        expect(mainPrice = chainlinkPrice);
        expect(oraclePrice = mainPrice);
        showBody(oraclePrice)
    });
});

describe("COMP:", () => {
    before("deploy contracts", first);
    it("fetch uniswap relay price", async () => {
        let anchorPrice = await (await contracts.UniswapRelayCompUsdc!.currentValue()).div(1e14).toNumber() / 1e4
        expect(anchorPrice).to.be.above(100).and.to.be.below(1000);
        showBody(anchorPrice);
    });
    it("fetch chainlink relay price", async () => {
        let chainlinkPrice = await (await contracts.ChainlinkComp!.currentValue()).div(1e14).toNumber() / 1e4
        expect(chainlinkPrice).to.be.above(100).and.to.be.below(1000);
        showBody(chainlinkPrice);
    });
    it("verify chainlink price within anchor bounds", async () => {
        let anchorPrice = await (await contracts.UniswapRelayCompUsdc!.currentValue()).div(1e14).toNumber() / 1e4
        let chainlinkPrice = await (await contracts.ChainlinkComp!.currentValue()).div(1e14).toNumber() / 1e4
        let numerator = (await contracts.AnchoredViewComp!._widthNumerator()).toNumber();
        let denominator = (await contracts.AnchoredViewComp!._widthDenominator()).toNumber();
        let buffer = (numerator * anchorPrice) / denominator;
        let upperBounds = anchorPrice + buffer;
        let lowerBounds = anchorPrice - buffer;
        expect(chainlinkPrice < upperBounds);
        expect(chainlinkPrice > lowerBounds);
    });
    it("fetch oracle master price", async () => {
        let mainPrice = await (await contracts.AnchoredViewComp!.currentValue()).div(1e14).toNumber() / 1e4
        let oraclePrice = (await contracts.Oracle!.get_live_price(Mainnet.compAddress)).div(1e14).toNumber() / 1e4
        let chainlinkPrice = await (await contracts.ChainlinkComp!.currentValue()).div(1e14).toNumber() / 1e4
        expect(mainPrice = chainlinkPrice);
        expect(oraclePrice = mainPrice);
        showBody(oraclePrice)
    });
});

/*
describe("ORACLE-RELAY-UNISWAP:", () => {
    before("deploy contracts", first);
    it("fetch eth price", async () => {
        let dog = await (await contracts.UniswapRelayEthUsdc!.currentValue()).div(1e14).toNumber() / 1e4
        showBody(dog);
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });
});

describe("ORACLE-RELAY-COMP:", () => {
    before("deploy contracts", first);
    it("fetch comp price", async () => {
        let dog = await (await contracts.UniswapRelayCompUsdc!.currentValue()).div(1e14).toNumber() / 1e4
        showBody(dog);
        expect(dog).to.be.above(100).and.to.be.below(1000);
    });
});

describe("ANCHORED VIEW ETH:", () => {
    before("deploy contracts", first);
    it("fetch eth price", async () => {
        let dog = await (await contracts.AnchoredViewEth!.currentValue()).div(1e14).toNumber() / 1e4
        showBody(dog);
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });
});

describe("ANCHORED VIEW COMP:", () => {
    before("deploy contracts", first);
    it("fetch comp price", async () => {
        let dog = await (await contracts.AnchoredViewComp!.currentValue()).div(1e14).toNumber() / 1e4
        showBody(dog);
        expect(dog).to.be.above(100).and.to.be.below(1000);
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
*/
