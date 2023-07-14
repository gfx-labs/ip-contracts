import { s } from "./scope"
import { expect, assert } from "chai"
import { showBody, showBodyCyan } from "../../util/format"
import { BN } from "../../util/number"
import { mineBlock } from "../../util/block"
import { toNumber } from "../../util/math"

describe("getting prices from oracle master", () => {
    before(async () => {
        showBodyCyan("MAKE SURE THESE LOOK LIKE CURRENT MARKET PRICES")
    })
    it("fetch eth price", async () => {
        let wethPrice = await toNumber(await s.Oracle.getLivePrice(s.CappedWeth.address))
        showBody("wETH price: ", wethPrice)
        expect(wethPrice).to.be.above(1000).and.to.be.below(5000)
    })

    it("fetch wstEth price", async () => {
        let wstEthPrice = await toNumber(await s.Oracle.getLivePrice(s.CappedWstEth.address))
        showBody("wstEth price: ", wstEthPrice)
        expect(wstEthPrice).to.be.above(1000).and.to.be.below(5000)
    })

    it("fetch Reth price", async () => {
        let RethPrice = await toNumber(await s.Oracle.getLivePrice(s.CappedReth.address))
        showBody("Reth price: ", RethPrice)
        expect(RethPrice).to.be.above(1000).and.to.be.below(5000)
    })

    it("fetch wbtc price", async () => {
        let wbtcPrice = await toNumber(await s.Oracle.getLivePrice(s.CappedWbtc.address))
        showBody("wBTC price: ", wbtcPrice)
        expect(wbtcPrice).to.be.above(10000).and.to.be.below(70000)
    })

    it("fetch OPs price", async () => {
        let opPrice = await toNumber(await s.Oracle.getLivePrice(s.CappedOp.address))
        showBody("op price: ", opPrice)
        expect(opPrice).to.be.above(0.25).and.to.be.below(30)
    })
})