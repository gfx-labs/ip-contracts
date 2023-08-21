# Proposal to add RPL; Housekeeping

Proposal to add RPL as a capped collateral to Interest Protocol and adjust paramaters on MKR collateral.

## Overview

RPL is an ERC20 token issued by Rocket Pool. It acts as the governance token of the protocol, as well as collateral that must be staked by node operators. Rocket Pool is notable for its dual DAO model, with both a Protocol DAO and an Oracle DAO.

This proposal also includes some housekeeping to fix an incorrect maximum cap on MKR collateral.

## Parameters

Token Address: 0xD33526068D116cE69F19A9ee46F0bd304F21A51f
Capped Token address:
LTV: 60%
Liquidation incentive: 10%
Maximum Cap: 21,000 RPL (~$1,000,000 market value at time of writing)
Oracle Address: 
Primary oracle: Chainlink feed TBD
Secondary oracle:
Price deviation: 20%

## Liquidity

Market Cap: $917,000,000
Liquidity: $13,200,000 (Uniswap V3 0xe42318eA3b998e8355a3Da364EB9D48eC725Eb45)
[Coingecko](https://www.coingecko.com/en/coins/ethereum-name-service) 7-day avg 24hr volume: $348,000
Notable exchanges: Uniswap, Binance, Coinbase

## Technical risks

1. Type of contract: ERC20
2. Underlying asset: Governance Token
3. Time: 614 Days Ago (Sept 30, 2021)
4. Value:
5. Privileges:
6. Upgradability: Yes

## Supplemental Information

RPL has an annual inflation schedule of 5%. There is also an older version of the RPL token that predates 2021 that can be migrated 1:1 for the V2 RPL token.

## Relevant References
[Rocket Pool Guides For Staking & Node Operation](https://docs.rocketpool.net/guides/)
[Rocket Pool Tokenomics](https://medium.com/rocket-pool/rocket-pool-staking-protocol-part-3-3029afb57d4c)
[DeFi Llama Token Liquidity](https://defillama.com/liquidity)
[Matcha](https://matcha.xyz/tokens/ethereum/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48)