import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../../util/format";
import { BN } from "../../util/number";
import { mineBlock } from "../../util/block";

describe("ETH:", () => {
    it("fetch uniswap relay price", async () => {
        let anchorPrice = (await s.UniswapRelayEthUsdc.currentValue()).div(1e14).toNumber() / 1e4
        expect(anchorPrice).to.be.above(1000).and.to.be.below(10000);
        //showBody("anchorPrice: ", anchorPrice);
    });
    it("fetch chainlink relay price", async () => {
        let chainlinkPrice = (await s.ChainlinkEth.currentValue()).div(1e14).toNumber() / 1e4
        expect(chainlinkPrice).to.be.above(1000).and.to.be.below(10000);
        //showBody("chainlinkPrice: ", chainlinkPrice);
    });
    /**
     it("verify chainlink price within anchor bounds", async () => {
        let anchorPrice = (await s.UniswapRelayCompUsdc.currentValue()).div(1e14).toNumber() / 1e4
        showBody("UNISWAP COMP ANCHOR PRICE: ", anchorPrice)
        let chainlinkPrice = (await s.ChainlinkEth.currentValue()).div(1e14).toNumber() / 1e4
        let numerator = (await s.AnchoredViewEth._widthNumerator()).toNumber();
        let denominator = (await s.AnchoredViewEth._widthDenominator()).toNumber();
        let buffer = (numerator * anchorPrice) / denominator;
        let upperBounds = anchorPrice + buffer;
        let lowerBounds = anchorPrice - buffer;
        expect(chainlinkPrice < upperBounds);
        expect(chainlinkPrice > lowerBounds);

    });
     */
    it("verify chainlink price within anchor bounds", async () => {
        let anchorPrice = (await s.UniswapRelayUniUsdc.currentValue()).div(1e14).toNumber() / 1e4
        showBody("UNISWAP UNI ANCHOR PRICE: ", anchorPrice)
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
        //showBody("fetch oracle master price")
        let mainPrice = (await s.AnchoredViewEth.currentValue()).div(1e14).toNumber() / 1e4
        //showBody("mainPrice", mainPrice)
        //let oraclePrice = (await s.Oracle.getLivePrice(s.wethAddress)).div(1e14).toNumber() / 1e4
        let rawPrice = await s.Oracle.getLivePrice(s.wethAddress)
        //showBody("rawPrice: ", rawPrice)
        let oraclePrice = rawPrice.div(1e14).toNumber() / 1e4
        //showBody("oraclePrice", oraclePrice)
        let chainlinkPrice = (await s.ChainlinkEth.currentValue()).div(1e14).toNumber() / 1e4
        //showBody("chainlinkPrice", chainlinkPrice)
        expect(mainPrice = chainlinkPrice);
        expect(oraclePrice = mainPrice);
        //showBody(oraclePrice)
    });
});

/**
 describe("COMP:", () => {
    it("fetch uniswap relay price", async () => {
        let anchorPrice = (await s.UniswapRelayCompUsdc.currentValue()).div(1e14).toNumber() / 1e4
        expect(anchorPrice).to.be.above(100).and.to.be.below(1000);
        //showBody(anchorPrice);
    });
    it("fetch chainlink relay price", async () => {
        let chainlinkPrice = (await s.ChainlinkComp.currentValue()).div(1e14).toNumber() / 1e4
        expect(chainlinkPrice).to.be.above(100).and.to.be.below(1000);
        //showBody(chainlinkPrice);
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
        let oraclePrice = (await s.Oracle.getLivePrice(s.compAddress)).div(1e14).toNumber() / 1e4
        let chainlinkPrice = (await s.ChainlinkComp.currentValue()).div(1e14).toNumber() / 1e4
        expect(mainPrice = chainlinkPrice);
        expect(oraclePrice = mainPrice);
        //showBody(oraclePrice)
    });
});
 */
describe("UNI:", () => {
    it("fetch uniswap relay price", async () => {
        let anchorPrice = (await s.UniswapRelayUniUsdc.currentValue()).div(1e14).toNumber() / 1e4
        expect(anchorPrice).to.be.above(1).and.to.be.below(100);
        //showBody(anchorPrice);
    });
    it("fetch chainlink relay price", async () => {
        let chainlinkPrice = (await s.ChainLinkUni.currentValue()).div(1e14).toNumber() / 1e4
        expect(chainlinkPrice).to.be.above(1).and.to.be.below(100);
        //showBody(chainlinkPrice);
    });
    it("verify chainlink price within anchor bounds", async () => {
        let anchorPrice = (await s.UniswapRelayUniUsdc.currentValue()).div(1e14).toNumber() / 1e4
        let chainlinkPrice = (await s.ChainLinkUni.currentValue()).div(1e14).toNumber() / 1e4
        let numerator = (await s.AnchoredViewUni._widthNumerator()).toNumber();
        let denominator = (await s.AnchoredViewUni._widthDenominator()).toNumber();
        let buffer = (numerator * anchorPrice) / denominator;
        let upperBounds = anchorPrice + buffer;
        let lowerBounds = anchorPrice - buffer;
        expect(chainlinkPrice < upperBounds);
        expect(chainlinkPrice > lowerBounds);
    });
    it("fetch oracle master price", async () => {
        let mainPrice = (await s.AnchoredViewUni.currentValue()).div(1e14).toNumber() / 1e4
        let oraclePrice = (await s.Oracle.getLivePrice(s.uniAddress)).div(1e14).toNumber() / 1e4
        let chainlinkPrice = (await s.ChainLinkUni.currentValue()).div(1e14).toNumber() / 1e4
        expect(mainPrice = chainlinkPrice);
        expect(oraclePrice = mainPrice);
        //showBody(oraclePrice)
    });
});
describe("Uniswap oracles", () => {
    it("fetch eth price", async () => {
        let dog = (await s.UniswapRelayEthUsdc.currentValue()).div(1e14).toNumber() / 1e4
        //showBody(dog);
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });

    it("fetch uni price", async () => {
        let dog = (await s.UniswapRelayUniUsdc.currentValue()).div(1e14).toNumber() / 1e4
        //showBody(dog);
        expect(dog).to.be.above(1).and.to.be.below(100);
    });
});

describe("anchored views", () => {
    it("fetch uni price", async () => {
        let dog = (await s.AnchoredViewUni.currentValue()).div(1e14).toNumber() / 1e4
        //showBody(dog);
        expect(dog).to.be.above(1).and.to.be.below(100);
    });
    it("fetch eth price", async () => {
        let dog = (await s.AnchoredViewEth.currentValue()).div(1e14).toNumber() / 1e4
        //showBody(dog);
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });
});

describe("getting prices from oracle master", () => {
    it("fetch eth price", async () => {
        await mineBlock()

        let dog = (await s.Oracle.getLivePrice(s.wethAddress)).div(1e14).toNumber() / 1e4
        await mineBlock()
        //showBody(dog)
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });

    it("uni price", async () => {
        let dog = (await s.Oracle.getLivePrice(s.uniAddress)).div(1e14).toNumber() / 1e4
        //showBody(dog)
        expect(dog).to.be.above(1).and.to.be.below(100);
    })
});