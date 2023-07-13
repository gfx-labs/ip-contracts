# Proposal to add MKR 
Proposal to add MKR as a capped collateral to Interest Protocol.

## Overview
The MKR token governs the Maker Protocol, which is one of the oldest and most battle-tested protocols in DeFi. The Maker Protocol issues the DAI stablecoin, and is one of the only protocols to not suffer technical exploits (there was a design exploit that resulted in some 0-bid liquidation auctions in 2020 that has since been fixed).

This collateral integration will support MKR holders’ ability to delegate MKR to a delegate contract of their choice, which is not available at any other venue.

Interest Protocol already supports CHAI, which is a DappHub token wrapper for DAI Savings Rate Module deposits.

## Parameters

Token Address: [0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2](https://etherscan.io/token/0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2)  
Capped Token address: [0x2c52EE10BD58Efa20FC6ee418BF9085639E8247E](https://etherscan.io/token/0x2c52EE10BD58Efa20FC6ee418BF9085639E8247E)  
LTV: 70%  
Liquidation incentive: 10%  
Cap: 110,000 (~$1,000,000)  
Primary Oracle Address: [Chainlink](https://etherscan.io/token/0xec1d1b3b0443256cc3860e24a46f108e699484aa)  
Secondary Oracle Address: [Uniswap v3](https://etherscan.io/token/0x24551a8fb2a7211a25a17b1481f043a8a8adc7f2)  
Price deviation: 10%  

## Liquidity

Market Cap: $826,301,000 (circulating)  
Liquidity: $17,500,000 (two combined Uniswap V3 pools)  
[Coingecko](https://www.coingecko.com/en/coins/maker) 7-day avg 24hr volume: $64,000,000  
Notable exchanges: Coinbase, Binance, Kraken, OKX, Uniswap, etc  

## Technical risks

Type of contract: ERC20
Underlying asset: Governance Token
Time: November 25, 2017 (~2055 days ago)
Privileges: Can be minted by governance or excessive bad debt
Upgradability: None

## Relevant References

[Original Forum Post](https://forums.interestprotocol.io/t/proposal-to-add-mkr/214)