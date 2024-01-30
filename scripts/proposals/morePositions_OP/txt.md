# Proposal To List Several More Uniswap V3 Pools To Be Used As Collateral On The Optimism Deployment Of Interest Protocol
This proposal will complete the necessary transactions to list Uniswap V3 positions from 7 new pools.

<b>This is specifically for the Optimism deployment of Interest Protocol only.</b>

## Parameters

Wrapper address: [UniV3CollateralToken](https://optimistic.etherscan.io/address/0x7131FF92a3604966d7D96CCc9d596F7e9435195c)  
LTV: 65%  
Liquidation incentive: 7.5%  
Primary Valuation Contract: [V3PositionValuator](https://optimistic.etherscan.io/address/0x5c69C9551E2fE670eDC82EC0288843c1956eE644)  

### Pools and oracles

Each time a pool is listed, reliable oracles for the two underlying tokens must be included for accurate pricing of positions. 

| POOL | Token 0 | Token 1 | Fee | Oracle 0 | Oracle 1| Liquidity
| -------- | -------- | ------- | ------- | ------- | ------- | ------- |
| [WETH/OP](https://optimistic.etherscan.io/address/0x68f5c0a2de713a54991e01858fd27a3832401849) | WETH | OP  | 3000 | [WETH ORACLE](https://optimistic.etherscan.io/address/0xcB88cf29121E5380c818A7dd4E8C21d964369dF3) | [OP ORACLE](https://optimistic.etherscan.io/address/0x8C8AE22fea16C43743C846902eC7E34204894189) | [TVL: 9.93M](https://oku.trade/info/optimism/pool/0x68f5c0a2de713a54991e01858fd27a3832401849) |
| [WSTETH/WETH](https://optimistic.etherscan.io/address/0x04F6C85A1B00F6D9B75f91FD23835974Cc07E65c) | wstETH | WETH | 100 | [WSTETH ORACLE](https://optimistic.etherscan.io/address/0xB765006321C6Be998f0ef62802d2548E76870D3B) | [WETH ORACLE](https://optimistic.etherscan.io/address/0xcB88cf29121E5380c818A7dd4E8C21d964369dF3) | [TVL: 2.64M](https://oku.trade/info/optimism/pool/0x04f6c85a1b00f6d9b75f91fd23835974cc07e65c) |
| [USDC/WETH](https://optimistic.etherscan.io/address/0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b) | USDC | WETH | 500 | [USDC ORACLE](https://optimistic.etherscan.io/address/0xcEe78cE44e98d16f59C775494Be24E0D2cFF19A4) | [WETH ORACLE](https://optimistic.etherscan.io/address/0xcB88cf29121E5380c818A7dd4E8C21d964369dF3) | [TVL: 1.12M](https://oku.trade/info/optimism/pool/0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b) |
| [WETH/OP](https://optimistic.etherscan.io/address/0xFC1f3296458F9b2a27a0B91dd7681C4020E09D05) | WETH | OP | 500 | [WETH ORACLE](https://optimistic.etherscan.io/address/0xcB88cf29121E5380c818A7dd4E8C21d964369dF3) | [OP ORACLE](https://optimistic.etherscan.io/address/0x8C8AE22fea16C43743C846902eC7E34204894189) | [TVL: 0.795M](https://oku.trade/info/optimism/pool/0xFC1f3296458F9b2a27a0B91dd7681C4020E09D05) |
| [WETH/SNX](https://optimistic.etherscan.io/address/0x0392b358CE4547601BEFa962680BedE836606ae2) | WETH | SNX | 3000 | [WETH ORACLE](https://optimistic.etherscan.io/address/0xcB88cf29121E5380c818A7dd4E8C21d964369dF3) | [SNX ORACLE](https://optimistic.etherscan.io/address/0xd8284305b520FF5486ab718DBdfe46f18454aeDE) | [TVL: 3.09M](https://oku.trade/info/optimism/pool/0x0392b358CE4547601BEFa962680BedE836606ae2) |
| [WETH/WBTC](https://optimistic.etherscan.io/address/0x85C31FFA3706d1cce9d525a00f1C7D4A2911754c) | WETH | WBTC | 500 | [WETH ORACLE](https://optimistic.etherscan.io/address/0xcB88cf29121E5380c818A7dd4E8C21d964369dF3) | [WBTC ORACLE](https://optimistic.etherscan.io/address/0xDDB3BCFe0304C970E263bf1366db8ed4DE0e357a) | [TVL: 3.18M](https://oku.trade/info/optimism/pool/0x85C31FFA3706d1cce9d525a00f1C7D4A2911754c) |
| [WETH/USDC](https://optimistic.etherscan.io/address/0xB589969D38CE76D3d7AA319De7133bC9755fD840) | WETH | USDC | 3000 | [WETH ORACLE](https://optimistic.etherscan.io/address/0xcB88cf29121E5380c818A7dd4E8C21d964369dF3) | [USDC ORACLE](https://optimistic.etherscan.io/address/0xcEe78cE44e98d16f59C775494Be24E0D2cFF19A4) | [TVL: 3.47M](https://oku.trade/info/optimism/pool/0xB589969D38CE76D3d7AA319De7133bC9755fD840) |


## Technical risks

Type of contract: ERC-721 [NonfungiblePositionManager](https://optimistic.etherscan.io/address/0xc36442b4a4522e871399cd717abdd847ab11fe88)  
Time: Deployed May 4, 2021  
Value: Uniswap V3 Position  
Privileges: None  
Upgradability: No  

## Relevant References
[Uniswap V3 Development Book](https://uniswapv3book.com/)  
[MKR DAO GUniLPOracle](https://github.com/makerdao/univ3-lp-oracle/blob/master/src/GUniLPOracle.sol#L248)

### Implementations
[VaultNft](https://gfx.cafe/ip/contracts/-/blob/master/contracts/lending/vault/VaultNft.sol)  
[NftVaultController](https://gfx.cafe/ip/contracts/-/blob/master/contracts/lending/controller/NftVaultController.sol)  
[V3PositionValuator](https://gfx.cafe/ip/contracts/-/blob/master/contracts/oracle/External/V3PositionValuator.sol)  
[Univ3CollateralToken](https://gfx.cafe/ip/contracts/-/blob/master/contracts/lending/wrapper/Univ3CollateralToken.sol)  
