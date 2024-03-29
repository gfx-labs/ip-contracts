# Proposal To List aUSDC As Un-Capped Collateral On The Optimism Deployment Of Interest Protocol

[aOptUSDC](https://optimistic.etherscan.io/address/0x625e7708f30ca75bfd92586e17077590c60eb4cd) is a positively rebasing collateral token received for lending USDC to the Aave Protocol. 

**This is specifically for the Optimism deployment of Interest Protocol only.**

## Parameters
Underlying: [aOptUSDC](https://optimistic.etherscan.io/address/0x625e7708f30ca75bfd92586e17077590c60eb4cd)
LTV: 94%  
Liquidation incentive: 5%  
Primary Oracle: [UsdcStandardRelay](https://optimistic.etherscan.io/address/0x84be5d42712da1129019B4f43F226295ec47FcF9) - Simple oracle assumes value is 1, as USDI is backed by and pegged to USDC
0x84be5d42712da1129019B4f43F226295ec47FcF9
## Technical risks
Type of contract:  [AToken](https://optimistic.etherscan.io/address/0xbCb167bDCF14a8F791d6f4A6EDd964aed2F8813B)  
Time: Deployed Mar-11-2022 01:49:48 PM +UTC
Value: USDC
Privileges: Controlled by Aave Protocol / Governance  
Upgradability: Yes  

## Housekeeping

Deprecating the previous cap contract for aUSDC to move to an uncapped model. 
Doing so reduces the overall risk associated with rebase tokens such as Aave aTokens, reduces complexity for Interest Protocol, and takes advantage of Interest Protocol's inherent ability to natively support rebase tokens. 

## Relevant References
[Aave Docs](https://docs.aave.com/hub/)  

