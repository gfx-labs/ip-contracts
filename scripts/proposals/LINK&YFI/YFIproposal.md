# Proposal to add YFI
Proposal to add YFI as an capped collateral to Interest Protocol.

## Overview
YFI is the governance token of Yearn Finance.

## Parameters

Token Address: [0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e](https://etherscan.io/token/0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e)
Capped Token address: [0xe2C1d2E7aA4008081CAAFc350A040246b9EBB579](https://etherscan.io/token/0xe2C1d2E7aA4008081CAAFc350A040246b9EBB579)
LTV: 70%
Liquidation incentive: 10%
Cap: 353 (~$3,000,000)
Primary Oracle Address: [Chainlink](https://etherscan.io/token/0x0F11ba0A10384CE496D45B1dB0586B6c3AD47050)
Secondary Oracle Address: [Uniswap v3](https://etherscan.io/token/0x5739082F906aCC9967e2B23Ed5A718B49580133a)
Price deviation: 10%

## Liquidity

Market Cap: $311,800,000
Liquidity: $4,500,000 ([Uniswap V3 YFI-WETH](https://etherscan.io/token/0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e?a=0x2e8daf55f212be91d3fa882cceab193a08fddeb2))
Coingecko 7-day avg 24hr volume: $40,400,000
Notable exchanges: Coinbase, Binance, Kraken, Gemini, Balancer, Uniswap

## Technical risks

Type of contract: ERC20
Underlying asset: N/A
Time: Deployed July 17, 2020
Value: Governance token for Yearn Finance
Privileges: 
The contract owner, [Yearn Timelock Goverance](https://etherscan.io/address/0x026D4b8d693f6C446782c2C61ee357Ec561DFB61#code), has the ability to call the below functions. The Yearn Timelock Goverance contract is controlled by a 6/9 [multisig](https://etherscan.io/address/0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52#readProxyContract).
* addMinter
* mint
* removeMinter
* setGovernance
Upgradability: None
Supplemental Information: N/A

## Relevant References
[Audits](https://github.com/yearn/yearn-audits)
[Maker YFI Technical Assessment](https://forum.makerdao.com/t/yfi-erc20-token-smart-contract-technical-assessment/4626https://)
