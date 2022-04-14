import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../util/format";
import { BN } from "../util/number";
import { advanceBlockHeight, fastForward } from "../util/block";
import { Event, utils } from "ethers";



describe("TOKEN-DEPOSITS", async () => {
    //bob tries to borrow usdi against 10 eth as if eth is $100k
    // remember bob has 10 eth
    it(`bob should not be able to borrow 1e6 * 1e18 * ${s.Bob_WETH} usdi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrow_usdi(1,
            s.Bob_WETH.mul(BN("1e18")).mul(1e6),
        )).to.be.revertedWith("account insolvent");
    });

    it(`bob should be able to borrow ${"5000e18"} usdi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrow_usdi(1, BN("5000e18"))).to.not.be
            .revertedWith("account insolvent");
    });

    it(`after a few days, bob should have a liability greater than ${"BN(5000e18)"}`, async () => {
        await fastForward(60 * 60 * 24 * 7);//1 week
        await advanceBlockHeight(1)
        await s.VaultController.connect(s.Frank).calculate_interest();
        const liability_amount = await s
            .VaultController.connect(s.Bob)
            .AccountLiability(1);
        showBody("liability", liability_amount)
        expect(liability_amount).to.be.gt(BN("5000e18"));
        //showBody("bob_liability:", liability_amount.toString());
    });
});

describe("Checking interest generation", () => {
    it("check change in balance over a long period of time", async () => {
        const initBalance = await s.USDI.balanceOf(s.Dave.address)
        //fastForward
        await fastForward(60 * 60 * 24 * 7 * 52 * 1);//1 year
        //calculate and pay interest
        let result: any = await s.VaultController.calculate_interest()
        result = await result.wait()
        let args = result.events[result.events.length - 1].args
        //check for yeild    
        let balance = await s.USDI.balanceOf(s.Dave.address)
        expect(balance > initBalance)
    })
})
/**
 untested functions: 
  repay_usdi + repay_all_usdi WIP
  liquidate_account WIP
  check_account
  getInterestFactor
 */

describe("Testing repay", () => {
    const borrowAmount = BN("10e18")
    before(async () => {
        //await setupInitial()
        //await setupVaults()
    })
    it(`bob should able to borrow ${borrowAmount} usdi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrow_usdi(1, borrowAmount)).to.not.be.reverted;
    });
    it("partial repay", async () => {
        const liability = await s.BobVault.connect(s.Bob).BaseLiability()
        const partialLiability = liability.div(2) //half
        showBody("Partial liability: ", partialLiability.toString())
        const vaultId = 1
        const initBalance = await s.USDI.balanceOf(s.Bob.address)
        //showBody("Bob's Initial Balance: ", initBalance.toString())
        await s.VaultController.connect(s.Bob).repay_usdi(vaultId, partialLiability)

        let updatedLiability = await s.BobVault.connect(s.Bob).BaseLiability()
        let balance = await s.USDI.balanceOf(s.Bob.address)
        showBody("Balance after repay", balance.toString())
        expect(balance < initBalance)
        showBody("Updated Liability after repay: ", updatedLiability.toString())
        expect(updatedLiability < liability)

        //TODO - TEST MATH
        //assert.equal(updatedLiability.toString(), partialLiability.toString(), "Half of liability has been filled")
        //assert.equal(balance.toString(), (initBalance.toNumber() - partialLiability).toString(), "Balances are correct")

    })
    it("bob compeltely repays vault", async () => {
        const vaultId = 1
        await s.VaultController.connect(s.Bob).repay_all_usdi(1)

        let updatedLiability = await s.BobVault.connect(s.Bob).BaseLiability()
        expect(updatedLiability).to.eq(0)

        let balance = await s.USDI.balanceOf(s.Bob.address)
        showBody("Balance after complete repay: ", balance)
    })
})

describe("Testing liquidations", () => {
    before(async () => {
        //await setupInitial()
        //await setupVaults()
    })
    it(`bob should have ${s.Bob_WETH} wETH deposited`, async () => {
        expect(await s.BobVault.connect(s.Bob).getBalances(s.WETH.address)).to.eq(
            s.Bob_WETH
        );
        it("borrow maximum and liquidate", async () => {
            const abi = new ERC20ABI()
            const wETH_Contract = new ethers.Contract(s.wethAddress, abi.erc20ABI(), ethers.provider)
            const vaultID = 1
            //showBody("Bob starting USDI balance: ", initBalance.toString())
            const bobVaultInit = await wETH_Contract.balanceOf(s.BobVault.address)

            //borrow maximum - borrow amount == collateral value 
            const AccountBorrowingPower = await s.VaultController.AccountBorrowingPower(vaultID)
            await s.VaultController.connect(s.Bob).borrow_usdi(vaultID, AccountBorrowingPower)

            /******** CHECK WITHDRAW BEFORE CALCULATE INTEREST ********/
            //skip time so we can put vault below liquidation threshold 
            await fastForward(60 * 60 * 24 * 7 * 52 * 10);//10 year

            //await bob_vault.connect(Bob).withdraw_erc20(s.wethAddress, BN("9e17"))
            //calculate interest to update protocol, vault is now able to be liquidated 
            await s.VaultController.calculate_interest()

            //init balances after calculate interest
            const initBalanceDave = await s.USDI.balanceOf(s.Dave.address)
            const initBalanceBob = await s.USDI.balanceOf(s.Bob.address)
            const initWethBalanceDave = await wETH_Contract.balanceOf(s.Dave.address)
            const initLiability = await s.VaultController.AccountLiability(vaultID)

            //liquidate account
            const result = await s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.wethAddress, BN("1e16"))
            const receipt = await result.wait()
            let interestEvent = receipt.events?.filter((x: Event) => {
                return x.event == "Interest"
            }).pop()?.event
            assert.equal(interestEvent, "Interest", "Correct event captured and emitted")

            let liquidateEvent = receipt.events![receipt.events!.length - 1]
            let args = liquidateEvent.args
            assert.equal(liquidateEvent.event, "Liquidate", "Correct event captured and emitted")
            assert.equal(args!.asset_address.toString().toUpperCase(), s.wethAddress.toString().toUpperCase(), "Asset address is correct")
            const usdi_to_repurchase = args!.usdi_to_repurchase
            const tokens_to_liquidate = args!.tokens_to_liquidate
            //console.log("Formatted usdi_to_repurchase: ", utils.formatEther(usdi_to_repurchase.toString()))

            /******** check ending balances ********/

            //check ending liability
            let liabiltiy = await s.VaultController.AccountLiability(vaultID)
            //showBody("initLiability: ", initLiability)
            //showBody("End liability: ", liabiltiy)

            //Bob's vault has less collateral than before
            let balance = await wETH_Contract.balanceOf(s.BobVault.address)
            let difference = bobVaultInit.sub(balance)
            assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")

            //Dave spent USDi to liquidate
            balance = await s.USDI.balanceOf(s.Dave.address)
            difference = initBalanceDave.sub(balance)
            //assert.equal(difference.toString(), usdi_to_repurchase.toString(), "Dave spent the correct amount of usdi")
            //expect(difference.toString()).to.not.equal("0")

            //Dave received wETH
            balance = await wETH_Contract.balanceOf(s.Dave.address)
            difference = balance.sub(initWethBalanceDave)
            assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")
        })

        it("checks for over liquidation and then liquidates a vault that is just barely insolvent", async () => {
            /**
             * 
             * TODO: test exploit: liquidate max -> borrowing power reduced -> account insolvant again -> repeat -> profit
             * 
             * Should AccountBorrowingPower reflect the current borrow power of the vault, as in the amount should go down once a loan is taken? Currently it does not. 
             * 
             */
            const abi = new ERC20ABI()
            const rawPrice = await s.Oracle.get_live_price(s.compAddress)
            //showBody("rawPrice: ", rawPrice)
            let formatPrice: any = utils.formatEther(rawPrice.toString())
            formatPrice = parseFloat(formatPrice)
            //let formatPrice = (await s.Oracle.get_live_price(s.compAddress)).div(1e14).toNumber() / 1e4
            //showBody("Formatted COMP price: ", formatPrice)
            const comp_contract = new ethers.Contract(s.compAddress, abi.erc20ABI(), ethers.provider)
            const vaultID = 2

            //get values for total collateral value and loan amount
            const carolVaultTotalTokens = await comp_contract.balanceOf(s.CarolVault.address)
            const collateralValue = (parseFloat(utils.formatEther(carolVaultTotalTokens.toString())) * formatPrice)
            //showBody("Total collateral value: ", collateralValue)

            //borrow usdi
            const carolBorrowPower = await s.VaultController.AccountBorrowingPower(2)
            //showBody("carolBorrowPower BEFORE: ", carolBorrowPower)
            const result = await s.VaultController.connect(s.Carol).borrow_usdi(vaultID, carolBorrowPower)
            const receipt = await result.wait()
            let event = receipt.events![receipt.events!.length - 1]
            let args = event.args
            //showBody("borrowAmount: ", utils.formatEther(args.borrowAmount.toString()))

            let solvency = await s.VaultController.check_account(vaultID)
            assert.equal(solvency, true, "Carol's vault is solvent")

            //advance time explictly
            await s.VaultController.calculate_interest()

            solvency = await s.VaultController.check_account(vaultID)
            assert.equal(solvency, false, "Carol's vault is not solvent")

            //wrong asset address - should revert
            //await s.VaultController.connect(Dave).liquidate_account(vaultID, s.wethAddress, BN("1e16")).should.be.revertedWith("Vault does not hold any of this asset")

            const bigNumber = BN("1e25")
            let tokens_to_liquidate = await s.VaultController.TokensToLiquidate(vaultID, s.compAddress, bigNumber)
            let tokensReceipt = await tokens_to_liquidate.wait()
            event = tokensReceipt.events[tokensReceipt.events.length - 1]
            args = event.args
            const liquidatableTokens = args!.tokenAmount
            showBody("getTokensToLiquidate args.tokenAmount: ", liquidatableTokens)

            /**
             tokens_to_liquidate = await s.VaultController.getTokensToLiquidate(vaultID, s.compAddress, bigNumber)
            tokensReceipt = await tokens_to_liquidate.wait()
            event = tokensReceipt.events[tokensReceipt.events.length - 1]
            args = event.args
            showBody("getTokensToLiquidate args.tokenAmount: ", args.tokenAmount)
    
            tokens_to_liquidate = await s.VaultController.getTokensToLiquidate(vaultID, s.compAddress, bigNumber)
            tokensReceipt = await tokens_to_liquidate.wait()
            event = tokensReceipt.events[tokensReceipt.events.length - 1]
            args = event.args
            showBody("getTokensToLiquidate args.tokenAmount: ", args.tokenAmount)
    
            tokens_to_liquidate = await s.VaultController.getTokensToLiquidate(vaultID, s.compAddress, bigNumber)
            tokensReceipt = await tokens_to_liquidate.wait()
            event = tokensReceipt.events[tokensReceipt.events.length - 1]
            args = event.args
            showBody("getTokensToLiquidate args.tokenAmount: ", args.tokenAmount)
    
    
             */
            //tiny liquidation 
            const liquidateResult = await s.VaultController.connect(Dave).liquidate_account(vaultID, s.compAddress, bigNumber)
            const liquidateReceipt = await liquidateResult.wait()
            let liquidateEvent = liquidateReceipt.events[liquidateReceipt.events.length - 1]
            args = liquidateEvent.args
            showBody("tokens liquidated: ", args.tokens_to_liquidate)
            expect(args.tokens_to_liquidate.toNumber()).to.be.greaterThan(liquidatableTokens.toNumber())



            //let balance = await s.USDI.balanceOf(Dave.address)
            //console.log("Dave USDi Balance: ", utils.formatEther(balance.toString()))


            //balance = await s.USDI.balanceOf(Dave.address)
            //console.log("Dave USDi Balance: ", utils.formatEther(balance.toString()))

            //await s.VaultController.connect(Dave).liquidate_account(vaultID, s.wethAddress, bobVaultTotal.div(2)).should.be.revertedWith("vault solvent")
        })
    })


