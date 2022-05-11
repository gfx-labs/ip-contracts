import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../util/money";
import { showBody, showBodyCyan } from "../../../util/format";
import { getArgs, getGas, truncate, toNumber } from "../../../util/math";
import { BN } from "../../../util/number";
import { s } from "../scope";
import { advanceBlockHeight, reset, mineBlock, fastForward, OneYear, OneWeek } from "../../../util/block";
import { IVaultController2 } from "../../../typechain-types";
//import { assert } from "console";
import { utils } from "ethers";
//simport { truncate } from "fs";

let VaultController2: IVaultController2
describe("Testing explicit upgradeability ", () => {
    //9500 USDC
    const depositAmount = s.Dave_USDC.sub(BN("500e6"))
    const depositAmount_e18 = depositAmount.mul(BN("1e12"))

    it("Upgrade USDI contract", async () => {


    })

    it("Upgrade VaultController contract", async () => {
        //deploy implementation
        const VC2factory = await ethers.getContractFactory("VaultController2")
        const imp = await VC2factory.deploy()
        await mineBlock()
        await imp.deployed()

        //upgrade
        await s.ProxyAdmin.connect(s.Frank).upgrade(s.VaultController.address, imp.address)
        await mineBlock()

        VaultController2 = VC2factory.attach(s.VaultController.address)
        await mineBlock()

    })

    it("Check VaultController2", async () => {
        const result = await VaultController2.changeTheThing(24)
        await mineBlock()
        const args = await getArgs(result)

        assert.equal(args.newThing.toNumber(), 24, "New thing is correct on new event arg")

        let newThing = await VaultController2.newThing()
        assert.equal(newThing.toNumber(), 24, "New thing is correct on contract state")

    })

    it("Check existing VaultController features", async () => {
        const totalLiability = await VaultController2.totalBaseLiability()
        expect(totalLiability).to.eq(BN("0"))

        const vaultsMinted = await VaultController2.vaultsMinted()
        expect(vaultsMinted).to.eq(BN("0"))

        const interestFactor = await VaultController2.interestFactor()
        expect(interestFactor).to.eq(BN("1e18"))

        const tokensRegistered = await VaultController2.tokensRegistered()
        expect(tokensRegistered).to.eq(BN("2"))//weth && comp

        //no new USDi has been minted
        const totalSupply = await s.USDI.totalSupply()
        expect(totalSupply).to.eq(BN("1e18"))

        const scaledTotalSupply = await s.USDI.scaledTotalSupply()
        expect(scaledTotalSupply).to.eq(totalSupply.mul(BN("1e48")))

        const reserveRatio = await s.USDI.reserveRatio()
        expect(reserveRatio).to.eq(0)
    })









})