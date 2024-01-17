# Proposal to update oracle for CappedB_stETH_STABLE
## Overview
The oracle for [CappedB_stETH_STABLE](https://etherscan.io/address/0x7d3CD037aE7efA9eBed7432c11c9DFa73519303d) must be updated to account for reduced liquidity in the pool. 

## Parameters

Token Address: [0x32296969Ef14EB0c6d29669C550D4a0449130230](https://etherscan.io/address/0x32296969Ef14EB0c6d29669C550D4a0449130230)
Capped Token address: [0x7d3CD037aE7efA9eBed7432c11c9DFa73519303d](https://etherscan.io/address/0x7d3CD037aE7efA9eBed7432c11c9DFa73519303d)
Depricated Oracle: [0xD6B002316D4e13d2b7eAff3fa5Fc6c20D2CeF4be](https://etherscan.io/token/0xD6B002316D4e13d2b7eAff3fa5Fc6c20D2CeF4be)
Updated Oracle: [0xcEe78cE44e98d16f59C775494Be24E0D2cFF19A4](https://etherscan.io/token/0xcEe78cE44e98d16f59C775494Be24E0D2cFF19A4)


## Detailed Description

While there is still sufficient liquidity in the pool (~600 wsteth / ~700 weth), these numbers are about a third of what was in the pool at the time of the original proposal. 

As liquidity in the pool has declined, the existing oracle is no longer functional, effectively freezing this asset for the time being.  

Before going into why this is the case, let's briefly recap how the BPT oracle functions. 

In short, the oracle simulates a transaction on the pool, and compares the resulting exchange rate to what it ought to be based on external price oracles for the underlying assets. This is because the exchange rate can be easily manipulated, but manipulation can be easily detected if compared to external price oracles. If the two exchange rates do not agree within a tight buffer, then the oracle simply reverts in order to prevent manipulation. More info on the inner workings can be found in the technical writeup below

This simulated swap on the pool should have a sufficiently large input amount in order to account for slippage. 

The existing oracle has a hard coded amount for this input value, which has become too high as liquidity has declined, such that the simulated swap has too great a price impact to be within the expected range. 

This updated oracle solves this problem, with a new dynamic input amount that will always be 1% of the balance of token 0 in the pool, as token 0 is used as the input token in the simulated swap. 

With this new oracle, the exchange rate returned is within 0.5% of the what is expected based on the external oracles. 


## Relevant References
[Technical Writeup](https://docs.google.com/document/d/1u4dju8zORKWp3mEoCcEFgDvt90ro0tu17GOOLH2tHxY/edit)

