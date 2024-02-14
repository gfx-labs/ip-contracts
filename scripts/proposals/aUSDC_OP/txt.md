# Proposal To List aUSDC As Collateral On The Optimism Deployment Of Interest Protocol

[aOptUSDC](https://optimistic.etherscan.io/address/0x625e7708f30ca75bfd92586e17077590c60eb4cd) is a positively rebasing collateral token received for lending USDC to the Aave Protocol. 

<b>This is specifically for the Optimism deployment of Interest Protocol only.</b>

## Parameters
Underlying: [aOptUSDC](https://optimistic.etherscan.io/address/0x625e7708f30ca75bfd92586e17077590c60eb4cd)
Wrapper address: [NEW IMPLEMENTATION TO BE DEPLOYED](https://gfx.cafe/ip/contracts/-/blob/master/contracts/lending/wrapper/CappedRebaseToken.sol?ref_type=heads)
LTV: 98%  
Liquidation incentive: 5%  
Primary Oracle: TO BE DEPLOYED - Simple oracle assumes value is 1, as USDI is backed by and pegged to USDC

## Technical risks
Type of contract: AToken [NonfungiblePositionManager](https://optimistic.etherscan.io/address/0xc36442b4a4522e871399cd717abdd847ab11fe88)  
Time: Deployed Mar-11-2022 01:49:48 PM +UTC
Value: USDC
Privileges: Controlled by Aave Protocol / Governance  
Upgradability: Yes  

## Relevant References
[Aave Docs](https://docs.aave.com/hub/)  

## Implementation
[Capped Rebase Token](https://gfx.cafe/ip/contracts/-/blob/master/contracts/lending/wrapper/CappedRebaseToken.sol?ref_type=heads)

For this type of collateral to be supported and capped, an updated version of the Interest Protocol capped asset contract is needed.  

Specific to this implementation, there is no need for the Voting Vault Controller, or any other special Vault Controller other than the standard Vault Controller.  

This is possible because unlike Capped Governance tokens, there is no need for the owners to execute transactions (such as delegate) on their holdings while in the vault, so all rebase tokens will be held by the wrapper contract upon being wrapped.

This wrapper contract logic has been upgraded from the original [WAMPL](https://etherscan.io/token/0xedb171c18ce90b633db442f2a6f72874093b49ef#code) implementation specifically for this application, allowing for all accounting to be done in the base underlying units, rather than the wrapper balance. This is critical as the wrapper balance is not intuitively correlated with the underlying balance.  

With this change, the protocl can simply account in the underlying without having to convert from the wrapper balance to the underlying, and we can avoid an upgrade to the vault controller.  
