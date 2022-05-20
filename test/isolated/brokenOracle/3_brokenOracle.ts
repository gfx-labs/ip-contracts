import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getArgs, getGas, truncate, toNumber } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, fastForward, OneYear, OneWeek } from "../../../util/block";
import { IVault__factory } from "../../../typechain-types";
//import { assert } from "console";
import { utils } from "ethers";
//simport { truncate } from "fs";


describe("What happens when the primary oracle is broken?", () => {
    //9500 USDC
    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    it("Confirms contract holds no value", async () => {
        const totalLiability = await s.VaultController.totalBaseLiability()
        expect(totalLiability).to.eq(BN("0"))

        const vaultsMinted = await s.VaultController.vaultsMinted()
        expect(vaultsMinted).to.eq(BN("0"))

        const interestFactor = await s.VaultController.interestFactor()
        expect(interestFactor).to.eq(BN("1e18"))

        const tokensRegistered = await s.VaultController.tokensRegistered()
        expect(tokensRegistered).to.eq(BN("2"))//weth && comp

        //no new USDi has been minted
        const totalSupply = await s.USDI.totalSupply()
        expect(totalSupply).to.eq(BN("1e18"))

        const scaledTotalSupply = await s.USDI.scaledTotalSupply()
        expect(scaledTotalSupply).to.eq(totalSupply.mul(BN("1e48")))

        const reserveRatio = await s.USDI.reserveRatio()
        expect(reserveRatio).to.eq(0)

    })

    it("Pay interest, and check values to confirm change", async () => {

        
    })

    it("borrow USDi when there is no reserve", async () => {

        
    })

    it("Borrow again to push up the total base liability", async () => {
        
    })

    it("check things", async () => {
        
    })

    it("Large liability, to reserve, try to withdraw USDC for USDI", async () => {
       
    })
})
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

describe("Uniswap oracles", () => {
    it("fetch eth price", async () => {
        let dog = (await s.UniswapRelayEthUsdc.currentValue()).div(1e14).toNumber() / 1e4
        //showBody(dog);
        expect(dog).to.be.above(1000).and.to.be.below(10000);
    });

    it("fetch comp price", async () => {
        let dog = (await s.UniswapRelayCompUsdc.currentValue()).div(1e14).toNumber() / 1e4
        //showBody(dog);
        expect(dog).to.be.above(100).and.to.be.below(1000);
    });
});

describe("anchored views", () => {
    it("fetch comp price", async () => {
        let dog = (await s.AnchoredViewComp.currentValue()).div(1e14).toNumber() / 1e4
        //showBody(dog);
        expect(dog).to.be.above(100).and.to.be.below(1000);
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

    it("comp price", async () => {
        let dog = (await s.Oracle.getLivePrice(s.compAddress)).div(1e14).toNumber() / 1e4
        //showBody(dog)
        expect(dog).to.be.above(50).and.to.be.below(2000);
    })
});