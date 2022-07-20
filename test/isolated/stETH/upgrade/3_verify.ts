import { s } from "../scope";
import { ethers, network, tenderly } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../../util/impersonator"

import { BN } from "../../../../util/number";
import {
    ProxyAdmin,
    ProxyAdmin__factory,
    USDI__factory,
    IVault__factory
} from "../../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
} from "../../../../util/block";
import { toNumber, getGas } from "../../../../util/math";

const usdcAmount = BN("50e6")
const usdiAmount = BN("50e18")

const USDC_BORROW = BN("1000e6")//1k USDC
const USDI_BORROW = BN("100e18")//500 USDI



require("chai").should();

describe("Verify Upgraded Contracts", () => {
    it("STETH oracle is working on the oracle master", async () => {
        const price = await s.Oracle.getLivePrice(s.STETH_ADDRESS)
        const ref = await s.Oracle.getLivePrice(s.wethAddress)
        expect(await toNumber(price)).to.be.closeTo(await toNumber(ref), 50, "STETH price is close to WETH price")
    })
});

describe("Borrow against STETH", () => {

    it("mint vaults for testing", async () => {
        //showBody("bob mint vault")
        await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
            .reverted;
        await mineBlock();
        s.BobVaultID = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
        s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
        expect(await s.BobVault.minter()).to.eq(s.Bob.address);
    });

    it("vault deposits", async () => {


        await s.STETH.connect(s.Bob).transfer(s.BobVault.address, s.STETH_AMOUNT)
        await mineBlock()

        expect(await s.BobVault.tokenBalance(s.STETH_ADDRESS)).to.eq(s.STETH_AMOUNT.sub(1))//1 wei corner case


    });

    it("Borrow against STETH", async () => {
        const borrowAmount = BN("500e18")

        const startLiab = await s.VaultController.vaultLiability(s.BobVaultID)

        //confirm steth balance
        expect(await s.STETH.balanceOf(s.BobVault.address)).to.eq(s.STETH_AMOUNT.sub(1))//1 wei corner case

        //check borrow power
        const borrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

        expect(borrowPower).to.be.gt(0, "Bob has borrow power against stEth")

        const startUSDI = await s.USDI.balanceOf(s.Bob.address)

        await s.VaultController.connect(s.Bob).borrowUSDIto(s.BobVaultID, borrowAmount, s.Bob.address)
        await mineBlock()

        let balance = await s.USDI.balanceOf(s.Bob.address)

        expect(await toNumber(balance.sub(startUSDI))).to.be.closeTo(borrowAmount.div(BN("1e18")), 1, "Bob borrowed USDi against stEth")

        //account for 1 wei corner case
        expect(await toNumber(await s.VaultController.vaultLiability(s.BobVaultID))).to.be.closeTo(await toNumber(borrowAmount.add(startLiab)), 0.0001, "Bob's vault has the correct amount of liability")

    })
})

