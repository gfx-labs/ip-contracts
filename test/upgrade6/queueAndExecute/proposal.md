# Proposal to add ENS
Proposal to add ENS as a capped collateral to Interest Protocol. 

## Overview
The ENS token is the governance token to the [Ethereum Name Service](https://ens.domains/). ENS holders can engage in [protocol governance](https://ens.domains/governance/) by delegating their voting power to their address or an address of their choosing.

The proposed parameters and cap are purposely very conservative. After the initial listing, a subsequent proposal could increase the cap.

[Forum post](https://forums.interestprotocol.io/t/proposal-to-add-ens/65)

## Parameters
Token Address: [0xc18360217d8f7ab5e7c516566761ea12ce7f9d72](https://etherscan.io/address/0xc18360217d8f7ab5e7c516566761ea12ce7f9d72)
LTV: 70%
Liquidation incentive: 10%
Cap: 400k
Oracle Address: [Anchor View Relay](https://etherscan.io/address/0x6DB54416CBB28C6a78F606947df53E83Dd69eb70)
Primary oracle: [Chainlink Oracle Relay ENS/USD](https://etherscan.io/address/0x195fc62c513e5163e24cf47ad626bc630c3b3a5d#code)
Secondary oracle: [Uniswap v3 Relay ETH/ENS](https://etherscan.io/address/0x81f66181ab16faa6f24fac2593fda31bc19ffffa)
Price Deviation: 25%
[Capped ENS](https://etherscan.io/address/0xfb42f5AFb722d2b01548F77C31AC05bf80e03381)


## Liquidity 
MCAP: $320m
Uniswap v3 liquidity: $3.86m
[Coingecko](https://www.coingecko.com/en/coins/ethereum-name-service) 7-day avg 24hr volume: $45m 
Notable exchanges: Binance, Okex, FTX, Huobi
Total supply: 100m


## Technical risks
1. Type of contract: ERC20 governance token
2. Underlying asset: governance token
3. Time: +300 days - Nov 1, 2021
4. Value: control of the ENS protocol
5. Privileges: the owner of the contract is the ENS Timelock contract (2 days). 
    - The owner can transfer ownership of the contract
    - setMerkleRoot 
    - mint ENS (up to 2M ENS a year)
6. Upgradability: None