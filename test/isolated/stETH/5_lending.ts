import { s } from "./scope";
import { upgrades, ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { impersonateAccount, ceaseImpersonation } from "../../../util/impersonator"

import { BN } from "../../../util/number";
import {
    ProxyAdmin,
    ProxyAdmin__factory,
    USDI__factory,
    IVault__factory
} from "../../../typechain-types";
import {
    advanceBlockHeight,
    fastForward,
    mineBlock,
    OneWeek,
    OneYear,
} from "../../../util/block";
import { toNumber, getGas } from "../../../util/math";

const usdcAmount = BN("50e6")
const usdiAmount = BN("50e18")

const USDC_BORROW = BN("1000e6")//1k USDC
const USDI_BORROW = BN("100e18")//500 USDI


const rebase = async () => {
    const callerAddr = "0x404335bce530400a5814375e7ec1fb55faff3ea2";

    let signer = ethers.provider.getSigner(callerAddr)
    await impersonateAccount(callerAddr)

    await s.ST_ORACLE.connect(signer).reportBeacon(132300, 4243292214304813, 129034)
    await mineBlock()

    await ceaseImpersonation(callerAddr)
    await mineBlock()
}



require("chai").should();
describe("Verify Upgraded Contracts", () => {

    const borrowAmount = BN("2000e18")

    it("Confirm USDI now has the upgraded functions", async () => {

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

        expect(await toNumber(balance.sub(startUSDI))).to.be.closeTo(borrowAmount.div(BN("1e18")), 5, "Bob borrowed USDi against stEth")

        expect(await s.VaultController.vaultLiability(s.BobVaultID)).to.be.gt(borrowAmount.add(startLiab), "Bob's vault has the correct amount of liability")

    })

    it("Check for rebase", async () => {
        const startSTETH = await s.STETH.balanceOf(s.BobVault.address)

        const startBorrowPower = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

        await fastForward(OneWeek)
        await mineBlock()
        await rebase()


        let steth = await s.STETH.balanceOf(s.BobVault.address) 

        let bp = await s.VaultController.vaultBorrowingPower(s.BobVaultID)

        expect(steth).to.be.gt(startSTETH, "Steth rebased positively")
        expect(bp).to.be.gt(startBorrowPower, "Borrow power increased as steth rebased positively")


    })
});
