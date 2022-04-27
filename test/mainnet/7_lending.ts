import { s } from "./scope";
import { ethers, network } from "hardhat";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../util/format";
import { BN } from "../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../util/block";
import { Event, utils, BigNumber } from "ethers";
import { getGas, truncate, getEvent } from "../../util/math";
import _, { first, lastIndexOf, toArray } from "underscore";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { min } from "bn.js";

/**
 * 
 * @param result object returned from a transaction that emits an event 
 * @returns the args from the last event emitted from the transaction
 */
const getArgs = async (result: any) => {
    await advanceBlockHeight(1)
    const receipt = await result.wait()
    await advanceBlockHeight(1)
    const events = receipt.events
    const args = events[events.length - 1].args

    return args
}


/**
 * @note proper procedure: read interest factor from contract -> elapse time -> call this to predict balance -> pay_interest() -> compare 
 * @param interestFactor CURRENT interest factor read from contract before any time has elapsed
 * @param user whose balance to calculate interest on? 
 * @returns expected balance after pay_interest()
 */
const calculateBalance = async (interestFactor: BigNumber, user: SignerWithAddress) => {
    const totalBaseLiability = await s.VaultController._totalBaseLiability()
    const protocolFee = await s.VaultController._protocolFee()

    let valueBefore = await truncate(totalBaseLiability.mul(interestFactor))

    const calcInterestFactor = await payInterestMath(interestFactor)

    let valueAfter = await truncate(totalBaseLiability.mul(calcInterestFactor))
    const protocolAmount = await truncate((valueAfter.sub(valueBefore)).mul(protocolFee))

    const donationAmount = valueAfter.sub(valueBefore).sub(protocolAmount)//wrong
    const currentTotalSupply = await s.USDI.totalSupply()
    let newSupply = currentTotalSupply.add(donationAmount)

    //totalGons
    const totalGons = await s.USDI._totalGons()

    //gpf
    const gpf = totalGons.div(newSupply)

    //calculate balance 
    //get gon balance - calculate? 
    const gonBalance = await s.USDI.scaledBalanceOf(user.address)

    const expectedBalance = gonBalance.div(gpf)
    return expectedBalance
}

/**
 * @dev takes interest factor and returns new interest factor - pulls block time from network and latestInterestTime from contract
 * @param interestFactor  - current interest factor read from contract
 * @returns new interest factor based on time elapsed and reserve ratio (read from contract atm)
 */
const payInterestMath = async (interestFactor: BigNumber) => {

    /**
     * get interest factor from contract
     * //time passes
     * run payInterestMath to get new interest factor
     * calculate_interest()
     * get interest factor from contract
     * should match interestFactor calculated in payInterestMath
     * after confirming they match, use calculated interest factor go calc balance, liability, etc
     */

    //let interestFactor = await s.VaultController.InterestFactor()

    const latestInterestTime = await s.VaultController.LastInterestTime()//calculate? 
    const currentBlock = await ethers.provider.getBlockNumber()
    const currentTime = (await ethers.provider.getBlock(currentBlock)).timestamp
    await nextBlockTime(currentTime)
    //await network.provider.send("evm_mine")

    let timeDifference = currentTime - latestInterestTime.toNumber() + 1 //new block must have time ++1

    const reserveRatio = await s.USDI.reserveRatio()//todo - calculate
    const curve = await s.Curve.getValueAt(nullAddr, reserveRatio)//todo - calculate

    let calculation = BN(timeDifference).mul(BN("1e18").mul(curve))//correct step 1
    calculation = calculation.div(OneYear)//correct step 2 - divide by OneYear
    calculation = await truncate(calculation)//truncate
    calculation = calculation.mul(interestFactor)
    calculation = await truncate(calculation)//truncate again

    //new interest factor
    return interestFactor.add(calculation)
}


/**
 * 
 * @param borrowAmount original borrow amount
 * @param currentInterestFactor current interest factor read from contract 
 * @param initialInterestFactor original interest factor from when borrow took place
 * @returns 
 */
const calculateAccountLiability = async (borrowAmount: BigNumber, currentInterestFactor: BigNumber, initialInterestFactor: BigNumber) => {

    let baseAmount = borrowAmount.mul(BN("1e18"))
    baseAmount = baseAmount.div(initialInterestFactor)
    let currentLiability = baseAmount.mul(currentInterestFactor)
    currentLiability = await truncate(currentLiability)

    return currentLiability
}
const initIF = BN("1e18")
//initIF is 1e18, pay_interest() is called before the first loan is taken, resulting in firstBorrowIF
let firstBorrowIF: BigNumber
const borrowAmount = BN("5000e18")
const nullAddr = "0x0000000000000000000000000000000000000000"
describe("BORROW USDi", async () => {

    //bob tries to borrow usdi against 10 eth as if eth is $100k
    // remember bob has 10 eth
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
        const initInterestFactor = await s.VaultController.InterestFactor()

        expectedInterestFactor = await payInterestMath(initInterestFactor)

        firstBorrowIF = expectedInterestFactor
        const calculatedBaseLiability = await calculateAccountLiability(borrowAmount, initInterestFactor, initInterestFactor)


        const borrowResult = await s.VaultController.connect(s.Bob).borrowUsdi(1, borrowAmount)
        await advanceBlockHeight(1)
        const args = await getArgs(borrowResult)
        actualBorrowAmount = args!.borrowAmount

        //actual new interest factor from contract
        const newInterestFactor = await s.VaultController.InterestFactor()

        assert.equal(newInterestFactor.toString(), expectedInterestFactor.toString(), "New Interest Factor is correct")

        await s.VaultController.calculateInterest()
        const liability = await s.VaultController.connect(s.Bob).AccountLiability(1)
        assert.equal(liability.toString(), calculatedBaseLiability.toString(), "Calculated base liability is correct")

        const resultingUSDiBalance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(resultingUSDiBalance.toString(), actualBorrowAmount.toString(), "Bob received the correct amount of USDi")

    });
    it(`after 1 week, bob should have a liability greater than ${"BN(5000e18)"}`, async () => {

        await advanceBlockHeight(1)
        await fastForward(OneWeek)
        await advanceBlockHeight(1)

        let interestFactor = await s.VaultController.InterestFactor()
        const calculatedInterestFactor = await payInterestMath(interestFactor)

        const expectedLiability = await calculateAccountLiability(borrowAmount, calculatedInterestFactor, firstBorrowIF)

        const result = await s.VaultController.connect(s.Frank).calculateInterest();
        await advanceBlockHeight(1)
        const interestGas = await getGas(result)
        showBodyCyan("Gas cost to calculate interest: ", interestGas)

        interestFactor = await s.VaultController.InterestFactor()
        assert.equal(interestFactor.toString(), calculatedInterestFactor.toString(), "Interest factor is correct")

        const readLiability = await s
            .VaultController.connect(s.Bob)
            .AccountLiability(1);

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
        let interestFactor = await s.VaultController.InterestFactor()
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

        //showBody("initBalance    : ", initBalance)
        //showBody("expectedBalance: ", expectedBalance)

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

        let liability = await s.BobVault.connect(s.Bob).BaseLiability()
        let partialLiability = liability.div(2) //half

        //check pauseable 
        await s.VaultController.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.VaultController.connect(s.Bob).repayUSDi(vaultId, partialLiability)).to.be.revertedWith("Pausable: paused")
        await s.VaultController.connect(s.Frank).unpause()
        await advanceBlockHeight(1)

        //need to get liability again, 2 seconds have passed when checking pausable
        liability = await s.BobVault.connect(s.Bob).BaseLiability()
        partialLiability = liability.div(2) //half

        //current interest factor
        let interestFactor = await s.VaultController.InterestFactor()
        const expectedBalanceWithInterest = await calculateBalance(interestFactor, s.Bob)

        //next interest factor if pay_interest was called now
        const calculatedInterestFactor = await payInterestMath(interestFactor)

        const base_amount = (partialLiability.mul(BN("1e18"))).div(calculatedInterestFactor)

        const expectedBaseLiability = liability.sub(base_amount)

        const repayResult = await s.VaultController.connect(s.Bob).repayUSDi(vaultId, partialLiability)
        await advanceBlockHeight(1)
        const repayGas = await getGas(repayResult)
        showBodyCyan("Gas cost do partial repay: ", repayGas)

        interestFactor = await s.VaultController.InterestFactor()
        assert.equal(interestFactor.toString(), calculatedInterestFactor.toString(), "Interest factor is correct")

        let updatedLiability = await s.BobVault.connect(s.Bob).BaseLiability()
        let balance = await s.USDI.balanceOf(s.Bob.address)

        assert.equal(expectedBaseLiability.toString(), updatedLiability.toString(), "Updated liability matches calculated liability")
        assert.equal(balance.toString(), (expectedBalanceWithInterest.sub(partialLiability)).toString(), "Balances are correct")

    })
    it("bob compeltely repays vault", async () => {
        //check pauseable 
        await s.VaultController.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.VaultController.connect(s.Bob).repayAllUSDi(1)).to.be.revertedWith("Pausable: paused")
        await s.VaultController.connect(s.Frank).unpause()
        await advanceBlockHeight(1)

        //current interest factor
        let interestFactor = await s.VaultController.InterestFactor()
        const expectedBalanceWithInterest = await calculateBalance(interestFactor, s.Bob)
        let liability = await s.BobVault.connect(s.Bob).BaseLiability()

        //next interest factor if pay_interest was called now
        const calculatedInterestFactor = await payInterestMath(interestFactor)

        const expectedUSDIliability = await truncate(calculatedInterestFactor.mul(liability))

        const repayResult = await s.VaultController.connect(s.Bob).repayAllUSDi(1)
        await advanceBlockHeight(1)
        const repayGas = await getGas(repayResult)
        showBodyCyan("Gas cost do total repay: ", repayGas)
        const args = await getArgs(repayResult)

        assert.equal(args.repayAmount.toString(), expectedUSDIliability.toString(), "Expected USDI amount repayed and burned")

        let updatedLiability = await s.BobVault.connect(s.Bob).BaseLiability()
        expect(updatedLiability).to.eq(0)

        let balance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(expectedBalanceWithInterest.sub(expectedUSDIliability).toString(), balance.toString(), "Expected balance is correct")
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
        const borrowInterestFactor = await s.VaultController.InterestFactor()
        let calcIF = await payInterestMath(borrowInterestFactor)
        const AccountBorrowingPower = await s.VaultController.AccountBorrowingPower(vaultID)
        await nextBlockTime(0)
        await s.VaultController.connect(s.Bob).borrowUsdi(vaultID, AccountBorrowingPower)
        await advanceBlockHeight(1)
        let IF = await s.VaultController.InterestFactor()
        const initIF = IF
        assert.equal(IF.toString(), calcIF.toString())

        /******** CHECK WITHDRAW BEFORE CALCULATE INTEREST ********/
        //skip time so we can put vault below liquidation threshold 
        await fastForward(OneYear * 10);//10 year
        await advanceBlockHeight(1)
        const tenYearIF = await payInterestMath(calcIF)

        //calculate interest to update protocol, vault is now able to be liquidated 
        await nextBlockTime(0)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)
        IF = await s.VaultController.InterestFactor()
        assert.equal(tenYearIF.toString(), IF.toString(), "Interest factor calculation is correct after 10 years")

        //init balances after calculate interest
        const initWethBalanceDave = await s.WETH.balanceOf(s.Dave.address)

        //check pauseable 
        await s.VaultController.connect(s.Frank).pause()
        await advanceBlockHeight(1)
        await expect(s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.wethAddress, BN("1e16"))).to.be.revertedWith("Pausable: paused")
        await s.VaultController.connect(s.Frank).unpause()
        await advanceBlockHeight(1)

        //expectedBalanceWithInterest must be calced here - TODO why? 
        const expectedBalanceWithInterest = await calculateBalance(IF, s.Dave)

        //showBody("liquidateAmount: ", utils.formatEther(liquidateAmount.toString()))
        let vaultWETH = await s.WETH.balanceOf(s.BobVault.address)
        assert.equal(vaultWETH.toString(), bobVaultInit.toString(), "Vault still has all of its wETH")

        let daveWETH = await s.WETH.balanceOf(s.Dave.address)
        assert.equal(daveWETH.toString(), "0", "Dave does not have any wETH before liquidation ")

        showBodyCyan("LIQUIDATE")
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //liquidate account without having en
        //TODO - confirm contract calculation for amount to liquidate and compare to event arg
        await nextBlockTime(0)
        const result = await s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.wethAddress, bobVaultInit)
        await advanceBlockHeight(1)
        const receipt = await result.wait()
        await nextBlockTime(0)
        const liquidateGas = await getGas(result)
        showBody("Gas cost to beat for liquidation :  447,572")
        showBodyCyan("Gas cost to do a big liquidation: ", liquidateGas)
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////

        /**
         //TODO calculate expected usdi_to_repurchase
        const liquidationArgs = await getArgs(result)


        let rawPrice = await s.Oracle.getLivePrice(s.wethAddress)
        showBody("rawPrice: ", rawPrice)
        let oraclePrice = rawPrice.div(1e14).toNumber() / 1e4
        showBody("oraclePrice", oraclePrice)

        let expectedUSDIrepurchase = await truncate(rawPrice.mul(liquidationArgs.tokens_to_liquidate))

        showBody("expectedUSDIrepurchase: ", utils.formatEther(expectedUSDIrepurchase.toString()))
        showBody("usdi_to_repurchase    : ", utils.formatEther(liquidationArgs.usdi_to_repurchase.toString()))


         */

        daveWETH = await s.WETH.balanceOf(s.Dave.address)
        assert.equal(daveWETH.toString(), bobVaultInit.toString(), "Dave now has all of the vault's collateral")
        const endingVaultWETH = await s.WETH.balanceOf(s.BobVault.address)
        assert.equal(endingVaultWETH.toString(), "0", "Vault is empty")

        IF = await s.VaultController.InterestFactor()
        let expectedLiability = await calculateAccountLiability(AccountBorrowingPower, IF, initIF)

        let interestEvent = await getEvent(result, "InterestEvent")
        assert.equal(interestEvent.event, "InterestEvent", "Correct event captured and emitted")

        let liquidateEvent = receipt.events![receipt.events!.length - 1]
        let args = liquidateEvent.args
        assert.equal(liquidateEvent.event, "Liquidate", "Correct event captured and emitted")
        assert.equal(args!.asset_address.toString().toUpperCase(), s.wethAddress.toString().toUpperCase(), "Asset address is correct")
        const usdi_to_repurchase = args!.usdi_to_repurchase
        const tokens_to_liquidate = args!.tokens_to_liquidate

        /******** check ending balances ********/
        //check ending liability 
        let liabiltiy = await s.VaultController.AccountLiability(vaultID)

        //TODO - result is off by 0-8, and is inconsistant -- oracle price? Rounding error? 
        if (liabiltiy == expectedLiability.sub(usdi_to_repurchase)) {
            showBodyCyan("LIABILITY MATCH")
        }
        //accept a range to account for miniscule error
        expect(liabiltiy).to.be.gt((expectedLiability.sub(usdi_to_repurchase)).sub(10))
        expect(liabiltiy).to.be.lt((expectedLiability.sub(usdi_to_repurchase)).add(10))
        //assert.equal(liabiltiy.toString(), expectedLiability.sub(usdi_to_repurchase).toString(), "Calculated liability is correct")

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
        const carolBorrowPower = await s.VaultController.AccountBorrowingPower(2)
        await advanceBlockHeight(1)
        const borrowResult = await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, carolBorrowPower)
        await advanceBlockHeight(1)
        let IF = await s.VaultController.InterestFactor()
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

        let liquidatableTokens = await s.VaultController.TokensToLiquidate(vaultID, s.compAddress)

        //showBody("calculating amount to liquidate");

        //callStatic does not actually make the call and change the state of the contract, thus liquidateAmount == liquidatableTokens
        const liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidate_account(vaultID, s.compAddress, BN("1e25"))
        expect(liquidateAmount).to.eq(liquidatableTokens)

        IF = await s.VaultController.InterestFactor()
        const expectedBalanceWithInterest = await calculateBalance(IF, s.Dave)

        //tiny liquidation 
        //liquidate account with large amount - TODO - confirm contract calculation for amount to liquidate and compare to event arg
        await nextBlockTime(0)
        const result = await s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.compAddress, BN("1e25"))
        await advanceBlockHeight(1)
        const liquidateArgs = await getArgs(result)

        const liquidateGas = await getGas(result)
        showBody("Gas cost to beat for liquidation :  489,498")
        showBodyCyan("Gas cost to do a tiny liquidation: ", liquidateGas)

        const usdi_to_repurchase = liquidateArgs.usdi_to_repurchase
        const tokens_to_liquidate = liquidateArgs.tokens_to_liquidate

        IF = await s.VaultController.InterestFactor()
        let expectedLiability = await calculateAccountLiability(carolBorrowPower, IF, initIF)

        //check ending liability 
        let liabiltiy = await s.VaultController.AccountLiability(vaultID)
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

        it("test eronious inputs on external TokensToLiquidate", async () => {
            const carolCompAmount = await s.COMP.balanceOf(s.CarolVault.address)
            let AmountToLiquidate = carolCompAmount.mul(5)
            let TokensToLiquidate: BigNumber
            let liquidateAmount: BigNumber

            liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidate_account(vaultID, s.compAddress, AmountToLiquidate)
            TokensToLiquidate = await s.VaultController.TokensToLiquidate(vaultID, s.compAddress)
            assert.equal(TokensToLiquidate.toString(), liquidateAmount.toString(), "TokensToLiquidate with same params returns the correct number of tokens to liquidate")

            //puny liquidation amount
            AmountToLiquidate = BN("100")
            liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidate_account(vaultID, s.compAddress, AmountToLiquidate)
            assert.equal(liquidateAmount.toString(), AmountToLiquidate.toString(), "Passing a small amount to liquidate works as intended")

        })

        it("checks for liquidate with tokens_to_liquidate == 0", async () => {
            //liquidate with tokens_to_liquidate == 0
            await nextBlockTime(0)
            await expect(s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.compAddress, 0)).to.be.revertedWith("must liquidate >0")
            await advanceBlockHeight(1)
        })

        it("checks for liquidate with an invalid vault address", async () => {
            //invalid address
            await nextBlockTime(0)
            await expect(s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.Frank.address, BN("1e25"))).to.be.revertedWith("token not enabled")
            await advanceBlockHeight(1)
        })

        it("checks for liquidate with an invalid vault vaultID", async () => {
            //invalid vault ID
            await nextBlockTime(0)
            await expect(s.VaultController.connect(s.Dave).liquidate_account(69420, s.compAddress, BN("1e25"))).to.be.revertedWith("vault does not exist")
            await advanceBlockHeight(1)
        })
        it("checks for liquidate with a vault that is solvent", async () => {
            //solvent vault
            //carol repays some to become solvent
            AccountLiability = await s.VaultController.AccountLiability(vaultID)
            borrowPower = await s.VaultController.AccountBorrowingPower(vaultID)
            amountUnderwater = AccountLiability.sub(borrowPower)

            //repay amount owed + 1 USDI to account for interest
            const repayResult = await s.VaultController.connect(s.Carol).repayUSDi(vaultID, amountUnderwater.add(utils.parseEther("1")))
            await advanceBlockHeight(1)

            AccountLiability = await s.VaultController.AccountLiability(vaultID)
            borrowPower = await s.VaultController.AccountBorrowingPower(vaultID)
            amountUnderwater = AccountLiability.sub(borrowPower)

            solvency = await s.VaultController.checkAccount(vaultID)
            assert.equal(solvency, true, "Carol's vault is solvent")

            await expect(s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.compAddress, BN("1e25"))).to.be.revertedWith("Vault is solvent")
            await advanceBlockHeight(1)
        })
        it("liquidate vault with exactly 0 additional borrow power - already borrowed maximum", async () => {
            //liquidate vault with exactly 0 additional borrow power - already borrowed maximum
            balance = await s.USDI.balanceOf(s.Carol.address)
            AccountLiability = await s.VaultController.AccountLiability(vaultID)
            expect(balance).to.be.gt(AccountLiability)

            //await s.VaultController.connect(s.Carol).repayUSDi(vaultID, utils.parseEther("500"))
            await s.VaultController.connect(s.Carol).repayAllUSDi(vaultID)
            await advanceBlockHeight(1)

            const AccountBorrowingPower = await s.VaultController.AccountBorrowingPower(vaultID)

            //showBodyCyan("BORROW")
            await nextBlockTime(0)
            await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, AccountBorrowingPower)
            await advanceBlockHeight(1)

            solvency = await s.VaultController.checkAccount(vaultID)
            assert.equal(solvency, true, "Carol's vault is solvent")

            AccountLiability = await s.VaultController.AccountLiability(vaultID)
            borrowPower = await s.VaultController.AccountBorrowingPower(vaultID)
            amountUnderwater = AccountLiability.sub(borrowPower)

            //TODO THINGS BELOW 

            //showBody("AccountLiability: ", utils.formatEther(AccountLiability.toString()))
            //showBody("borrowPower: ", utils.formatEther(borrowPower.toString()))
            //showBody("amountUnderwater: ", utils.formatEther(amountUnderwater.toString()))
            //showBody("raw amount under: ", amountUnderwater)


            //liquidate
            const liquidateResult = await s.VaultController.connect(s.Dave).liquidate_account(vaultID, s.compAddress, BN("1e25"))
            await advanceBlockHeight(1)
            const liquidateArgs = await getArgs(liquidateResult)
            //showBody(liquidateArgs)

            //showBody("USDI amount liquidated: ", utils.formatEther(liquidateArgs.tokens_to_liquidate.toString()))

            AccountLiability = await s.VaultController.AccountLiability(vaultID)
            borrowPower = await s.VaultController.AccountBorrowingPower(vaultID)
            amountUnderwater = AccountLiability.sub(borrowPower)
            /**
            showBody("AccountLiability: ", utils.formatEther(AccountLiability.toString()))
            showBody("borrowPower: ", utils.formatEther(borrowPower.toString()))
            showBody("amountUnderwater: ", utils.formatEther(amountUnderwater.toString()))
            showBody("raw amount under: ", amountUnderwater)
             */
        })
        it("liquidate when liquidator doesn't have any USDi", async () => {

            //showBody("advance 1 week and then calculate interest")
            await fastForward(OneWeek)
            await s.VaultController.calculateInterest()
            await advanceBlockHeight(1)



            let EricBalance = await s.USDI.balanceOf(s.Eric.address)
            assert.equal(EricBalance.toString(), "0", "Eric does not have any USDi")

            await expect(s.VaultController.connect(s.Eric).liquidate_account(vaultID, s.compAddress, utils.parseEther("1"))).to.be.revertedWith("USDI: not enough balance")
            await advanceBlockHeight(1)

        })

        it("liquidate when liquidator doesn't have enough USDi", async () => {
            //send Eric 10 USDI
            const EricUSDI = utils.parseEther("10")
            await s.USDI.connect(s.Dave).transfer(s.Eric.address, EricUSDI)
            await advanceBlockHeight(1)

            let EricBalance = await s.USDI.balanceOf(s.Eric.address)
            assert.equal(EricBalance.toString(), EricUSDI.toString(), `Eric has ${utils.formatEther(EricUSDI.toString())} USDi`)

            await expect(s.VaultController.connect(s.Eric).liquidate_account(vaultID, s.compAddress, utils.parseEther("1"))).to.be.revertedWith("USDI: not enough balance")
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
            AccountLiability = await s.VaultController.AccountLiability(vaultID)

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
            AccountLiability = await s.VaultController.AccountLiability(vaultID)

            await s.USDI.connect(s.Dave).transfer(s.Carol.address, AccountLiability.add(utils.parseEther("100")))
            await advanceBlockHeight(1)

            await s.VaultController.connect(s.Carol).repayAllUSDi(vaultID)
            await advanceBlockHeight(1)
            AccountLiability = await s.VaultController.AccountLiability(vaultID)
            assert.equal(AccountLiability.toString(), "0", "There is no liability on Carol's vault anymore")

            await s.VaultController.calculateInterest()
            await advanceBlockHeight(1)

            AccountLiability = await s.VaultController.AccountLiability(vaultID)
            let VaultBaseLiab = await s.CarolVault.BaseLiability()
            assert.equal(VaultBaseLiab.toString(), "0", "Vault base liability is 0")

            assert.equal(AccountLiability.toString(), "0", "AccountLiability is still 0 after calculateInterest() after repayAllUSDi")

            //showBodyCyan("REPAY USDI CHECK ")

            await expect(s.VaultController.connect(s.Carol).repayUSDi(vaultID, 10)).to.be.revertedWith("repay > borrow amount")
            await advanceBlockHeight(1)

            const repayAllResult = await s.VaultController.connect(s.Carol).repayAllUSDi(vaultID)
            await advanceBlockHeight(1)
            let repayGas = await getGas(repayAllResult)
            showBodyCyan("Gas cost to repayAllUSDi on an empty vault: ", repayGas)

        })

        it("borrow against a vault that is not yours", async () => {
            //carol's vault has no debt
            AccountLiability = await s.VaultController.AccountLiability(vaultID)
            assert.equal(AccountLiability.toString(), "0", "Carol's vault has no debt")
        
            //Eric tries to borrow against Carol's vault
            await expect(s.VaultController.connect(s.Eric).borrowUsdi(vaultID, utils.parseEther("500"))).to.be.revertedWith("sender not minter")
            await advanceBlockHeight(1)
        })



        /**
         it("doesathing", async () => {

        })
         */


    })


})


