# Proposal Template to add a new Capped TOKEN 
Proposal to add TOKEN as an capped collateral to Interest Protocol.
In this example, LINK is the token being listed

## Overview
This proposal is to begin adding Balancer LP tokens as supported collateral by Interest Protocol. Balancer LP tokens are yield-bearing tokens that accrue yield to the owners from fees and rewards. This proposal is for Balancer LP tokens generally, and [B-stETH-STABLE]("https://app.balancer.fi/#/ethereum/pool/0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080") specifically as a first Balancer LP collateral.

## Parameters

Token Address: [0x32296969Ef14EB0c6d29669C550D4a0449130230](https://etherscan.io/address/0x32296969Ef14EB0c6d29669C550D4a0449130230)
Capped Token address: [0x5F39aD3df3eD9Cf383EeEE45218c33dA86479165](https://etherscan.io/token/0x5F39aD3df3eD9Cf383EeEE45218c33dA86479165)
LTV: 75%
Liquidation incentive: 7.5%
Cap: 375,000 (~$3,000,000)
Primary Oracle Address: [Chainlink](https://etherscan.io/token/0x52F3140074cdF69C8f7151728B1ecc19af39Beea)
Secondary Oracle Address: [Uniswap v3](https://etherscan.io/token/0xD79ef1A8632C78FAB8331f7aE74ff93E60E2cdC2)
Price deviation: 10%

## Liquidity

Market Cap: $4,131,119,368
Liquidity: $13,000,000 ([Uniswap V3 TOKEN-ETH](https://etherscan.io/token/0x514910771af9ca656af840dff83e8264ecf986ca?a=0xa6cc3c2531fdaa6ae1a3ca84c2855806728693e8))
Volatility: 
Coingecko 7-day avg 24hr volume: $361,000,000
Notable exchanges: Coinbase, Binance, Kraken, Gemini, OKEx, Uniswap

## Technical risks

Type of contract: ERC20
Underlying asset: N/A
Time: Deployed September 16, 2017
Value: Utility token for the ChainTOKEN Network
Privileges: None
Upgradability: None
Supplemental Information: N/A

## Relevant References
[Maker Technical Risk Assessment from July 2020](https://forum.makerdao.com/t/LINK-erc20-token-smart-contract-technical-assessment/3467)
