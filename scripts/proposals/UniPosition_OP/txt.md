# Proposal to Utilize Uniswap V3 Positions as collateral
This proposal will complete the necessary upgrades in order to allow for Uniswap V3 Positions to be used as collateral  

## Overview

The first pool being listed is the [wETH/USDC pool @ fee: 500](https://info.uniswap.org/#/optimism/pools/0x85149247691df622eaf1a8bd0cafd40bc45154a9)  

In order to fully understand the pricing of Uniswap v3 positions, it is important to first understand the basics of how concentrated liquidity works in Uniswap V3. 
The [Uniswap V3 Development Book](https://uniswapv3book.com/) is a good resource for this.   

This proposal will include a small upgrade to the Vault Controller to allow for effective liquidations to work. Specifically, liquidations where the collateral being liquidated is a Uniswap V3 Position will be total.  
<u>__There are no partial liquidations__</u>.   
As such, any liquidation of a loan where more than one position exists in the vault will transfer all positions to the liquidator. As such, the Vault Controller upgrade is needed to set the liability to 0 after liquidation, rather than compute the new liability. 

More details on the inner workings of this upgrade to be found [below](#detailed-description). 

## Parameters

Pool Address: [0xCBCdF9626bC03E24f779434178A73a0B4bad62eD](https://etherscan.io/token/0xCBCdF9626bC03E24f779434178A73a0B4bad62eD)  
Wrapper address: UniV3CollateralToken [To Be Deployed](https://etherscan.io/token/0x5F39aD3df3eD9Cf383EeEE45218c33dA86479165)  
LTV: 75%  
Liquidation incentive: 7.5%  
Primary Valuation Contract: V3PositionValuator [To Be Deployed](https://etherscan.io/token/0x5F39aD3df3eD9Cf383EeEE45218c33dA86479165)  
Underlying Asset Oracle: token 0: [wBTC](https://etherscan.io/token/0x0f2f7aa507d153aC04431a617840d1fF28A960AC)  
Underlying Asset Oracle: token 1: [wETH](https://etherscan.io/token/0x8eD31D7FF5D2ffBF17Fe3118A61123F50AdB523A)  

## Liquidity

POOL: [wETH/USDC fee: 500](https://info.uniswap.org/#/optimism/pools/0x85149247691df622eaf1a8bd0cafd40bc45154a9)  
TVL: $227,630,000  
Liquidity at current price: ~2k wETH & ~125 wBTC for ~$7,500,000  
Volatility: Similar to wETH & wBTC  
24hr volume (pool): $205,000  

## Technical risks

Type of contract: ERC-721 [NonfungiblePositionManager](https://etherscan.io/address/0xC36442b4a4522E871399CD717aBDD847Ab11FE88#code)  
Underlying asset: wBTC/wETH  
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


## Detailed Description

Pricing for the positions is determined by a single valuator contract, V3PositionManager. The Position Valuator is an upgradeable proxy which will be owned by Interest Protocol governance. This contract independently calculates the current sqrt price (using external oracles for the two underlying tokens), and then calculates the amounts for the underlying tokens of the position, were they to be withdrawn immediately. Based on these token amounts, we can determine the value of the position

In short, a position is represented by a single non-fungible token ([NFT](https://eips.ethereum.org/EIPS/eip-721)), which contains data describing the position. From this data,  the upper and lower bounds of the position (tickUpper/tickLower) as well as the liquidity are used to determine the price. 

Additionally, the token0, token1, and fee from the position are used to calculate the pool address, which is needed in order to confirm registration of the pool, as well as to determine the correct external oracles to use to price the underlying asset of the pool. The Position Valuator keeps track of which pools are registered for use on Interest Protocol.

Positions are deposited into the new Univ3CollateralToken contract, which wraps the position into a modified ERC-20 type token. Univ3CollateralToken is a new upgradeable proxy contract owned by Interest Protocol governance, and effectively wraps the Uniswap V3 position as an ERC-20 token. 

This token is then transferred to the standard vault (v1), while the actual position is sent to a new vault type, VaultNft (v3). All current and future pools listed as collateral will be using this same contract deployment, so no additional deployments are needed to list more pools, other than any additional external oracles, though most of these external oracles are likely already in use on IP for currently listed assets. 

This wrapper on the surface appears to work generally the same way as any standard ERC-20, but underneath there are a number of custom changes.
 
The key difference lies in the balanceOf function of the Univ3CollateralToken. This function requires that the address passed be a standard vault address, and when called returns the actual value (in USDi terms) of the positions held by the VaultNft(v3) with that vault ID. 

Positions are associated with a minter’s wallet address in an array. Multiple positions are allowed, and are stored in a dynamic array, which can be read by calling depositedPositions(address minter). 

<u>__Partial liquidations are not allowed, in the case of liquidation, the liquidator will receive all positions held by the vault.__ </u>  

Additionally, if a vault contains any standard or capped assets in addition to any Uniswap V3 Positions, those assets must be completely liquidated __before__ liquidation of the Uniswap position can occur. 


Partial withdrawals are allowed. For the “amount” argument, pass the index of the position to withdraw with respect to where it is stored in the dynamic array. Mutation of the list is handled such that if a middle index is withdrawn, its index in the array will be replaced with the final index, and the new array’s length will be reduced by 1. 

If the “amount” argument is greater than the number of positions held by the vault, then all positions will be withdrawn. Liquidations are hard coded to pass the max possible uint256 for the “amount”. 

VaultNft minters can collect fees generated by their positions at any time, these fees are not included in the value of the position. 

The current implementation does not allow for a cap, so pools should be listed conservatively. Because the price is treated as equivalent to the balance in our wrapper, the total supply is effectively dynamic and moves with the price. Therefore, it is not feasible to cap the total supply of the wrapper as is done with other capped assets. 
As such, there is no mint event when depositing to the wrapper contract, and totalSupply is never changed, and so is always 0. 
