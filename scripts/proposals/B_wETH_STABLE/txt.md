# Proposal to add Balancer BPTs as collateral on IP

## Overview
This proposal is to begin adding Balancer LP tokens as supported collateral by Interest Protocol. Balancer LP tokens are yield-bearing tokens that accrue yield to the owners from fees and rewards. This proposal is for Balancer LP tokens generally, and [B-stETH-STABLE]("https://app.balancer.fi/#/ethereum/pool/0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080") specifically as a first Balancer LP collateral.

## Parameters

Token Address: [0x32296969Ef14EB0c6d29669C550D4a0449130230](https://etherscan.io/address/0x32296969Ef14EB0c6d29669C550D4a0449130230)
Capped Token address: [0x7d3CD037aE7efA9eBed7432c11c9DFa73519303d](https://etherscan.io/token/0x7d3CD037aE7efA9eBed7432c11c9DFa73519303d)
LTV: 60%
Liquidation incentive: 8%
Cap: 60 (~$100,000)
Primary Oracle Address: [BPTstablePoolOracle](https://etherscan.io/token/0xD6B002316D4e13d2b7eAff3fa5Fc6c20D2CeF4be#code)
Price deviation: 2%

## Liquidity

Market Cap: $100,000,000
Liquidity: Redeemable at any time for underlying tokens of the ([pool](https://app.balancer.fi/#/ethereum/pool/0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080))
24h volume: $410,000
90d volume: $285,250,000
Notable exchanges: Balancer Protocol

## Technical risks

Type of contract: LP token
Underlying asset: wETH/wstETH
Time: 653 Days (Created August 17, 2021)
Value:
Privileges: Balancer Governance
Upgradability: None
Supplemental Information: See full forum post, which includes links to technical writeups and source code

## Relevant References
[Full Forum Post](https://forums.interestprotocol.io/t/proposal-to-add-balancer-bpts-as-collateral/198)
[Technical Writeup](https://docs.google.com/document/d/1u4dju8zORKWp3mEoCcEFgDvt90ro0tu17GOOLH2tHxY/edit)
