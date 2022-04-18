import { s } from "./scope";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { showBody } from "../util/format";
import { BN } from "../util/number";
import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "../util/block";
import { Event, utils, BigNumber } from "ethers";

const getArgs = async (result: any) => {
    await advanceBlockHeight(1)
    const receipt = await result.wait()
    await advanceBlockHeight(1)
    const events = receipt.events
    const args = events[events.length - 1].args

    return args
}

const nullAddr = "0x0000000000000000000000000000000000000000"

describe("TOKEN-DEPOSITS", async () => {
    const borrowAmount = BN("5000e18")
    //bob tries to borrow usdi against 10 eth as if eth is $100k
    // remember bob has 10 eth
    let actualBorrowAmount: any
    it(`bob should not be able to borrow 1e6 * 1e18 * ${s.Bob_WETH} usdi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrowUsdi(1,
            s.Bob_WETH.mul(BN("1e18")).mul(1e6),
        )).to.be.revertedWith("account insolvent");
    });

    it(`bob should be able to borrow ${"5000e18"} usdi`, async () => {

        const initUSDiBalance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(initUSDiBalance.toString(), "0", "Bob starts with 0 USDi")

        const borrowResult = await s.VaultController.connect(s.Bob).borrowUsdi(1, borrowAmount)
        await advanceBlockHeight(1)
        const args = await getArgs(borrowResult)
        actualBorrowAmount = args!.borrowAmount


        const resultingUSDiBalance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(resultingUSDiBalance.toString(), actualBorrowAmount.toString(), "Bob received the correct amount of USDi")


        //showBody("Actual USDi Borrowed: ", actualBorrowAmount)
        //showBody("Formatted USDi Borrowed: ", utils.formatEther(actualBorrowAmount))
    });
    it(`after 1 week, bob should have a liability greater than ${"BN(5000e18)"}`, async () => {
        await advanceBlockHeight(1)
        const initLiability = await s
            .VaultController.connect(s.Bob)
            .AccountLiability(1);
        await fastForward(OneWeek);//1 week
        await advanceBlockHeight(1)


        showBody("CALCULATING INTEREST")

        const interestFactor = await s.VaultController.InterestFactor()
        const latestInterestTime = await s.VaultController._lastInterestTime()
        const currentBlock = await ethers.provider.getBlockNumber()
        const currentTime = (await ethers.provider.getBlock(currentBlock)).timestamp
        let timeDifference = currentTime - latestInterestTime.toNumber() + 1 //account for change when fetching from provider

        const reserveRatio = await s.USDI.reserveRatio()
        const curve = await s.Curve.getValueAt(nullAddr, reserveRatio)//




        const interestResult = await s.VaultController.connect(s.Frank).calculateInterest();
        await advanceBlockHeight(1)
        const e18_factor_increase = await getArgs(interestResult)



        //expected: 863019406392694063926940639291006
        //actual  : 862428701802418434861966689482089 
        //oneYear is correct
        
        


        //calculate factor increase


        //step 1 - timeDif * curve scaled to e18
        

        //showBody("timeDifference TEST: ", timeDifference)
        //showBody("1e18: ", BN("1e18"))
        //showBody("curve: ", curve)

        const bg = require('big-number')

        let calculation = BN(timeDifference).mul(BN("1e18").mul(curve))//correct step 1
        calculation = calculation.div(OneYear)//correct step 2 - divide by OneYear
        calculation = calculation.div(BN("1e18"))//truncate
        calculation = calculation.mul(interestFactor)
        calculation = calculation.div(BN("1e18"))//truncate again

        showBody(calculation.toString())
       
    





        //let calculation = ((((BN(timeDifference).mul(BN("1e18")).mul(curve)).div(OneYear)).div(BN("1e18"))).mul(interestFactor)).div(BN("1e18"))
        //showBody(interestFactor)







        //showBody("Result::::", calculation)
        showBody("e18_factor_increase: ", e18_factor_increase.amount)










        const liability_amount = await s
            .VaultController.connect(s.Bob)
            .AccountLiability(1);
        //showBody("start liability ", initLiability)
        //showBody("ending liability", liability_amount)
        expect(liability_amount).to.be.gt(BN("5000e18"));
    });
});

describe("Checking interest generation", () => {
    it("check change in balance over a long period of time", async () => {
        const initBalance = await s.USDI.balanceOf(s.Dave.address)
        //fastForward
        await fastForward(OneYear);//1 year
        await advanceBlockHeight(1)
        //calculate and pay interest
        await expect(s.VaultController.calculateInterest()).to.not.reverted
        //check for yeild    
        let balance = await s.USDI.balanceOf(s.Dave.address)
        expect(balance > initBalance)
    })
})
/**
 untested functions: 
  repayUSDi + repayAllUSDi WIP
  liquidate_account WIP
  checkAccount
  getInterestFactor
 */

describe("Testing repay", () => {
    const borrowAmount = BN("10e18")
    it(`bob should able to borrow ${borrowAmount} usdi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrowUsdi(1, borrowAmount)).to.not.be.reverted;
    });
    it("partial repay", async () => {
        const liability = await s.BobVault.connect(s.Bob).BaseLiability()
        const partialLiability = liability.div(2) //half
        //showBody("Partial liability: ", partialLiability)
        const vaultId = 1
        const initBalance = await s.USDI.balanceOf(s.Bob.address)
        //showBody("Bob's Initial Balance: ", initBalance)

        //check pauseable 
        await s.VaultController.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.VaultController.connect(s.Bob).repayUSDi(vaultId, partialLiability)).to.be.revertedWith("Pausable: paused")
        await s.VaultController.connect(s.Frank).unpause()
        await advanceBlockHeight(1)

        await s.VaultController.connect(s.Bob).repayUSDi(vaultId, partialLiability)
        await advanceBlockHeight(1)
        let updatedLiability = await s.BobVault.connect(s.Bob).BaseLiability()
        let balance = await s.USDI.balanceOf(s.Bob.address)
        //showBody("Balance after repay", balance.toString())
        expect(balance < initBalance)
        //showBody("Updated Liability after repay: ", updatedLiability.toString())
        expect(updatedLiability < liability)

        //TODO - TEST MATH
        //assert.equal(updatedLiability.toString(), partialLiability.toString(), "Half of liability has been filled")
        //assert.equal(balance.toString(), (initBalance.toNumber() - partialLiability).toString(), "Balances are correct")

    })
    it("bob compeltely repays vault", async () => {

        //check pauseable 
        await s.VaultController.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.VaultController.connect(s.Bob).repayAllUSDi(1)).to.be.revertedWith("Pausable: paused")
        await s.VaultController.connect(s.Frank).unpause()
        await advanceBlockHeight(1)


        await s.VaultController.connect(s.Bob).repayAllUSDi(1)
        await advanceBlockHeight(1)

        let updatedLiability = await s.BobVault.connect(s.Bob).BaseLiability()
        expect(updatedLiability).to.eq(0)

        let balance = await s.USDI.balanceOf(s.Bob.address)
        //showBody("Balance after complete repay: ", balance)
    })
})

describe("Testing liquidations", () => {
    it(`bob should have ${s.Bob_WETH} wETH deposited`, async () => {
        expect(await s.BobVault.connect(s.Bob).tokenBalance(s.WETH.address)).to.eq(s.Bob_WETH);
    });
    it("borrow maximum and liquidate", async () => {
        const vaultID = 1
        const bobVaultInit = await s.WETH.balanceOf(s.BobVault.address)

        //borrow maximum - borrow amount == collateral value 
        const AccountBorrowingPower = await s.VaultController.AccountBorrowingPower(vaultID)
        await s.VaultController.connect(s.Bob).borrowUsdi(vaultID, AccountBorrowingPower)
        await advanceBlockHeight(1)

        /******** CHECK WITHDRAW BEFORE CALCULATE INTEREST ********/
        //skip time so we can put vault below liquidation threshold 
        await fastForward(OneYear * 10);//10 year
        await advanceBlockHeight(1)

        //await bob_vault.connect(Bob).withdrawErc20(s.wethAddress, BN("9e17"))
        //calculate interest to update protocol, vault is now able to be liquidated 
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        //init balances after calculate interest
        const initBalanceDave = await s.USDI.balanceOf(s.Dave.address)
        const initBalanceBob = await s.USDI.balanceOf(s.Bob.address)
        const initWethBalanceDave = await s.WETH.balanceOf(s.Dave.address)
        const initLiability = await s.VaultController.AccountLiability(vaultID)

        //check pauseable 
        await s.VaultController.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.wethAddress, BN("1e16"))).to.be.revertedWith("Pausable: paused")
        await s.VaultController.connect(s.Frank).unpause()
        await advanceBlockHeight(1)

        //liquidate account
        const result = await s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.wethAddress, BN("1e16"))
        await advanceBlockHeight(1)
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
        let balance = await s.WETH.balanceOf(s.BobVault.address)
        let difference = bobVaultInit.sub(balance)
        assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")

        //Dave spent USDi to liquidate
        balance = await s.USDI.balanceOf(s.Dave.address)
        difference = initBalanceDave.sub(balance)
        //assert.equal(difference.toString(), usdi_to_repurchase.toString(), "Dave spent the correct amount of usdi")
        //expect(difference.toString()).to.not.equal("0")

        //Dave received wETH
        balance = await s.WETH.balanceOf(s.Dave.address)
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
        const rawPrice = await s.Oracle.getLivePrice(s.compAddress)
        //showBody("rawPrice: ", rawPrice)
        //let formatPrice = (await s.Oracle.getLivePrice(s.compAddress)).div(1e14).toNumber() / 1e4
        const vaultID = 2

        //showBody("scaled COMP price: ", rawPrice.mul(BN("1e18")))
        //get values for total collateral value and loan amount
        const carolVaultTotalTokens = await s.COMP.balanceOf(s.CarolVault.address)
        const collateralValue = carolVaultTotalTokens.mul(BN("1e18")).mul(rawPrice.mul(BN("1e18")))
        //showBody("carol's TCV: ", collateralValue)
        //borrow usdi
        const carolBorrowPower = await s.VaultController.AccountBorrowingPower(2)
        await advanceBlockHeight(1)
        const borrowResult = await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, carolBorrowPower)
        await advanceBlockHeight(1)
        const args = await getArgs(borrowResult)
        const actualBorrowAmount = args!.borrowAmount


        expect(await s.USDI.balanceOf(s.Carol.address)).to.eq(actualBorrowAmount)

        let solvency = await s.VaultController.checkAccount(vaultID)
        //showBody("carol's vault should be solvent")
        assert.equal(solvency, true, "Carol's vault is solvent")

        //showBody("advance 1 week and then calculate interest")
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        let bn = await ethers.provider.getBlockNumber()
        //showBody("current block", bn)
        //this check is silly, each new mineBlock() advances by 1
        //expect(bn).to.eq(BN("14546874"))

        let bt = (await ethers.provider.getBlock(bn)).timestamp
        //showBody("current timestamp", bt)

        solvency = await s.VaultController.checkAccount(vaultID)
        //showBody("carol vault should be insolvent")
        assert.equal(solvency, false, "Carol's vault is not solvent")

        let liquidatableTokens = await s.VaultController.TokensToLiquidate(vaultID, s.compAddress, BN("1e25"))
        //showBody("liquidatableTokens:", liquidatableTokens)
        //tiny liquidation 
        //showBody("calculating amount to liquidate");

        //callStatic does not actually make the call and change the state of the contract, thus liquidateAmount == liquidatableTokens
        const liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidate_account(vaultID, s.compAddress, BN("1e25"))
        //showBody("liquidating at IF", await s.VaultController.InterestFactor());
        await expect(s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.compAddress, BN("1e25"))).to.not.reverted
        await advanceBlockHeight(1)
        //showBody("dave liquidated:", liquidateAmount, "comp")
        expect(liquidateAmount).to.eq(liquidatableTokens)

        //let balance = await s.USDI.balanceOf(Dave.address)
        //console.log("Dave USDi Balance: ", utils.formatEther(balance.toString()))


        //balance = await s.USDI.balanceOf(Dave.address)
        //console.log("Dave USDi Balance: ", utils.formatEther(balance.toString()))

        //await s.VaultController.connect(Dave).liquidate_account(vaultID, s.wethAddress, bobVaultTotal.div(2)).should.be.revertedWith("vault solvent")
    })
})


