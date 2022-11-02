# Update the interest rate curve
Given the low prevailing interest rates across DeFi, Interest Protocol would benefit from a more aggressive interest rate curve that allows more lending to occur at lower interest rates.

The proposed curve parameters are shown in the following table.

| Variable | Current Value | New Value |
| -------- | -------- | -------- |
| s1     | 35%     | 25%     |
| s2     | 65%     | 50%     |
| r0     | 300%     | 200%     |
| r1     | 20%     | 10%     |
| r2     | 0.50%     | 0.50%     |


[Desmos graph](https://www.desmos.com/calculator/cxcbx7axcp)

## Our rationale for these changes are as follows.
### Comparison to Proposal 8

Proposal 8, executed on September 9th through an optimistic proposal, decreased s2 from 40% to 35%. The goal of this change was to increase capital efficiency at relatively high interest rates. However, the interest rate on IP has remained low since the execution of Proposal 8. Moreover, Proposal 8 raised s1 (from 60% to 65%). As a result, IP often has a high reserve ratio above 60%, and thus a wide spread between the borrow rate and the deposit rate. This proposal aims to remedy this by lowering the reserve ratio that corresponds to low rates (1-5%).

### Lower s1 and s2
The reserve ratios corresponding to the two kinks will decrease, from 65% and 35% to 50% and 25%. This will allow IP to generate more loans at a given rate, increasing capital efficiency and reducing the borrow-deposit spread.

### Lower r2
r2, the interest rate corresponding to the reserve ratio s2, will decrease from 20% to 10%. This further increases capital efficiency at lower rates.

### Comparison to Compound
The Desmos graph compares the proposed curve to what Compound V2’s interest rate curve for USDC would be if it was directly translated to IP. While the proposed curve is more aggressive than Compound’s at lower borrow rates (below 3.17%), it is significantly more conservative at higher borrow rates (above 3.17%) and therefore continues to provide a strong guarantee of liquidity for USDi redemptions.