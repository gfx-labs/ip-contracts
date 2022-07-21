import { s } from "./scope";
import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../util/format";
import { BN } from "../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../util/block";
import { utils, BigNumber } from "ethers";
import { getGas, getArgs, truncate, getEvent, toNumber } from "../../util/math";
import { IVault__factory } from "../../typechain-types";

let firstBorrowIF: BigNumber
const borrowAmount = BN("5000e18")
describe("BORROW USDi", async () => {

    //bob tries to borrow USDi against 10 eth as if eth is $100k
    // remember bob has 10 wETH
    let actualBorrowAmount: any
    let expectedInterestFactor: BigNumber
    it(`bob should not be able to borrow 1e6 * 1e18 * ${s.Bob_WETH} USDi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID,
            s.Bob_WETH.mul(BN("1e18")).mul(1e6),
        )).to.be.revertedWith("vault insolvent");
    });

    it(`bob should be able to borrow ${utils.parseEther(borrowAmount.toString())} USDi`, async () => {

        const initUSDiBalance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(initUSDiBalance.toString(), "0", "Bob starts with 0 USDi")

        const borrowResult = await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)
        await advanceBlockHeight(1)
        const gas = await getGas(borrowResult)
        showBodyCyan("Gas cost to borrowUSDI: ", gas)

        const args = await getArgs(borrowResult)
        actualBorrowAmount = args!.borrowAmount

        const resultingUSDiBalance = await s.USDI.balanceOf(s.Bob.address)
        assert.equal(resultingUSDiBalance.toString(), actualBorrowAmount.toString(), "Bob received the correct amount of USDi")

    });
    it(`after 1 week, bob should have a liability greater than ${utils.parseEther(borrowAmount.toString())}`, async () => {

        await advanceBlockHeight(1)
        await fastForward(OneWeek)
        await advanceBlockHeight(1)

        const result = await s.VaultController.connect(s.Frank).calculateInterest();
        await advanceBlockHeight(1)
        const interestGas = await getGas(result)
        showBodyCyan("Gas cost to calculate interest: ", interestGas)
    
        const readLiability = await s
            .VaultController.connect(s.Bob)
            .vaultLiability(s.BobVaultID);

        expect(readLiability).to.be.gt(BN("5000e18"));

    });
});

describe("Checking interest generation", () => {
    it("check change in balance over a long period of time", async () => {
        const initBalance = await s.USDI.balanceOf(s.Dave.address)
        //fastForward
        await fastForward(OneYear);//1 year
        await advanceBlockHeight(1)

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

        //interest accrued
        expect(balance > initBalance)
    })
})

describe("Testing repay", () => {
    const borrowAmount = BN("10e18")
    it(`bob should able to borrow ${borrowAmount} USDi`, async () => {
        await expect(s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, borrowAmount)).to.not.be.reverted;
    });
    it("partial repay", async () => {
        const vaultId = s.BobVaultID

        let liability = await s.BobVault.connect(s.Bob).baseLiability()
        let partialLiability = liability.div(2) //half
        const initBalance = await s.USDI.balanceOf(s.Bob.address)


        const repayResult = await s.VaultController.connect(s.Bob).repayUSDi(vaultId, partialLiability)
        await advanceBlockHeight(1)
        const repayGas = await getGas(repayResult)
        showBodyCyan("Gas cost do partial repay: ", repayGas)


        let updatedLiability = await s.BobVault.connect(s.Bob).baseLiability()
        let balance = await s.USDI.balanceOf(s.Bob.address)

        expect(await toNumber(balance)).to.be.closeTo(await toNumber(initBalance.sub(partialLiability)), 50)
        expect(await toNumber(updatedLiability)).to.be.closeTo(await toNumber(liability.sub(partialLiability)), 50)

    })
    it("bob compeltely repays vault", async () => {

        let balance = await s.USDC.balanceOf(s.Bob.address)
        const amount = BN("50e6")//50 USDC

        expect(amount).to.be.lt(balance)//Bob has enough USDC

        await s.USDC.connect(s.Bob).approve(s.USDI.address, amount)
        await advanceBlockHeight(1)
        
        const deposit = s.USDI.connect(s.Bob).deposit(amount)
        await expect(deposit.catch(console.log)).to.not.reverted;
        const repayResult = await s.VaultController.connect(s.Bob).repayAllUSDi(s.BobVaultID)
        await advanceBlockHeight(1)
        const repayGas = await getGas(repayResult)
        showBodyCyan("Gas cost do total repay: ", repayGas)
        const args = await getArgs(repayResult)

        let updatedLiability = await s.BobVault.connect(s.Bob).baseLiability()
        expect(updatedLiability).to.eq(0)//vault has been completely repayed 
    })
})

describe("Testing liquidations", () => {
    it(`bob should have ${s.Bob_WETH} wETH deposited`, async () => {
        expect(await s.BobVault.connect(s.Bob).tokenBalance(s.WETH.address)).to.eq(s.Bob_WETH);
    });
    it("borrow maximum and liquidate down to empty vault", async () => {
        const vaultID = s.BobVaultID
        const bobVaultInit = await s.WETH.balanceOf(s.BobVault.address)
        const initWethBalanceDave = await s.WETH.balanceOf(s.Dave.address)

        //borrow maximum -> borrow amount == collateral value 
        const accountBorrowingPower = await s.VaultController.vaultBorrowingPower(vaultID)
        await s.VaultController.connect(s.Bob).borrowUsdi(s.BobVaultID, accountBorrowingPower)
        await mineBlock()
  
        /******** CHECK withdraw BEFORE CALCULATE INTEREST ********/
        //skip time so we can put vault below liquidation threshold 
        await fastForward(OneYear * 100);//100 year
        await advanceBlockHeight(1)
        await nextBlockTime(0)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        let vaultWETH = await s.WETH.balanceOf(s.BobVault.address)
        assert.equal(vaultWETH.toString(), bobVaultInit.toString(), "Vault still has all of its wETH")

        let daveWETH = await s.WETH.balanceOf(s.Dave.address)
        assert.equal(daveWETH.toString(), "0", "Dave does not have any wETH before liquidation ")

        const result = await s.VaultController.connect(s.Dave).liquidateVault(vaultID, s.wethAddress, bobVaultInit)
        await advanceBlockHeight(1)
        const receipt = await result.wait()
        const liquidateGas = await getGas(result)
        showBodyCyan("Gas cost to do a big liquidation: ", liquidateGas)

        daveWETH = await s.WETH.balanceOf(s.Dave.address)
        assert.equal(daveWETH.toString(), bobVaultInit.toString(), "Dave now has all of the vault's collateral")
        const endingVaultWETH = await s.WETH.balanceOf(s.BobVault.address)
        assert.equal(endingVaultWETH.toString(), "0", "Vault is empty")

        let interestEvent = await getEvent(result, "InterestEvent")
        assert.equal(interestEvent.event, "InterestEvent", "Correct event captured and emitted")

        let liquidateEvent = receipt.events![receipt.events!.length - 1]
        let args = liquidateEvent.args
        assert.equal(liquidateEvent.event, "Liquidate", "Correct event captured and emitted")
        assert.equal(args!.asset_address.toString().toUpperCase(), s.wethAddress.toString().toUpperCase(), "Asset address is correct")
        const usdi_to_repurchase = args!.usdi_to_repurchase
        const tokens_to_liquidate = args!.tokens_to_liquidate


        //Bob's vault's collateral has been reduced by the expected amount
        let balance = await s.WETH.balanceOf(s.BobVault.address)
        let difference = bobVaultInit.sub(balance)
        assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")

        //Dave spent USDi to liquidate -- TODO: precalc balance
        balance = await s.USDI.balanceOf(s.Dave.address)

        //Dave received wETH
        balance = await s.WETH.balanceOf(s.Dave.address)
        difference = balance.sub(initWethBalanceDave)
        assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")
    })

    it("checks for over liquidation and then liquidates a vault that is just barely insolvent", async () => {

        const vaultID = s.CaroLVaultID
        const carolVaultInit = await s.UNI.balanceOf(s.CarolVault.address)
        const initUniBalanceDave = await s.UNI.balanceOf(s.Dave.address)

        //borrow maximum USDi
        const carolBorrowPower = await s.VaultController.vaultBorrowingPower(s.CaroLVaultID)
        await advanceBlockHeight(1)
        const borrowResult = await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, carolBorrowPower)
        await advanceBlockHeight(1)
        const args = await getArgs(borrowResult)
        const actualBorrowAmount = args!.borrowAmount

        //carol did not have any USDi before borrowing some
        expect(await s.USDI.balanceOf(s.Carol.address)).to.eq(actualBorrowAmount)

        let solvency = await s.VaultController.checkVault(vaultID)
        assert.equal(solvency, true, "Carol's vault is solvent")

        //showBody("advance 1 week and then calculate interest")
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        solvency = await s.VaultController.checkVault(vaultID)
        assert.equal(solvency, false, "Carol's vault is not solvent")

        let liquidatableTokens = await s.VaultController.tokensToLiquidate(vaultID, s.uniAddress)

        //callStatic does not actually make the call and change the state of the contract, thus liquidateAmount == liquidatableTokens
        const liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidateVault(vaultID, s.uniAddress, BN("1e25"))
        expect(liquidateAmount).to.eq(liquidatableTokens)

        //tiny liquidation 
        await nextBlockTime(0)
        const result = await s.VaultController.connect(s.Dave).liquidateVault(vaultID, s.uniAddress, BN("1e25"))
        await advanceBlockHeight(1)
        const liquidateArgs = await getArgs(result)

        const liquidateGas = await getGas(result)
        showBodyCyan("Gas cost to do a tiny liquidation: ", liquidateGas)

        const tokens_to_liquidate = liquidateArgs.tokens_to_liquidate

        //Carol's vault's collateral has been reduced by the expected amount
        let balance = await s.UNI.balanceOf(s.CarolVault.address)
        let difference = carolVaultInit.sub(balance)
        assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")

        //Dave received UNI
        balance = await s.UNI.balanceOf(s.Dave.address)
        difference = balance.sub(initUniBalanceDave)
        assert.equal(difference.toString(), tokens_to_liquidate.toString(), "Correct number of tokens liquidated from vault")
    })
})
describe("Checking for eronious inputs and scenarios", () => {
    let vaultID: BigNumber
    let solvency: boolean
    let AccountLiability: BigNumber, borrowPower: BigNumber, amountUnderwater: BigNumber
    let balance: BigNumber

    before(async () => {
        //showBody("advance 1 week and then calculate interest")
        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        vaultID = s.CaroLVaultID

        solvency = await s.VaultController.checkVault(vaultID)
        assert.equal(solvency, false, "Carol's vault is not solvent")
    })

    it("test eronious inputs on external tokensToLiquidate", async () => {
        const carolUniAmount = await s.UNI.balanceOf(s.CarolVault.address)
        let AmountToLiquidate = carolUniAmount.mul(5)
        let tokensToLiquidate: BigNumber
        let liquidateAmount: BigNumber

        liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidateVault(vaultID, s.uniAddress, AmountToLiquidate)
        tokensToLiquidate = await s.VaultController.tokensToLiquidate(vaultID, s.uniAddress)
        assert.equal(tokensToLiquidate.toString(), liquidateAmount.toString(), "tokensToLiquidate with same params returns the correct number of tokens to liquidate")

        //puny liquidation amount
        AmountToLiquidate = BN("100")
        liquidateAmount = await s.VaultController.connect(s.Dave).callStatic.liquidateVault(vaultID, s.uniAddress, AmountToLiquidate)
        assert.equal(liquidateAmount.toString(), AmountToLiquidate.toString(), "Passing a small amount to liquidate works as intended")

    })

    it("checks for liquidate with tokens_to_liquidate == 0", async () => {
        //liquidate with tokens_to_liquidate == 0
        await nextBlockTime(0)
        await expect(s.VaultController.connect(s.Dave).liquidateVault(vaultID, s.uniAddress, 0)).to.be.revertedWith("must liquidate>0")
        await advanceBlockHeight(1)
    })

    it("checks for liquidate with an invalid vault address", async () => {
        //invalid address
        await nextBlockTime(0)
        await expect(s.VaultController.connect(s.Dave).liquidateVault(vaultID, s.Frank.address, BN("1e25"))).to.be.revertedWith("Token not registered")
        await advanceBlockHeight(1)
    })

    it("checks for liquidate with an invalid vault vaultID", async () => {
        //invalid vault ID
        await nextBlockTime(0)
        await expect(s.VaultController.connect(s.Dave).liquidateVault(69420, s.uniAddress, BN("1e25"))).to.be.revertedWith("vault does not exist")
        await advanceBlockHeight(1)
    })

    it("checks for liquidate with a vault that is solvent", async () => {
        //carol repays some to become solvent
        AccountLiability = await s.VaultController.vaultLiability(vaultID)
        borrowPower = await s.VaultController.vaultBorrowingPower(vaultID)
        amountUnderwater = AccountLiability.sub(borrowPower)

        //repay amount owed + 1 USDi to account for interest
        const repayResult = await s.VaultController.connect(s.Carol).repayUSDi(vaultID, amountUnderwater.add(utils.parseEther("1")))
        await advanceBlockHeight(1)

        AccountLiability = await s.VaultController.vaultLiability(vaultID)
        borrowPower = await s.VaultController.vaultBorrowingPower(vaultID)
        amountUnderwater = AccountLiability.sub(borrowPower)

        solvency = await s.VaultController.checkVault(vaultID)
        assert.equal(solvency, true, "Carol's vault is solvent")

        await expect(s.VaultController.connect(s.Dave).liquidateVault(vaultID, s.uniAddress, BN("1e25"))).to.be.revertedWith("Vault is solvent")
        await advanceBlockHeight(1)
    })

    it("tokens to liquidate on solvent vault", async () => {
        solvency = await s.VaultController.checkVault(vaultID)
        assert.equal(solvency, true, "Carol's vault is solvent")
        await expect(s.VaultController.tokensToLiquidate(vaultID, s.uniAddress)).to.be.revertedWith("Vault is solvent")
    })

    it("liquidate when liquidator doesn't have any USDi", async () => {

        await fastForward(OneYear * 10)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        let EricBalance = await s.USDI.balanceOf(s.Eric.address)
        assert.equal(EricBalance.toString(), "0", "Eric does not have any USDi")

        await expect(s.VaultController.connect(s.Eric).liquidateVault(vaultID, s.uniAddress, utils.parseEther("1"))).to.be.revertedWith("USDI: not enough balance")
        await advanceBlockHeight(1)

    })

    it("liquidate when liquidator doesn't have enough USDi", async () => {
        //send Eric 1 USDi
        const EricUSDI = utils.parseEther("1")
        await s.USDI.connect(s.Dave).transfer(s.Eric.address, EricUSDI)
        await advanceBlockHeight(1)

        let EricBalance = await s.USDI.balanceOf(s.Eric.address)
        assert.equal(EricBalance.toString(), EricUSDI.toString(), `Eric has ${utils.formatEther(EricUSDI.toString())} USDi`)

        await expect(s.VaultController.connect(s.Eric).liquidateVault(vaultID, s.uniAddress, utils.parseEther("1"))).to.be.revertedWith("USDI: not enough balance")
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
        AccountLiability = await s.VaultController.vaultLiability(vaultID)

        await expect(s.VaultController.connect(s.Carol).repayUSDi(vaultID, AccountLiability.add(utils.parseEther("50")))).to.be.revertedWith("repay > borrow amount")
        await advanceBlockHeight(1)

        balance = await s.USDI.balanceOf(s.Carol.address)
        assert.equal(balance.toString(), startingBalance.toString(), "Balance has not changed, TX reverted")
    })

    it("repay when borrower doesn't have enough USDi to do so", async () => {
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
        AccountLiability = await s.VaultController.vaultLiability(vaultID)

        await s.USDI.connect(s.Dave).transfer(s.Carol.address, AccountLiability.add(utils.parseEther("100")))
        await advanceBlockHeight(1)

        await s.VaultController.connect(s.Carol).repayAllUSDi(vaultID)
        await advanceBlockHeight(1)
        AccountLiability = await s.VaultController.vaultLiability(vaultID)
        assert.equal(AccountLiability.toString(), "0", "There is no liability on Carol's vault anymore")

        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        AccountLiability = await s.VaultController.vaultLiability(vaultID)
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
        AccountLiability = await s.VaultController.vaultLiability(vaultID)
        assert.equal(AccountLiability.toString(), "0", "Carol's vault has no debt")

        //Eric tries to borrow against Carol's vault
        await expect(s.VaultController.connect(s.Eric).borrowUsdi(vaultID, utils.parseEther("500"))).to.be.revertedWith("sender not minter")
        await advanceBlockHeight(1)
    })

    it("makes vault insolvent", async () => {
        const accountBorrowingPower = await s.VaultController.vaultBorrowingPower(vaultID)

        //showBodyCyan("BORROW")
        await nextBlockTime(0)
        await s.VaultController.connect(s.Carol).borrowUsdi(vaultID, accountBorrowingPower)
        await advanceBlockHeight(1)

        await fastForward(OneWeek)
        await s.VaultController.calculateInterest()
        await advanceBlockHeight(1)

        solvency = await s.VaultController.checkVault(vaultID)
        assert.equal(solvency, false, "Carol's vault is not solvent")

        AccountLiability = await s.VaultController.vaultLiability(vaultID)
        borrowPower = await s.VaultController.vaultBorrowingPower(vaultID)
        amountUnderwater = AccountLiability.sub(borrowPower)

        let amountToSolvency = await s.VaultController.amountToSolvency(vaultID)

        assert.equal(amountUnderwater.toString(), amountToSolvency.toString(), "amountToSolvency is correct")
        expect(amountToSolvency).to.be.gt(BN("1e6"))
    })

    it("what happens when someone simply transfers ether to the VaultController? ", async () => {
        let tx = {
            to: s.VaultController.address,
            value: utils.parseEther("1")
        }
        await expect(s.Bob.sendTransaction(tx)).to.be.reverted
        await mineBlock()
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
describe("Checking vaultSummaries", async () => {
    let vaultSummaries: any
    let vaultsMinted: number
    it("Gets the vault summaries", async () => {
        vaultsMinted = await (await s.VaultController.vaultsMinted()).toNumber()

        vaultSummaries = await s.VaultController.vaultSummaries(1, vaultsMinted)

        //the correct number of summaries
        expect(vaultSummaries.length).to.eq(vaultsMinted)
    })

    it("checks data", async () => {
        //summary[0] is correct
        let vaultLiability = await s.VaultController.vaultLiability(vaultSummaries[0].id)
        expect(await toNumber(vaultLiability)).to.eq(await toNumber(vaultSummaries[0].vaultLiability))

        //check summary[1], token[1] and balance[1] should match 
        let tokenBalance = await toNumber(vaultSummaries[1].tokenBalances[1])
        let expectedToken = vaultSummaries[1].tokenAddresses[1]
        expect(expectedToken).to.eq(s.UNI.address)

        let vaultAddress = await s.VaultController.vaultAddress(vaultSummaries[1].id)
        let balance = await s.UNI.balanceOf(vaultAddress)

        expect(tokenBalance).to.eq(await toNumber(balance))
    })
    it("checks for errors", async () => {
        //start > stop
        await expect(s.VaultController.vaultSummaries(5, 3)).to.be.reverted

        //start from 0
        await expect(s.VaultController.vaultSummaries(0, 6)).to.be.reverted

        //include vaults that don't exist yet
        await expect(s.VaultController.vaultSummaries(1, 999)).to.be.reverted
    })
})

