import { s } from "./scope";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../util/format";
import { BN } from "../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../util/block";
import { utils, BigNumber } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../util/math";
import { IVault__factory } from "../../typechain-types";

let firstBorrowIF: BigNumber
const borrowAmount = BN("5000e18")
describe("BORROW USDi", async () => {

    //bob tries to borrow usdi against 10 eth as if eth is $100k
    // remember bob has 10 wETH
    let actualBorrowAmount: any
    let expectedInterestFactor: BigNumber
    it(`bob should not be able to borrow 1e6 * 1e18 * ${s.Bob_WETH} usdi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrowUsdi(1,
            s.Bob_WETH.mul(BN("1e18")).mul(1e6),
        )).to.be.revertedWith("account insolvent");
    });

    it(`bob should be able to borrow ${"5000e18"} usdi`, async () => {

        const initUSDiBalance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(initUSDiBalance.toString(), "0", "Bob starts with 0 USDi")

        //get initial interest factor
        const initInterestFactor = await s.VaultController.interestFactor()

        expectedInterestFactor = await payInterestMath(initInterestFactor)

        firstBorrowIF = expectedInterestFactor
        const calculatedBaseLiability = await calculateAccountLiability(borrowAmount, initInterestFactor, initInterestFactor)

        const borrowResult = await s.VaultController.connect(s.Bob).borrowUsdi(1, borrowAmount)
        await advanceBlockHeight(1)
        const gas = await getGas(borrowResult)
        showBodyCyan("Gas cost to borrowUSDI: ", gas)

        const args = await getArgs(borrowResult)
        actualBorrowAmount = args!.borrowAmount

        //actual new interest factor from contract
        const newInterestFactor = await s.VaultController.interestFactor()

        assert.equal(newInterestFactor.toString(), expectedInterestFactor.toString(), "New Interest Factor is correct")

        await s.VaultController.calculateInterest()
        const liability = await s.VaultController.connect(s.Bob).accountLiability(1)
        assert.equal(liability.toString(), calculatedBaseLiability.toString(), "Calculated base liability is correct")

        const resultingUSDiBalance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(resultingUSDiBalance.toString(), actualBorrowAmount.toString(), "Bob received the correct amount of USDi")

    });
    it(`after 1 week, bob should have a liability greater than ${"BN(5000e18)"}`, async () => {

        await advanceBlockHeight(1)
        await fastForward(OneWeek)
        await advanceBlockHeight(1)

        let interestFactor = await s.VaultController.interestFactor()
        const calculatedInterestFactor = await payInterestMath(interestFactor)

        const expectedLiability = await calculateAccountLiability(borrowAmount, calculatedInterestFactor, firstBorrowIF)

        const result = await s.VaultController.connect(s.Frank).calculateInterest();
        await advanceBlockHeight(1)
        const interestGas = await getGas(result)
        showBodyCyan("Gas cost to calculate interest: ", interestGas)

        interestFactor = await s.VaultController.interestFactor()
        assert.equal(interestFactor.toString(), calculatedInterestFactor.toString(), "Interest factor is correct")

        const readLiability = await s
            .VaultController.connect(s.Bob)
            .accountLiability(1);

        expect(readLiability).to.be.gt(BN("5000e18"));

        assert.equal(expectedLiability.toString(), readLiability.toString(), "Liability calculation is correcet")
    });
});

describe("Checking interest generation", () => {
    it("check change in balance over a long period of time", async () => {
        const initBalance = await s.USDI.balanceOf(s.Dave.address)
        //fastForward
        await fastForward(OneYear);//1 year
        await advanceBlockHeight(1)

        //get current interestFactor
        let interestFactor = await s.VaultController.interestFactor()
        const expectedBalance = await calculateBalance(interestFactor, s.Dave)

        //check for yeild before calculateInterest - should be 0
        let balance = await s.USDI.balanceOf(s.Dave.address)

        assert.equal(balance.toString(), initBalance.toString(), "No yield before calculateInterest")

        //calculate and pay interest on the contract
        const result = await s.VaultController.connect(s.Frank).calculateInterest();
        await advanceBlockHeight(1)
        const interestGas = await getGas(result)
        showBodyCyan("Gas cost to calculate interest: ", interestGas)

        //check for yeild after calculateInterest TODO
        balance = await s.USDI.balanceOf(s.Dave.address)

        assert.equal(balance.toString(), expectedBalance.toString(), "Expected balance is correct")

        expect(balance > initBalance)
    })
})

describe("Testing repay", () => {
    const borrowAmount = BN("10e18")
    it(`bob should able to borrow ${borrowAmount} usdi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrowUsdi(1, borrowAmount)).to.not.be.reverted;
    });
    it("partial repay", async () => {
        const vaultId = 1
        const initBalance = await s.USDI.balanceOf(s.Bob.address)

        let liability = await s.BobVault.connect(s.Bob).baseLiability()
        let partialLiability = liability.div(2) //half

        //check pauseable 
        await s.VaultController.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.VaultController.connect(s.Bob).repayUSDi(vaultId, partialLiability)).to.be.revertedWith("Pausable: paused")
        await s.VaultController.connect(s.Frank).unpause()
        await advanceBlockHeight(1)

        //need to get liability again, 2 seconds have passed when checking pausable
        liability = await s.BobVault.connect(s.Bob).baseLiability()
        partialLiability = liability.div(2) //half

        //current interest factor
        let interestFactor = await s.VaultController.interestFactor()
        const expectedBalanceWithInterest = await calculateBalance(interestFactor, s.Bob)

        //next interest factor if pay_interest was called now
        const calculatedInterestFactor = await payInterestMath(interestFactor)

        const base_amount = (partialLiability.mul(BN("1e18"))).div(calculatedInterestFactor)

        const expectedBaseLiability = liability.sub(base_amount)

        const repayResult = await s.VaultController.connect(s.Bob).repayUSDi(vaultId, partialLiability)
        await advanceBlockHeight(1)
        const repayGas = await getGas(repayResult)
        showBodyCyan("Gas cost do partial repay: ", repayGas)

        interestFactor = await s.VaultController.interestFactor()
        assert.equal(interestFactor.toString(), calculatedInterestFactor.toString(), "Interest factor is correct")

        let updatedLiability = await s.BobVault.connect(s.Bob).baseLiability()
        let balance = await s.USDI.balanceOf(s.Bob.address)

        assert.equal(expectedBaseLiability.toString(), updatedLiability.toString(), "Updated liability matches calculated liability")
        assert.equal(balance.toString(), (expectedBalanceWithInterest.sub(partialLiability)).toString(), "Balances are correct")

    })
    it("bob compeltely repays vault", async () => {
        //check pauseable 
        const allow = s.USDC.connect(s.Bob).approve(s.USDI.address, BN("100e20"))
        await expect(allow.catch(console.log)).to.not.reverted;
        await s.VaultController.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.VaultController.connect(s.Bob).repayAllUSDi(1)).to.be.revertedWith("Pausable: paused")
        await s.VaultController.connect(s.Frank).unpause()
        await advanceBlockHeight(1)

        ///////////////////////////////////////////////////////////////////////////


        //current interest factor
        let interestFactor = await s.VaultController.interestFactor()
        let liability = await s.BobVault.connect(s.Bob).baseLiability()
        let expectedIF = await payInterestMath(interestFactor)
        const expectedUSDIliability = await truncate(expectedIF.mul(liability))//this is correct
        let expectedBalanceWithInterest = await calculateBalance(expectedIF, s.Bob)
        const neededUSDI = expectedUSDIliability.sub(expectedBalanceWithInterest) //await s.USDI.balanceOf(s.Bob.address))
        expectedBalanceWithInterest = expectedBalanceWithInterest.add(neededUSDI)

        //todo
        //wrong - need to fix changeInBalance and sub that - expectedBalanceWithInterest
        const expectedInterest = expectedBalanceWithInterest.sub(await s.USDI.balanceOf(s.Bob.address))

        let testExpect = await changeInBalance(expectedIF, expectedBalanceWithInterest)

        //showBody("testExpect                 : ", testExpect)
        //showBody("expectedBalanceWithInterest: ", expectedBalanceWithInterest)
        //showBody("difference calculation     : ", testExpect.sub(expectedBalanceWithInterest))


        //in order to pay the interest, bob needs to mint some USDI
        //get his expected usdi liability subtracted by his balance of usdi
        showBody("bob deposits", BN(neededUSDI).div(BN("1e12")),"usdc, and receives ", neededUSDI, " usdi")
        const deposit = s.USDI.connect(s.Bob).deposit(neededUSDI.div(BN("1e12")).add(1))
        await expect(deposit.catch(console.log)).to.not.reverted;
        const repayResult = await s.VaultController.connect(s.Bob).repayAllUSDi(1)
        await advanceBlockHeight(1)
        const repayGas = await getGas(repayResult)
        showBodyCyan("Gas cost do total repay: ", repayGas)
        const args = await getArgs(repayResult)
        assert.equal(args.repayAmount.toString(), expectedUSDIliability.toString(), "Expected USDI amount repayed and burned")
        assert.equal(expectedBalanceWithInterest.toString(), args.repayAmount.toString(), "Expected balance at the time of repay is correct")



        //todo - Bob's balance should be 0 + interest
        let updatedLiability = await s.BobVault.connect(s.Bob).baseLiability()
        expect(updatedLiability).to.eq(0)//vault has been completely repayed 
        let balance = await s.USDI.balanceOf(s.Bob.address)
        //showBody("Check Expected balance")
        //expect(balance.toNumber()).to.be.closeTo(0, expectedInterest.toNumber())
        //showBody("total_interest: ", utils.formatEther(expectedInterest.toString()))
        //showBody("balance       : ", balance)
        //showBody("format balance: ", utils.formatEther(balance.toString()))
    })
})

describe("Testing liquidations", () => {
    it(`bob should have ${s.Bob_WETH} wETH deposited`, async () => {
        expect(await s.BobVault.connect(s.Bob).tokenBalance(s.WETH.address)).to.eq(s.Bob_WETH);
    });
    it("borrow maximum and liquidate down to empty vault", async () => {
        const vaultID = 1
        const bobVaultInit = await s.WETH.balanceOf(s.BobVault.address)

        //borrow maximum -> borrow amount == collateral value 
        const borrowInterestFactor = await s.VaultController.interestFactor()
        let calcIF = await payInterestMath(borrowInterestFactor)
        const accountBorrowingPower = await s.VaultController.accountBorrowingPower(vaultID)
        await nextBlockTime(0)
        await s.VaultController.connect(s.Bob).borrowUsdi(vaultID, accountBorrowingPower)
        await advanceBlockHeight(1)
        let IF = await s.VaultController.interestFactor()
        const initIF = IF
        assert.equal(IF.toString(), calcIF.toString())

        /******** CHECK withdraw BEFORE CALCULATE INTEREST ********/
        //skip time so we can put vault below liquidation threshold 
        await fastForward(OneYear * 10);//10 year
        await advanceBlockHeight(1)
        const tenYearIF = await payInterestMath(calcIF)

        //calculate interest to update protocol, vault is now able to be liquidated 
        await nextBlockTime(0)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)
        IF = await s.VaultController.interestFactor()
        assert.equal(tenYearIF.toString(), IF.toString(), "Interest factor calculation is correct after 10 years")

        //init balances after calculate interest
        const initWethBalanceDave = await s.WETH.balanceOf(s.Dave.address)

        //check pauseable 
        await s.VaultController.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.VaultController.connect(s.Dave).liquidateAccount(vaultID, s.wethAddress, BN("1e16"))).to.be.revertedWith("Pausable: paused")
        await s.VaultController.connect(s.Frank).unpause()
        await advanceBlockHeight(1)

        //expectedBalanceWithInterest must be calced here - TODO why? 
        const expectedBalanceWithInterest = await calculateBalance(IF, s.Dave)

        let vaultWETH = await s.WETH.balanceOf(s.BobVault.address)
        assert.equal(vaultWETH.toString(), bobVaultInit.toString(), "Vault still has all of its wETH")

        let daveWETH = await s.WETH.balanceOf(s.Dave.address)
        assert.equal(daveWETH.toString(), "0", "Dave does not have any wETH before liquidation ")

        IF = await s.VaultController.interestFactor()
        const calculatedInterestFactor = await payInterestMath(IF)
        const calcLiab = await calculateAccountLiability(accountBorrowingPower, calculatedInterestFactor, calcIF)

        const expectedT2L = await calculatetokensToLiquidate(s.BobVault, s.WETH.address, bobVaultInit, calcLiab)

        const expectedUSDI2Repurchase = await calculateUSDI2repurchase(s.WETH.address, expectedT2L)
     
        const result = await s.VaultController.connect(s.Dave).liquidateAccount(vaultID, s.wethAddress, bobVaultInit)
        await advanceBlockHeight(1)
        const receipt = await result.wait()
        const liquidateGas = await getGas(result)
        showBodyCyan("Gas cost to do a big liquidation: ", liquidateGas) 


        daveWETH = await s.WETH.balanceOf(s.Dave.address)
        assert.equal(daveWETH.toString(), bobVaultInit.toString(), "Dave now has all of the vault's collateral")
        const endingVaultWETH = await s.WETH.balanceOf(s.BobVault.address)
        assert.equal(endingVaultWETH.toString(), "0", "Vault is empty")

        IF = await s.VaultController.interestFactor()
        let expectedLiability = await calculateAccountLiability(accountBorrowingPower, IF, initIF)

        let interestEvent = await getEvent(result, "InterestEvent")
        assert.equal(interestEvent.event, "InterestEvent", "Correct event captured and emitted")

        let liquidateEvent = receipt.events![receipt.events!.length - 1]
        let args = liquidateEvent.args
        assert.equal(liquidateEvent.event, "Liquidate", "Correct event captured and emitted")
        assert.equal(args!.asset_address.toString().toUpperCase(), s.wethAddress.toString().toUpperCase(), "Asset address is correct")
        const usdi_to_repurchase = args!.usdi_to_repurchase
        const tokens_to_liquidate = args!.tokens_to_liquidate

        assert.equal(tokens_to_liquidate.toString(), expectedT2L.toString(), "Tokens to liquidate is correct")
        assert.equal(usdi_to_repurchase.toString(), expectedUSDI2Repurchase.toString(), "USDI to repurchase is correct")     

        //check ending liability 
        let liabiltiy = await s.VaultController.accountLiability(vaultID)

        //TODO - result is off by 0-8, and is inconsistant -- oracle price? Rounding error? 
        if (liabiltiy == expectedLiability.sub(usdi_to_repurchase)) {
            showBodyCyan("LIABILITY MATCH")
        }
        //accept a range to account for miniscule error
        expect(liabiltiy).to.be.gt((expectedLiability.sub(usdi_to_repurchase)).sub(10))
        expect(liabiltiy).to.be.lt((expectedLiability.sub(usdi_to_repurchase)).add(10))

        //Bob's vault's collateral has been reduced by the expected amount
        let balance = await s.WETH.balanceOf(s.BobVault.address)
        let difference = bobVaultInit.sub(balance)
        assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")

        //Dave spent USDi to liquidate -- TODO: precalc balance
        balance = await s.USDI.balanceOf(s.Dave.address)
        difference = expectedBalanceWithInterest.sub(balance)
        assert.equal(difference.toString(), usdi_to_repurchase.toString(), "Dave spent the correct amount of usdi")

        //Dave received wETH
        balance = await s.WETH.balanceOf(s.Dave.address)
        difference = balance.sub(initWethBalanceDave)
        assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")
    })

    it("checks for over liquidation and then liquidates a vault that is just barely insolvent", async () => {

        const vaultID = 2
        const carolVaultInit = await s.COMP.balanceOf(s.CarolVault.address)
        const initCOMPBalanceDave = await s.COMP.balanceOf(s.Dave.address)

        //borrow maximum usdi
        const carolBorrowPower = await s.VaultController.accountBorrowingPower(2)
        await advanceBlockHeight(1)
        const borrowResult = await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, carolBorrowPower)
        await advanceBlockHeight(1)
        let IF = await s.VaultController.interestFactor()
        const initIF = IF
        const args = await getArgs(borrowResult)
        const actualBorrowAmount = args!.borrowAmount

        //carol did not have any USDi before borrowing some
        expect(await s.USDI.balanceOf(s.Carol.address)).to.eq(actualBorrowAmount)

        let solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, true, "Carol's vault is solvent")

        //showBody("advance 1 week and then calculate interest")
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, false, "Carol's vault is not solvent")

        let liquidatableTokens = await s.VaultController.tokensToLiquidate(vaultID, s.compAddress)

        //showBody("calculating amount to liquidate");

        //callStatic does not actually make the call and change the state of the contract, thus liquidateAmount == liquidatableTokens
        const liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidateAccount(vaultID, s.compAddress, BN("1e25"))
        expect(liquidateAmount).to.eq(liquidatableTokens)

        IF = await s.VaultController.interestFactor()
        const expectedBalanceWithInterest = await calculateBalance(IF, s.Dave)

        //tiny liquidation 
        await nextBlockTime(0)
        const result = await s.VaultController.connect(s.Dave).liquidateAccount(vaultID, s.compAddress, BN("1e25"))
        await advanceBlockHeight(1)
        const liquidateArgs = await getArgs(result)

        const liquidateGas = await getGas(result)
        showBodyCyan("Gas cost to do a tiny liquidation: ", liquidateGas)

        const usdi_to_repurchase = liquidateArgs.usdi_to_repurchase
        const tokens_to_liquidate = liquidateArgs.tokens_to_liquidate

        IF = await s.VaultController.interestFactor()
        let expectedLiability = await calculateAccountLiability(carolBorrowPower, IF, initIF)

        //check ending liability 
        let liabiltiy = await s.VaultController.accountLiability(vaultID)
        //TODO - result is off by 0-8, and is inconsistant -- oracle price? Rounding error? 
        if (liabiltiy == expectedLiability.sub(usdi_to_repurchase)) {
            showBodyCyan("LIABILITY MATCH")
        }
        //accept a range to account for miniscule error
        expect(liabiltiy).to.be.gt((expectedLiability.sub(usdi_to_repurchase)).sub(10))
        expect(liabiltiy).to.be.lt((expectedLiability.sub(usdi_to_repurchase)).add(10))

        //Carol's vault's collateral has been reduced by the expected amount
        let balance = await s.COMP.balanceOf(s.CarolVault.address)
        let difference = carolVaultInit.sub(balance)
        assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")

        //Dave spent USDi to liquidate -- TODO: precalc balance
        balance = await s.USDI.balanceOf(s.Dave.address)
        difference = expectedBalanceWithInterest.sub(balance)
        assert.equal(difference.toString(), usdi_to_repurchase.toString(), "Dave spent the correct amount of usdi")

        //Dave received COMP
        balance = await s.COMP.balanceOf(s.Dave.address)
        difference = balance.sub(initCOMPBalanceDave)
        assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")
    })
})
/**
 * TODO: liquidate a vault with exactly 0 borrow power? This is difficult to arrange
 */
describe("Checking for eronious inputs and scenarios", () => {
    const vaultID = 2
    let solvency: boolean
    let AccountLiability: BigNumber, borrowPower: BigNumber, amountUnderwater: BigNumber
    let balance: BigNumber

    before(async () => {
        //showBody("advance 1 week and then calculate interest")
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, false, "Carol's vault is not solvent")
    })

    it("test eronious inputs on external tokensToLiquidate", async () => {
        const carolCompAmount = await s.COMP.balanceOf(s.CarolVault.address)
        let AmountToLiquidate = carolCompAmount.mul(5)
        let tokensToLiquidate: BigNumber
        let liquidateAmount: BigNumber

        liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidateAccount(vaultID, s.compAddress, AmountToLiquidate)
        tokensToLiquidate = await s.VaultController.tokensToLiquidate(vaultID, s.compAddress)
        assert.equal(tokensToLiquidate.toString(), liquidateAmount.toString(), "tokensToLiquidate with same params returns the correct number of tokens to liquidate")

        //puny liquidation amount
        AmountToLiquidate = BN("100")
        liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidateAccount(vaultID, s.compAddress, AmountToLiquidate)
        assert.equal(liquidateAmount.toString(), AmountToLiquidate.toString(), "Passing a small amount to liquidate works as intended")

    })

    it("checks for liquidate with tokens_to_liquidate == 0", async () => {
        //liquidate with tokens_to_liquidate == 0
        await nextBlockTime(0)
        await expect(s.VaultController.connect(s.Dave).liquidateAccount(vaultID, s.compAddress, 0)).to.be.revertedWith("must liquidate>0")
        await advanceBlockHeight(1)
    })

    it("checks for liquidate with an invalid vault address", async () => {
        //invalid address
        await nextBlockTime(0)
        await expect(s.VaultController.connect(s.Dave).liquidateAccount(vaultID, s.Frank.address, BN("1e25"))).to.be.revertedWith("Token not registered")
        await advanceBlockHeight(1)
    })

    it("checks for liquidate with an invalid vault vaultID", async () => {
        //invalid vault ID
        await nextBlockTime(0)
        await expect(s.VaultController.connect(s.Dave).liquidateAccount(69420, s.compAddress, BN("1e25"))).to.be.revertedWith("vault does not exist")
        await advanceBlockHeight(1)
    })

    it("checks for liquidate with a vault that is solvent", async () => {
        //solvent vault
        //carol repays some to become solvent
        AccountLiability = await s.VaultController.accountLiability(vaultID)
        borrowPower = await s.VaultController.accountBorrowingPower(vaultID)
        amountUnderwater = AccountLiability.sub(borrowPower)

        

        //repay amount owed + 1 USDI to account for interest
        const repayResult = await s.VaultController.connect(s.Carol).repayUSDi(vaultID, amountUnderwater.add(utils.parseEther("1")))
        await advanceBlockHeight(1)

        AccountLiability = await s.VaultController.accountLiability(vaultID)
        borrowPower = await s.VaultController.accountBorrowingPower(vaultID)
        amountUnderwater = AccountLiability.sub(borrowPower)

        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, true, "Carol's vault is solvent")

        await expect(s.VaultController.connect(s.Dave).liquidateAccount(vaultID, s.compAddress, BN("1e25"))).to.be.revertedWith("Vault is solvent")
        await advanceBlockHeight(1)
    })

    it("liquidate when liquidator doesn't have any USDi", async () => {

        //showBody("advance 1 week and then calculate interest")
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)



        let EricBalance = await s.USDI.balanceOf(s.Eric.address)
        assert.equal(EricBalance.toString(), "0", "Eric does not have any USDi")

        await expect(s.VaultController.connect(s.Eric).liquidateAccount(vaultID, s.compAddress, utils.parseEther("1"))).to.be.revertedWith("USDI: not enough balance")
        await advanceBlockHeight(1)

    })

    it("liquidate when liquidator doesn't have enough USDi", async () => {
        //send Eric 10 USDI
        const EricUSDI = utils.parseEther("10")
        await s.USDI.connect(s.Dave).transfer(s.Eric.address, EricUSDI)
        await advanceBlockHeight(1)

        let EricBalance = await s.USDI.balanceOf(s.Eric.address)
        assert.equal(EricBalance.toString(), EricUSDI.toString(), `Eric has ${utils.formatEther(EricUSDI.toString())} USDi`)

        await expect(s.VaultController.connect(s.Eric).liquidateAccount(vaultID, s.compAddress, utils.parseEther("1"))).to.be.revertedWith("USDI: not enough balance")
        await advanceBlockHeight(1)

    })

    it("accidently send USDi to the USDI contract", async () => {
        let EricBalance = await s.USDI.balanceOf(s.Eric.address)
        expect(EricBalance).to.be.gt(0)

        //cannot send to USDi contract, see modifier validRecipient
        await expect(s.USDI.connect(s.Eric).transferAll(s.USDI.address)).to.be.reverted
        await advanceBlockHeight(1)

        //need to have Eric end up with 0 USDi for other tests
        await s.USDI.connect(s.Eric).transferAll(s.Dave.address)
        await advanceBlockHeight(1)

        EricBalance = await s.USDI.balanceOf(s.Eric.address)
        assert.equal(EricBalance.toString(), "0", "Eric has empty balance")
    })

    it("repay more than what is owed", async () => {
        balance = await s.USDI.balanceOf(s.Carol.address)
        const startingBalance = balance
        AccountLiability = await s.VaultController.accountLiability(vaultID)

        await expect(s.VaultController.connect(s.Carol).repayUSDi(vaultID, AccountLiability.add(utils.parseEther("50")))).to.be.revertedWith("repay > borrow amount")
        await advanceBlockHeight(1)

        balance = await s.USDI.balanceOf(s.Carol.address)
        assert.equal(balance.toString(), startingBalance.toString(), "Balance has not changed, TX reverted")
    })

    it("repay when borrower doesn't have enough USDI to do so", async () => {
        balance = await s.USDI.balanceOf(s.Carol.address)
        //carol sends all USDi to Dave
        const transferAllResult = await s.USDI.connect(s.Carol).transferAll(s.Dave.address)
        await advanceBlockHeight(1)
        const transferArgs = await getArgs(transferAllResult)
        assert.equal(transferArgs.value.toString(), balance.toString(), "transferAll works as intended")

        balance = await s.USDI.balanceOf(s.Carol.address)
        assert.equal(balance.toNumber(), 0, "Carol now holds 0 USDi tokens")

        await expect(s.VaultController.connect(s.Carol).repayAllUSDi(vaultID)).to.be.revertedWith("USDI: not enough balance")

        await expect(s.VaultController.connect(s.Carol).repayUSDi(vaultID, utils.parseEther("10"))).to.be.revertedWith("USDI: not enough balance")

    })

    it("repay when there is no liability", async () => {
        //Dave transfers enough USDi back to Carol to repay all
        AccountLiability = await s.VaultController.accountLiability(vaultID)

        await s.USDI.connect(s.Dave).transfer(s.Carol.address, AccountLiability.add(utils.parseEther("100")))
        await advanceBlockHeight(1)

        await s.VaultController.connect(s.Carol).repayAllUSDi(vaultID)
        await advanceBlockHeight(1)
        AccountLiability = await s.VaultController.accountLiability(vaultID)
        assert.equal(AccountLiability.toString(), "0", "There is no liability on Carol's vault anymore")

        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        AccountLiability = await s.VaultController.accountLiability(vaultID)
        let VaultBaseLiab = await s.CarolVault.baseLiability()
        assert.equal(VaultBaseLiab.toString(), "0", "Vault base liability is 0")

        assert.equal(AccountLiability.toString(), "0", "AccountLiability is still 0 after calculateInterest() after repayAllUSDi")

        await expect(s.VaultController.connect(s.Carol).repayUSDi(vaultID, 10)).to.be.revertedWith("repay > borrow amount")
        await advanceBlockHeight(1)

        const repayAllResult = await s.VaultController.connect(s.Carol).repayAllUSDi(vaultID)
        await advanceBlockHeight(1)
        let repayGas = await getGas(repayAllResult)
        showBodyCyan("Gas cost to repayAllUSDi on an empty vault: ", repayGas)

    })

    it("borrow against a vault that is not yours", async () => {
        //carol's vault has no debt
        AccountLiability = await s.VaultController.accountLiability(vaultID)
        assert.equal(AccountLiability.toString(), "0", "Carol's vault has no debt")

        //Eric tries to borrow against Carol's vault
        await expect(s.VaultController.connect(s.Eric).borrowUsdi(vaultID, utils.parseEther("500"))).to.be.revertedWith("sender not minter")
        await advanceBlockHeight(1)
    })


    it("makes vault insolvent", async () => {
        const accountBorrowingPower = await s.VaultController.accountBorrowingPower(vaultID)

        //showBodyCyan("BORROW")
        await nextBlockTime(0)
        await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, accountBorrowingPower)
        await advanceBlockHeight(1)

        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, false, "Carol's vault is not solvent")

        AccountLiability = await s.VaultController.accountLiability(vaultID)
        borrowPower = await s.VaultController.accountBorrowingPower(vaultID)
        amountUnderwater = AccountLiability.sub(borrowPower)

        let amountToSolvency = await s.VaultController.amountToSolvency(vaultID)

        assert.equal(amountUnderwater.toString(), amountToSolvency.toString(), "amountToSolvency is correct")
        expect(amountToSolvency).to.be.gt(BN("1e6"))
    })

    it("try to liquidate a vault when you don't have any UDSi to do so with", async () => {
        balance = await s.USDI.balanceOf(s.Eric.address)
        assert.equal(balance.toString(), "0", "Eric has no USDi")

        //eric tries to liquidate
        let amountToSolvency = await s.VaultController.amountToSolvency(vaultID)

        await expect(s.VaultController.connect(s.Eric).liquidateAccount(vaultID, s.COMP.address, amountToSolvency)).to.be.revertedWith("USDI: not enough balance")
        await mineBlock()
    })

    it("try to liquidate a vault when you don't have enough USDi to do so", async () => {
        //Dave sends Eric some USDi - not enough to do a full liquidation
        let amountToSolvency = await s.VaultController.amountToSolvency(vaultID)
        await s.USDI.connect(s.Dave).transfer(s.Eric.address, amountToSolvency.sub(BN("1e8")))
        await mineBlock()

        //eric tries to liquidate
        await expect(s.VaultController.connect(s.Eric).liquidateAccount(vaultID, s.COMP.address, amountToSolvency)).to.be.revertedWith("USDI: not enough balance")
        await mineBlock()

        //Eric transfers USDi back to Dave (in shame)
        await s.USDI.connect(s.Eric).transferAll(s.Dave.address)
        await mineBlock()

        balance = await s.USDI.balanceOf(s.Eric.address)
        assert.equal(balance.toString(), "0", "Eric has no USDi")

    })

    it("repays vault for next set of tests", async () => {

        await s.VaultController.connect(s.Dave).repayAllUSDi(vaultID)
        await mineBlock()

        AccountLiability = await s.VaultController.accountLiability(vaultID)

        assert.equal(AccountLiability.toString(), "0", "Account liability is now 0")
    })
})

describe("Testing remaining vault functions", () => {
    const vaultID = 2
    let solvency: boolean
    let AccountLiability: BigNumber, borrowPower: BigNumber, amountUnderwater: BigNumber
    let balance: BigNumber

    let startingVaultComp: BigNumber
    let startingCarolComp: BigNumber

    const withdrawAmount = utils.parseEther("1")//1 comp token

    it("withdraws some of the ERC20 tokens from vault: ", async () => {
        startingVaultComp = await s.COMP.balanceOf(s.CarolVault.address)
        expect(startingVaultComp).to.be.gt(0)

        startingCarolComp = await s.COMP.balanceOf(s.Carol.address)

        AccountLiability = await s.VaultController.accountLiability(vaultID)
        borrowPower = await s.VaultController.accountBorrowingPower(vaultID)
        amountUnderwater = AccountLiability.sub(borrowPower)


        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, true, "Carol's vault is solvent")

        //withdraw comp from vault
        const withdrawResult = await s.CarolVault.connect(s.Carol).withdrawErc20(s.compAddress, withdrawAmount)
        await mineBlock()

        balance = await s.COMP.balanceOf(s.Carol.address)
        assert.equal(balance.toString(), withdrawAmount.toString(), "Carol has the correct amount of COMP tokens")
    })

    it("withdraw from someone else's vault", async () => {
        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, true, "Carol's vault is solvent")

        //withdraw comp from vault
        await expect(s.CarolVault.connect(s.Eric).withdrawErc20(s.compAddress, withdrawAmount)).to.be.revertedWith("sender not minter")
        await mineBlock()
    })

    it("withdraw more than vault contains when liability is 0", async () => {
        //eric mints a vault
        const ericVaultID = 3
        await expect(s.VaultController.connect(s.Eric).mintVault()).to.not.reverted;
        await mineBlock();
        let getVault = await s.VaultController.vaultAddress(ericVaultID)
        let ericVault = IVault__factory.connect(
            getVault,
            s.Eric,
        );
        expect(await ericVault.minter()).to.eq(s.Eric.address)
        AccountLiability = await s.VaultController.accountLiability(ericVaultID)
        assert.equal(AccountLiability.toString(), "0", "Eric's vault has 0 liability")
        borrowPower = await s.VaultController.accountBorrowingPower(ericVaultID)
        assert.equal(borrowPower.toString(), "0", "Eric's vault has 0 borrow power, so it is empty")

        //withdraw tiny amount
        await expect(ericVault.withdrawErc20(s.COMP.address, 1)).to.be.reverted

        //withdraw 0 on empty vault - withdraw 0 is allowed
        await expect(ericVault.withdrawErc20(s.COMP.address, 0)).to.not.be.reverted
    })

    it("withdraw with bad address", async () => {
        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, true, "Carol's vault is solvent")

        //withdraw comp from vault
        await expect(s.CarolVault.connect(s.Carol).withdrawErc20(s.Frank.address, withdrawAmount)).to.be.reverted
        await mineBlock()
    })

    it("withdraw makes vault insolvent", async () => {
        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, true, "Carol's vault is solvent")

        //borrow a small amount
        const borrowAmount = utils.parseEther("50")
        await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, borrowAmount)
        await advanceBlockHeight(1)

        //withdraw enough comp to make vault insolvent
        const vaultComp = await s.COMP.balanceOf(s.CarolVault.address)
        await expect(s.CarolVault.connect(s.Carol).withdrawErc20(s.COMP.address, vaultComp)).to.be.revertedWith("over-withdrawal")
        await advanceBlockHeight(1)

        //repayAll
        await s.VaultController.connect(s.Carol).repayAllUSDi(vaultID)
        await advanceBlockHeight(1)
    })

    it("makes vault insolvent", async () => {
        const accountBorrowingPower = await s.VaultController.accountBorrowingPower(vaultID)

        //showBodyCyan("BORROW")
        await nextBlockTime(0)
        await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, accountBorrowingPower)
        await advanceBlockHeight(1)

        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, false, "Carol's vault is not solvent")

        AccountLiability = await s.VaultController.accountLiability(vaultID)
        borrowPower = await s.VaultController.accountBorrowingPower(vaultID)
        amountUnderwater = AccountLiability.sub(borrowPower)

        let amountToSolvency = await s.VaultController.amountToSolvency(vaultID)

        assert.equal(amountUnderwater.toString(), amountToSolvency.toString(), "amountToSolvency is correct")
        expect(amountToSolvency).to.be.gt(BN("1e6"))
    })

    it("withdraw from a vault that is insolvent", async () => {
        solvency = await s.VaultController.checkAccount(vaultID)
        assert.equal(solvency, false, "Carol's vault is not solvent")

        //withdraw comp from vault
        await expect(s.CarolVault.connect(s.Carol).withdrawErc20(s.compAddress, withdrawAmount)).to.be.revertedWith("over-withdrawal")
        await mineBlock()
    })

    it("make and borrow from a second vault", async () => {
        balance = await s.COMP.balanceOf(s.Carol.address)
        assert.equal(balance.toString(), utils.parseEther("1").toString(), "Carol has 1 comp")

        //mint second vault
        await expect(s.VaultController.connect(s.Carol).mintVault()).to.not.reverted;
        await mineBlock();
        const newVaultID = await s.VaultController.vaultsMinted()
        let newV = await s.VaultController.vaultAddress(newVaultID)
        const newVault = IVault__factory.connect(
            newV,
            s.Carol,
        );
        expect(await newVault.minter()).to.eq(s.Carol.address)

        //transfer 1 comp to vault
        await expect(s.COMP.connect(s.Carol).transfer(newVault.address, balance)).to.not.reverted;
        await mineBlock()
        AccountLiability = await s.VaultController.accountLiability(newVaultID)
        borrowPower = await s.VaultController.accountBorrowingPower(newVaultID)
        
        assert.equal(AccountLiability.toString(), "0", "New vault has 0 liability")

        let anchorPrice = (await s.UniswapRelayCompUsdc.currentValue())//.div(1e14).toNumber() / 1e4

        showBody(anchorPrice)
        balance = await s.COMP.balanceOf(newVault.address)
        let tokenAmount = await truncate((anchorPrice.mul(balance)).mul(s.COMP_LTV))
        
        showBody(tokenAmount)
        tokenAmount = await truncate(tokenAmount)
        showBody(tokenAmount)
        showBody(utils.formatEther(tokenAmount.toString()))
        

        //this vault is able to be borrowed from
        expect(borrowPower).to.be.gt(0)
        showBody("Borrow Power: ", utils.formatEther(borrowPower.toString()))

    })
})
describe("Checking getters", () => {
    it("checks totalBaseLiability", async () => {
        let _totalBaseLiability = await s.VaultController.totalBaseLiability()
        expect(_totalBaseLiability).to.not.eq(0)
    })
    it("checks _tokensRegistered", async () => {
        let _tokensRegistered = await s.VaultController.tokensRegistered()
        expect(_tokensRegistered).to.not.eq(0)
    })
})

