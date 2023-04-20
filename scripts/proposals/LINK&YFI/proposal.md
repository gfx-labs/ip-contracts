# Proposal to add CHAI
Proposal to add CHAI as an capped collateral to Interest Protocol.

## Overview

CHAI is an ERC20 token developed by Dapphub that provides a tokenized representation of DAI that has been deposited into the DAI Savings Rate (DSR) module of the Maker Protocol. It accrues interest at the rate set by Maker governance for the DSR. At time of writing, that is 1%. CHAI is freely transferrable and redeemable, and is immutable with no special permissions.

Because CHAI is interest-bearing DAI redeemable with Maker, there is no risk of it becoming illiquid for its underlying (Maker issues new DAI when redeeming from the DSR). Additionally, Maker's Peg Stability Modules (PSMs) contain billions of dollar-redeemable stablecoins that DAI can be converted to and from with zero slippage.

Currently, DAI deposited in the DSR yields 1% per annum. This rate is manually adjusted by Maker governance. The stable value of CHAI in relation to DAI (and USDC, USDP, and GUSD) makes it a highly secure asset that is also yield bearing. In times that Interest Protocol charges less than CHAI yields, it allows for users to safely arbitrage the rates, resulting in higher DAI, CHAI, and USDi usage.

## Parameters

Token Address: [0x06AF07097C9Eeb7fD685c692751D5C66dB49c215](https://etherscan.io/address/0x06AF07097C9Eeb7fD685c692751D5C66dB49c215#code)
Capped Token address: [0xDdAD1d1127A7042F43CFC209b954cFc37F203897](https://etherscan.io/address/0xDdAD1d1127A7042F43CFC209b954cFc37F203897#code)
LTV: 98%
Liquidation incentive: 0.75%
Cap: 1,000,000
Oracle Address: [Chi Oracle](https://etherscan.io/address/0x9Aa2Ccb26686dd7698778599cD0f4425a5231e18#code)
Price deviation: N/A

## Liquidity

Market Cap: $312,076
Liquidity: Equivalent to Maker PSMs; ~2 billion at time of writing
Volatility: Stablecoin
Coingecko 7-day avg 24hr volume: N/A
Notable exchanges: N/A

## Technical risks

Type of contract: ERC20 wrapper
Underlying asset: DAI
Time: >3 Years (Created November 29, 2019)
Value:
Privileges: None
Upgradability: None
Supplemental Information: An edge case could result in users not receiving the full interest accrued. The DSR contract (Pot) requires someone to call `drip` to update the contract's internal accounting. This function is not bundled with `exit` function, which means a user withdrawing from the DSR (with or without CHAI) would forgo any accrued interest since the last time `drip` was called.

## Relevant References
[Two-day audit by Trail of Bits](https://chai.money/Trail_Of_Bits-Letter_of_Attestation_Chai.pdf)
[Github documentation for CHAI](https://github.com/dapphub/chai)
[A front end for users to mint/burn CHAI](https://chai.money)
[MakerDAO Glossary](https://docs.makerdao.com/other-documentation/system-glossary)
[DAI Savings Rate documentation](https://docs.makerdao.com/smart-contract-modules/rates-module/pot-detailed-documentation)
[Code for IP's Chai Oracle Contract](https://gfx.cafe/ip/contracts/-/blob/master/contracts/oracle/External/CHI_Oracle.sol)