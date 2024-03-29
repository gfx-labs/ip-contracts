# Proposal to list SNX on the Optimism Deployment of Interest Protocol

## Overview
The Optimism deployment of Interest Protocol has been completed and is ready for action!  

[See the announcement here!](https://forums.interestprotocol.io/t/interest-protocol-optimism/217)  

While several tokens have already been listed on this deployment, the final remaining task is to confirm that cross chain governance is working. To this end, this cross chain proposal will list [SNX](https://optimistic.etherscan.io/address/0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4) on the Optimism deployment. 

For simplicity, all current and future assets will be listed with a cap. 

The following have already been listed on the Optimism deployment, with their associated oracle deployments: 

CappedWeth: "0x696607447225f6690883e718fd0Db0Abaf36B6E2"  
EthOracle: "0xcB88cf29121E5380c818A7dd4E8C21d964369dF3"  
  
CappedOp: "0xb549c8cc8011CA0d023A73DAD54d725125b25F31"  
OpOracle: "0x8C8AE22fea16C43743C846902eC7E34204894189"  
  
CappedWstEth: "0xE1442bA08e330967Dab4fd4Fc173835e9730bff6"  
wstEthOracle: "0xB765006321C6Be998f0ef62802d2548E76870D3B" 
   
CappedRETH: "0x399bA3957D0e5F6e62836506e760787FDDFb01c3"  
rEthOracle: "0x99bd1f28a5A7feCbE39a53463a916794Be798FC3"  

### Set Cap for Capped wBTC
wBTC has already been listed as well, however the cap for Capped wBTC needs to be adjusted via proposal, as it currently uses the incorrect units. 

CappedWbtc: "0x5a83002E6d8dF75c79ADe9c209F21C31B0AB14B2"  
wBtcOracle: "0xDDB3BCFe0304C970E263bf1366db8ed4DE0e357a"  
  

## Parameters

Token Address: [0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4](https://optimistic.etherscan.io/address/0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4)  
Capped Token address: [0x45b265c7919D7FD8a0D673D7ACaA8F5A7abb430D](https://optimistic.etherscan.io/address/0x45b265c7919D7FD8a0D673D7ACaA8F5A7abb430D)  
LTV: 60%  
Liquidation incentive: 8%  
Cap: 185,000 (~$500,000)  
Primary Oracle Address: [0xd8284305b520FF5486ab718DBdfe46f18454aeDE](https://optimistic.etherscan.io/address/0xd8284305b520FF5486ab718DBdfe46f18454aeDE)  
Price deviation: 10%  

## Liquidity

Market Cap: $881,541,610  
Liquidity: [~$800k on Uniswap V3](https://info.uniswap.org/#/optimism/pools/0x0392b358ce4547601befa962680bede836606ae2)  
24h volume: $11mm  
Notable exchanges: Uniswap V3, Binance, Coinbase, Gemini  

## Technical risks

Type of contract: LP token  
Time: Optimism Genesis  
Privileges: SNX Governance  
Upgradability: None  

## Relevant References
[SNX website](https://synthetix.io/)

## Technical Cross Chain Governance Details

The following describes the general process for which mainnet IP governance will control the Optimisim deployment. 

[Layer 1 Cross Chain Messenger](https://etherscan.io/address/0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1#code)  
This is the official contract for sending data from Mainnet to Optimism. 

[Cross Chain Account](https://optimistic.etherscan.io/address/0x48fa7528bFD6164DdF09dF0Ed22451cF59c84130)  
This contract receives the data sent from Mainnet, and forwards it to the Interest Protocol contracts. As such, this contract has ownership of all Interest Protocol contracts on Optimism. 

All of the data to make these transactions happen must be carefully nested in the proposal on Mainnet. The script to do this can be found [here](https://gfx.cafe/ip/contracts/-/blob/master/scripts/proposals/SNX_OP/propose.ts)

So for example, if we are to set the new oracle on the [Oracle Master](https://optimistic.etherscan.io/address/0xBdCF0bb40eb8642f907133bDB5Fcc681D81f0651), we need to first package the data to do this, which we can call addOracleData.  

Then we take this data, and use it as the "bytes" argument when we call call to forward(address,bytes) on the [Cross Chain Account](https://optimistic.etherscan.io/address/0x48fa7528bFD6164DdF09dF0Ed22451cF59c84130) on Optimism. This function takes two arguments, first the Oracle Master address on Optimism, and second, our addOracleData (bytes).

We take our addOracleForwardData, and pass it as the _message (bytes) when we call sendMessage(address,bytes,uint32) on the [Layer 1 Cross Chain Messenger](https://etherscan.io/address/0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1#code)

Assuming the Oracle Master on Optimism has its owner set to the [Cross Chain Account](https://optimistic.etherscan.io/address/0x48fa7528bFD6164DdF09dF0Ed22451cF59c84130), this should set the new relay as expected. 
