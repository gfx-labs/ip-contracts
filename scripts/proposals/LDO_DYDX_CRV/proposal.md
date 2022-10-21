# Proposal To Add BAL & AAVE

## Aave Overview

The AAVE token is the governance token to the [Aave Ecosystem](https://app.aave.com/markets/). AAVE and stkAAVE holders can engage in [protocol governance](https://app.aave.com/governance/) by either delegating voting power to an address of their choosing or directly voting from their address.

The proposed parameters and cap are purposely very conservative. After the initial listing, a subsequent proposal could increase the cap.

[Forum post](https://forums.interestprotocol.io/t/proposal-to-add-aave/67)

### Parameters

Token Address: [0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9](https://etherscan.io/address/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9)
LTV: 70%
Liquidation incentive: 10%
Cap: 230k ($20M)
Oracle Address: [Anchor View Relay](https://etherscan.io/address/0xf5E0e2827F60580304522E2C38177DFeC7a428a4)
Primary oracle: [Chainlink AAVE/USD](https://etherscan.io/address/0x706d1bb99d8ed5B0c02c5e235D8E3f2a406Ad429)
Secondary oracle: [Uniswap AAVE/WETH](https://etherscan.io/address/0xcA9e15Eb362388FFC537280fAe93f35b4A3f230c)
Price Deviation: 25%
[Capped Aave](https://etherscan.io/address/0xd3bd7a8777c042De830965de1C1BCC9784135DD2)

### Liquidity

MCAP: $1.22B
Balancer v1 liquidity: $96.3M
[Coingecko](https://www.coingecko.com/en/coins/aave/historical_data#panel) 7-day avg 24hr volume: $134.6M
Notable exchanges: Coinbase, Binance, Okex, FTX, Huobi, HitBTC

### Volatility Data

The below shows the volatility of AAVE relative to ETH.

![](https://i.imgur.com/F89gQ5l.png)


### Technical risks

1. Type of contract: Governance Token
1. Underlying asset: Governance Token
1. Time: +700 days
1. Value: Control of the Aave Protocol and its various markets
1. [Privileges](https://github.com/aave/aave-token): the owner of the contract is the Aave governance contract.
    * The owner can transfer ownership of the proxy admin contract
    * The owner controls all aspects of the tokens permissions.
    * 24 hour time lock from when the proposal is queued post a successful on-chain vote
1. Upgradability: Yes - from [Level 2 Governance](https://governance.aave.com/t/rfc-aave-governance-adjust-level-2-requirements-long-executor/8693).

## BAL Overview

The BAL token is the governance token of the [Balancer Ecosystem](https://balancer.finance). Users who vote-lock their tokens (BAL + wETH => veBAL) receive a share of trading fees from the platform as well as a boost on their provided liquidity. veBAL holders vote to determine how the BAL inflation schedule is distributed across the various liquidity pools.

The proposed parameters and cap are intentionally very conservative. After the initial listing, a subsequent proposal could increase the cap.

Link to [forum post](https://forums.interestprotocol.io/t/proposal-to-add-bal/73)

### Parameters

Token Address: [0xba100000625a3754423978a60c9317c58a424e3D](https://etherscan.io/token/0xba100000625a3754423978a60c9317c58a424e3D)
LTV: 70%
Liquidation incentive: 10%
Cap: 770k ($3m)
Oracle address: [Anchor View Relay](https://etherscan.io/address/0xf5E0e2827F60580304522E2C38177DFeC7a428a4#code)
Primary oracle: [Chainlink BAL/USD](https://etherscan.io/address/0xe53B24294F74018D974F7e47b7d49B6dF195387F#code)
Secondary oracle: [Uniswap BAL/WETH](https://etherscan.io/address/0x9C3b60A1ad08740fCD842351ff0960C1Ee3FeA52#code)
Price Deviation: 25%
[Capped BAL](https://etherscan.io/address/0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85#code)

### Liquidity

Market capitalization: $248m
Balancer v2 liquidity: $193m
[Coingecko](https://www.coingecko.com/en/coins/balancer/historical_data#panel) 7-day average 24 hour volume: $26.6m
Notable exchanges: Coinbase, Gemini, Binance, FTX, Huobi, HitBTC

### Volatility Data

The below shows the volatility of BAL relative to ETH.

![](https://i.imgur.com/MwchFkI.png)

### Technical Risks

1. Type of contract: Governance Token
1. Underlying asset: Governance Token
1. Time: +800 days
1. Value: Control of the Balancer Protocol and its various deployments
1. Privileges: the owner of the BAL contract is the Balancer `Authorizer` contract.
    * Balancer's access control solution is the `Authorizer` contract, which holds all permissions in the network, and is queried by other contracts when permissioned actions are performed.
    * The `BalancerMinter` is granted permission by the `Authorizer` to mint BAL (via `BalancerTokenAdmin`, which enforces the minting schedule). The minting schedule has pre-defined upper limits.
    * ‘VotingEscrow’ is the veBAL contract, which allows LPs to deposit and lock 80/20 BPT in exchange for veBAL. veBAL holders own the governance rights to the Balancer ecosystem. The BAL token by itself has no influence over the ecosystem. 
1. Upgradability: Yes


GFX Labs proposing on behalf of [Llama's](https://twitter.com/llama) [Matthew Graham](https://twitter.com/Matthew_Graham_)