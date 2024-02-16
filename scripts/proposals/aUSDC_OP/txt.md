# Proposal To List aUSDC As Collateral On The Optimism Deployment Of Interest Protocol

[aOptUSDC](https://optimistic.etherscan.io/address/0x625e7708f30ca75bfd92586e17077590c60eb4cd) is a positively rebasing collateral token received for lending USDC to the Aave Protocol. 

<b>This is specifically for the Optimism deployment of Interest Protocol only.</b>

## Parameters
Underlying: [aOptUSDC](https://optimistic.etherscan.io/address/0x625e7708f30ca75bfd92586e17077590c60eb4cd)
Wrapper address: [NEW IMPLEMENTATION TO BE DEPLOYED](https://gfx.cafe/ip/contracts/-/blob/master/contracts/lending/wrapper/CappedRebaseToken.sol?ref_type=heads)
Cap: $200,000 USD
LTV: 98%  
Liquidation incentive: 5%  
Primary Oracle: TO BE DEPLOYED - Simple oracle assumes value is 1, as USDI is backed by and pegged to USDC

## Technical risks
Type of contract:  [AToken](https://optimistic.etherscan.io/address/0xbCb167bDCF14a8F791d6f4A6EDd964aed2F8813B)  
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

As such, sers will **not** need to mint any special vaults, and will be able to deposit aUSDC directly. The process of wrapping the underlying rebase token is abstracted away from the end user. 

Behind the scenes, the underlying rebase token is wrapped for the [Capped Rebase](https://gfx.cafe/ip/contracts/-/blob/master/contracts/lending/wrapper/CappedRebaseToken.sol?ref_type=heads) wrapper token, which is sent to the user's standard vault. The balance of these wrapper tokens in the vault will remain fixed, while still accurately tracking the growing number of underlying rebase tokens owed to the user. When the user returns to withdraw their underlying rebase tokens (or is liquidated), the wrapper tokens will automatically be unwrapped with the expected balance of underlying rebase tokens with interest applied. 

This wrapper contract logic has been upgraded from the original [WAMPL](https://etherscan.io/token/0xedb171c18ce90b633db442f2a6f72874093b49ef#code) implementation specifically for this application, allowing for all accounting to be done in the base underlying units, rather than the wrapper balance. This is critical as the wrapper balance is not intuitively correlated with the underlying balance.  

With this change, the protocol can simply account in the underlying without having to convert from the wrapper balance to the underlying, and we can avoid an upgrade to the vault controller.  

[Extensive testing](https://gfx.cafe/ip/contracts/-/tree/master/test/cap/cappedRebase?ref_type=heads) has been done to ensure that this implementation works as intended, and that accounting can be safely done in the underlying rebase token's units with regard to token decimals, deposit, withdrawal, and liquidations. 