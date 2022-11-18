# Proposal to add DYDX, CRV, & LDO

## DYDX
### Overview
The DYDX token is the governance token to the [dYdX Exchange](https://dydx.exchange/). The DYDX token's governance system is compatible with Interest Protocol's governance system. Users that post DYDX as collateral can maintain their voting power by delegating the voting power to another address. 

The proposed parameters and cap are purposely very conservative. After the initial listing, a subsequent proposal could increase the cap.
### Parameters
Token Address: [0x92d6c1e31e14520e676a687f0a93788b716beff5](https://etherscan.io/address/0x92d6c1e31e14520e676a687f0a93788b716beff5)
LTV: 70%
Liquidation incentive: 10%
Cap: 3.3m (~$5m)
Oracle Address: [To be deployed]
Primary oracle: [Chainlink DYDX/USD](https://etherscan.io/address/0x478909D4D798f3a1F11fFB25E4920C959B4aDe0b#readContract)
Secondary oracle: [Uniswap v3 DYDX/ETH](https://info.uniswap.org/home#/pools/0xe0cfa17aa9b8f930fd936633c0252d5cb745c2c3)
Price deviation: 20%


### Liquidity 
MCAP: $200m
Uniswap v3 liquidity: $800k
[Coingecko](https://www.coingecko.com/en/coins/dydx) 7-day avg 24hr volume: $69m
Notable exchanges: Binance, Okex, FTX


### Technical risks
1. Type of contract: governance token
2. Underlying asset: governance token
3. Time: 460 days
4. Value: control of the dYdX protocol
5. Privileges: 
    - The owner (the executor which is controlled by the governor) can mint additional DYDX tokens, but not for four years.
    - The owner can transfer ownership of the contract to another address.
    - The owner can renounce ownership of the contract, at which point no changes can be made. 
6. Upgradability: None

### Volatility Data
The below shows the volatility of DYDX relative to ETH
![](https://hackmd.io/_uploads/rJktFUDmo.png)

## CRV
### Overview
The CRV token is the governance token to the [Curve protocol](https://curve.fi/).

The proposed parameters and cap are purposely very conservative. After the initial listing, a subsequent proposal could increase the cap.
### Parameters
Token Address: [0xd533a949740bb3306d119cc777fa900ba034cd52](https://etherscan.io/address/0xd533a949740bb3306d119cc777fa900ba034cd52)
LTV: 70%
Liquidation incentive: 10%
Cap: 6m (~$5m)
Oracle Address: [To be deployed]
Primary oracle: [Chainlink CRV/USD](https://etherscan.io/address/0xcd627aa160a6fa45eb793d19ef54f5062f20f33f#readContract)
Secondary oracle: [Uniswap v3 ETH/CRV](https://info.uniswap.org/home#/pools/0x4c83a7f819a5c37d64b4c5a2f8238ea082fa1f4e)
Price deviation: 20%


### Liquidity 
MCAP: $315m
Uniswap v3 liquidity: $4m
[Coingecko](https://www.coingecko.com/en/coins/curve-dao-token) 7-day avg 24hr volume: $41m
Notable exchanges: Binance, Coinbase, Okex, FTX


### Technical risks
1. Type of contract: governance token
2. Underlying asset: governance token
3. Time: +2 years
4. Value: control of the CRV protocol
5. Privileges: 
    - The admin can change the name & symbol of the token.
    - The minter can mint more CRV up to the available supply. The miner is controller through the gauge controller.
6. Upgradability: None

### Volatility Data
The below shows the volatility of CRV relative to ETH
![](https://hackmd.io/_uploads/SyuMwLP7o.png)

## LDO
### Overview
The LDO token is the governance token for [Lido Finance](https://lido.fi/) and their popular stETH product which is already supported by Interest Protocol. 

The proposed parameters and cap are purposely very conservative. After the initial listing, a subsequent proposal could increase the cap.
### Parameters
Token Address: [0x5a98fcbea516cf06857215779fd812ca3bef1b32](https://etherscan.io/address/0x5a98fcbea516cf06857215779fd812ca3bef1b32)
LTV: 70%
Liquidation incentive: 10%
Cap: 4m (~$5m)
Oracle Address: [To be deployed]
Primary oracle: [Chainlink LDO/ETH](https://etherscan.io/address/0x4e844125952d32acdf339be976c98e22f6f318db)
Secondary oracle: [Uniswap v3 LDO/ETH](https://info.uniswap.org/home#/pools/0xf4ad61db72f114be877e87d62dc5e7bd52df4d9b)
Price deviation: 20%


### Liquidity 
MCAP: $878m
Uniswap v3 liquidity: $8m
[Coingecko](https://www.coingecko.com/en/coins/lido-dao) 7-day avg 24hr volume: $14m
Notable exchanges: Binance, Okex, Uniswap, FTX


### Technical risks
1. Type of contract: governance token
2. Underlying asset: governance token
3. Time: 667 days
4. Value: control of the Lido Finance and their Staked ETH product
5. Privileges: 
    - The controller (Lido Aragon Token Manager) can mint & destroy LDO tokens
    - The enable/disable transfer of LDO tokens
6. Upgradability: None

### Volatility Data
The below shows the volatility of LDO relative to ETH
![](https://hackmd.io/_uploads/Byv6UDDQo.png)