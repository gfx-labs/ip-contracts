import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../util/format";
import { BN } from "../util/number";


describe("ETH:", () => {
    it("fetch uniswap relay price", async () => {
        let anchorPrice = (await s.UniswapRelayEthUsdc.currentValue()).div(1e14).toNumber() / 1e4
        expect(anchorPrice).to.be.above(1000).and.to.be.below(10000);
        showBody("anchorPrice: ", anchorPrice);
    });
    it("fetch chainlink relay price", async () => {
        let chainlinkPrice = (await s.ChainlinkEth.currentValue()).div(1e14).toNumber() / 1e4
        expect(chainlinkPrice).to.be.above(1000).and.to.be.below(10000);
        showBody("chainlinkPrice: ", chainlinkPrice);
    });
    it("verify chainlink price within anchor bounds", async () => {
        let anchorPrice = (await s.UniswapRelayCompUsdc.currentValue()).div(1e14).toNumber() / 1e4
        let chainlinkPrice = (await s.ChainlinkEth.currentValue()).div(1e14).toNumber() / 1e4
        let numerator = (await s.AnchoredViewEth._widthNumerator()).toNumber();
        let denominator = (await s.AnchoredViewEth._widthDenominator()).toNumber();
        let buffer = (numerator * anchorPrice) / denominator;
        let upperBounds = anchorPrice + buffer;
        let lowerBounds = anchorPrice - buffer;
        expect(chainlinkPrice < upperBounds);
        expect(chainlinkPrice > lowerBounds);
    });
    it("fetch oracle master price", async () => {
        let mainPrice = (await s.AnchoredViewEth.currentValue()).div(1e14).toNumber() / 1e4
        let oraclePrice = (await s.Oracle.get_live_price(s.wethAddress)).div(1e14).toNumber() / 1e4
        let chainlinkPrice = (await s.ChainlinkEth.currentValue()).div(1e14).toNumber() / 1e4
        expect(mainPrice = chainlinkPrice);
        expect(oraclePrice = mainPrice);
        showBody(oraclePrice)
    });
});

describe("COMP:", () => {
    it("fetch uniswap relay price", async () => {
        let anchorPrice = (await s.UniswapRelayCompUsdc.currentValue()).div(1e14).toNumber() / 1e4
        expect(anchorPrice).to.be.above(100).and.to.be.below(1000);
        showBody(anchorPrice);
    });
    it("fetch chainlink relay price", async () => {
        let chainlinkPrice = (await s.ChainlinkComp.currentValue()).div(1e14).toNumber() / 1e4
        expect(chainlinkPrice).to.be.above(100).and.to.be.below(1000);
        showBody(chainlinkPrice);
    });
    it("verify chainlink price within anchor bounds", async () => {
        let anchorPrice = (await s.UniswapRelayCompUsdc.currentValue()).div(1e14).toNumber() / 1e4
        let chainlinkPrice = (await s.ChainlinkComp.currentValue()).div(1e14).toNumber() / 1e4
        let numerator = (await s.AnchoredViewComp._widthNumerator()).toNumber();
        let denominator = (await s.AnchoredViewComp._widthDenominator()).toNumber();
        let buffer = (numerator * anchorPrice) / denominator;
        let upperBounds = anchorPrice + buffer;
        let lowerBounds = anchorPrice - buffer;
        expect(chainlinkPrice < upperBounds);
        expect(chainlinkPrice > lowerBounds);
    });
    it("fetch oracle master price", async () => {
        let mainPrice = (await s.AnchoredViewComp.currentValue()).div(1e14).toNumber() / 1e4
        let oraclePrice = (await s.Oracle.get_live_price(s.compAddress)).div(1e14).toNumber() / 1e4
        let chainlinkPrice = (await s.ChainlinkComp.currentValue()).div(1e14).toNumber() / 1e4
        expect(mainPrice = chainlinkPrice);
        expect(oraclePrice = mainPrice);
        showBody(oraclePrice)
    });
});

describe("Uniswap oracles", () => {
    it("fetch eth price", async () => {
        let dog = (await s.UniswapRelayEthUsdc.currentValue()).div(1e14).toNumber() / 1e4
        showBody(dog);
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });

    it("fetch comp price", async () => {
        let dog = (await s.UniswapRelayCompUsdc.currentValue()).div(1e14).toNumber() / 1e4
        showBody(dog);
        expect(dog).to.be.above(100).and.to.be.below(1000);
    });
});

describe("anchored views", () => {
    it("fetch comp price", async () => {
        let dog = (await s.AnchoredViewComp.currentValue()).div(1e14).toNumber() / 1e4
        showBody(dog);
        expect(dog).to.be.above(100).and.to.be.below(1000);
    });
    it("fetch eth price", async () => {
        let dog = (await s.AnchoredViewEth.currentValue()).div(1e14).toNumber() / 1e4
        showBody(dog);
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });
});

describe("getting prices from oracle master", () => {
    it("fetch eth price", async () => {
        let dog = (await s.Oracle.get_live_price(s.wethAddress)).div(1e14).toNumber() / 1e4
        showBody(dog)
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });

    it("comp price", async () => {
        let dog = (await s.Oracle.get_live_price(s.compAddress)).div(1e14).toNumber() / 1e4
        showBody(dog)
        expect(dog).to.be.above(50).and.to.be.below(2000);
    })
});