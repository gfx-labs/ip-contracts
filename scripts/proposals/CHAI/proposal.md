# Proposal to add ZRX & update UNI LTV

## Proposal to add ZRX - Mintcloud
Proposal to add ZRX as a capped collateral to Interest Protocol.

### Overview
The ZRX token is the governance token of the [0x Protocol](https://www.0x.org/). It was one of the first [DEX governance tokens ever deployed (2017)]([https:/](https://blog.0xproject.com/announcing-the-0x-token-zrx-launch-d4c097d893c7?gi=4de9922b4b5b)/).

The proposed parameters and cap are set conservatively given relative low DEX liquidity. To be revisited if liquidity increases.

### Parameters
Token Address: [0xe41d2489571d322189246dafa5ebde1f4699f498](https://etherscan.io/token/0xe41d2489571d322189246dafa5ebde1f4699f498)
LTV: 50%
Liquidation incentive: 15%
Cap: 1m (~$250k)
Oracle Address: [Anchor View](https://etherscan.io/address/0xEF12fa3183362506A2dd0ff1CF06b2f4156e751E#code)
Primary oracle: [Chainlink ZRX/ETH](https://data.chain.link/ethereum/mainnet/crypto-eth/zrx-eth)
Secondary oracle: [Uniswap v3 ETH/ZRX](https://etherscan.io/address/0x14424eeecbff345b38187d0b8b749e56faa68539)
Price deviation: 20%

### Liquidity
MCAP: $190m
Uniswap v3 liquidity: $600k
[Coingecko](https://www.coingecko.com/en/coins/0x) 7-day avg 24hr volume: $22m
Notable exchanges: Coinbase, Binance, OKX

### Technical risks
1. Type of contract: governance token
1. Underlying asset: governance token
1. Time: +4 years
1. Value: control of the 0x protocol and [0x Treasury](https://www.0x.org/zrx/treasury)
1. Privileges: None
1. Upgradability: None

## Proposal to increase LTV for UNI - Nekosan
Proposal to increase the LTV for UNI to 70%

### Overview
The UNI token is the governance token to the Uniswap Protocol. UNI holders can engage in protocol governance by delegating their voting power to their address or an address of their choosing.

The LTV was initially set conservatively to 55% because UNI is an uncapped collateral. The increase to 70% will bring it in alignment with other collateral on Interest Protocol of similar risk profile.

We have not seen a ton of demand for UNI as a collateral but hopefully this increase in LTV will make IP a more competitive venue to originate loans from.

### Parameters
Token Address: [0x1f9840a85d5af5bf1d1762f925bdaddc4201f984](https://etherscan.io/address/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984)

## Note: 
To upgrade UNI's LTV, we're also including a minor code change to the `updateRegisteredErc20()` to address the bug identified by Sigma Prime in the most recent audit.