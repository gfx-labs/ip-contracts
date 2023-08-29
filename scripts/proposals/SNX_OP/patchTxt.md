# Proposal to complete listing for SNX on the Optimism Deployment of Interest Protocol

## Overview
The Optimism deployment of Interest Protocol has been completed and is ready for action!  

[See the announcement here!](https://forums.interestprotocol.io/t/interest-protocol-optimism/217)  

The first cross-chain proposal has been [executed](https://etherscan.io/tx/0x0af80f88331b2da461560e880d0f62481b309c1eb5cf154cb9fb9910bc306461)! 

Cross-chain proposals present some unique challenges as compared to standard mainnet proposals. In particular, it is impossible to completely test the execution of the proposal beforehand. 

While this was an excellent learning experience, some aspects of this first proposal did not execute as intended. 

Specifically, the listing of SNX on the Oracle Master failed due to the ownership of this contract not being successfully transferred to the Optimism Cross Chain Account. 

This in turn  resulted in the listing of SNX on the Vault Controller to fail, as the listing on the Oracle Master must occur prior to listing on the Vault Controller. 

However, listing SNX on the VotingVaultController did indeed occur successfully! Likewise, the cap for Capped WBTC has been updated, and this asset is now ready for use on Optimism!

**No security or integrity issues have occurred as a result of this error.**

Currently, it is possible to deposit SNX and receive Capped SNX, however this asset has no LTV or oracle price at the moment. 

Borrowers should note: While it is possible to deposit SNX for Capped SNX, if a vault contains a listed asset in addition and is not solvent, then withdrawal of the SNX will be impossible until solvency is reached. 

A relatively simple fix has been made, and a new proposal will remedy the problem once executed. 

