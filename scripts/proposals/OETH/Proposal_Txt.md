# Proposal to add wOETH
Proposal to add Wrapped Origin Ether (wOETH) as a Capped collateral to Interest Protocol.

## Overview
The [Origin Ether]("https://www.oeth.com/") was launched in May 2023 and is an ERC20 LST aggregator that generates yield while sitting in your wallet. OETH is backed 1:1 by stETH, rETH, frxETH, ETH, and WETH at all times; holders can go in and out of OETH as they please. Yield is paid out daily and automatically (sometimes multiple times per day) though a positive rebase in the form of additional OETH, proportional to the amount of OETH held.

### Wrapped OETH

In order for smart contracts to support OETH directly, they would need to be able to send a transaction to opt-in to OETH yield generation. Additionally, the smart contract would then need to be able to handle the rebasing nature of the token. 

The Capped Token infastructure of Interest Protocol makes this difficult, though probably not impossible. 

However, it is much more simple to instead list the wrapped version (wOETH).

OETH yield is paid out daily and automatically through a positive rebase in the form of additional OETH, proportional to the amount of OETH held. Similar to Frax’s sfrxETH, wOETH is a ERC-4626 vault designed to accrue yield in price rather than in quantity. When you wrap OETH, you get back a fixed number of wOETH tokens. This number will not go up - you will have the same number of wOETH tokens tomorrow as you have today. However, the number of OETH tokens that you can unwrap will go up over time, as **wOETH earns yield at the same rate as standard OETH**. The wOETH to OETH exchange rate can be read from the contract, or via the [OETH dapp](https://app.oeth.com/wrap  ). More information on wOETH and the wrapping/unwrapping process can be found within the [OETH docs](https://docs.oeth.com/core-concepts/wrapping).

wOETH contract address: [0xDcEe70654261AF21C44c093C300eD3Bb97b78192](https://etherscan.io/token/0xDcEe70654261AF21C44c093C300eD3Bb97b78192)

Current exchange rate: 1 wOETH = 1.033023 OETH

OETH yield, currently ~10% APY, comes from a combination of:

Curve and Convex AMO strategies
LST validator rewards
A 50bip exit fee is charged to those who choose to exit OETH via the dapp (completely avoidable if using a DEX), this fee goes back to OETH holders
OETH sitting in non-upgradable contracts does not rebase, instead the interest generated from those tokens is provided to those that can rebase
These 4 yield generating functions combined enable OETH to generate higher yields than holding any single LST. As with [OUSD]("https://forums.interestprotocol.io/t/proposal-to-add-ousd/205"), OGV is also the governance token for OETH. The current asset allocation and yield strategies can be seen via the [OETH home page]("https://www.oeth.com/").

## Parameters

Token Address: [0xDcEe70654261AF21C44c093C300eD3Bb97b78192](https://etherscan.io/token/0xDcEe70654261AF21C44c093C300eD3Bb97b78192)
Capped Token address: [0x739D346421a42beb13FD8D560dd2F42250d4Ac88](https://etherscan.io/token/0x739D346421a42beb13FD8D560dd2F42250d4Ac88)
LTV: 50%
Liquidation incentive: 10%
Cap: 575(~$1,000,000)
Primary Oracle Address: [wOETH_ORACLE](https://etherscan.io/token/0x7b518e0C898c0Bcd80e8E5B5E8d7735007012834)

## Liquidity

Market Cap: $22,617,439
Liquidity: $22,617,439
Coingecko 7-day avg 24hr volume: $733,069
Notable exchanges: Uniswap, Curve

## Technical risks

Type of contract: ERC20
Underlying asset: stETH, rETH, frxETH, ETH, and WETH
Time: 53 Days Ago (April 18, 2023)

## Implementation Details

A new capped token contract implementation is needed for to support this and any future ERC-4626 tokens in the future. 

[Capped ERC4626](https://gfx.cafe/ip/contracts/-/blob/master/contracts/lending/wrapper/CappedERC4626.sol?ref_type=heads)

The underlying asset of this cap token contract will be wOETH, **not OETH**

This contract works largely the same as existing Capped Tokens, with the following exceptions: 

Deposits can consist of **either** OETH or wOETH. OETH deposits will be wrapped to wOETH on deposit. 

**Withdrawals and Liquidations will unwrap the wOETH back to OETH**  
**There is no option to withdraw or liquidate to wOETH directly**

As such, deposits of a particular OETH balance will result in a **smaller** balance of Capped wOETH tokens netted to the vault due to the exchange rate, however the USD value should remain the same.  

Likewise, withdrawals of Capped wOETH will result in a **larger** balance of OETH received due to the exchange rate, though the USD value should remain the same. 

## Risk Mitigation

There are five possible risks when using OETH, and Origin is making sure to reduce each risk as much as possible:

Small market cap risk - Given OETH is a relatively new token, some may be worried that OETH is prone to new attack surfaces. While this may be true for other new tokens, OETH was built reusing 95% of the OUSD code, of which 10+ audits have been done since 2020. Not that long ago, [OUSD reached a market cap of $300m](https://defillama.com/protocol/origin-dollar) without breaking, and without diminishing the APY it was capable of generating. Origin continues to work on OUSD, despite the lower market cap.

Counterparty risk - OETH is governed by OGV stakeholders around the world. Everything from yield generation to fee collection and distribution is managed by a set of smart contracts on the Ethereum blockchain. These contracts are upgradeable with a timelock and are controlled by hundreds of governance token holders. While the initial contracts and yield-earning strategies were developed by the Origin team, anyone can shape the future of OETH by creating or voting on proposals, submitting new strategies, or contributing code improvements. We intend for all important decisions to be made through community governance and limited powers to be delegated to trusted contributors who are more actively involved in the day-to-day management of the protocol.

Smart contract risk of the yield strategies - Origin is only using platforms for yield generation that have a proven track record, have been audited, have billions in TVL, maintain a bug bounty program, and provide over-collateralized loans. Over-collateralization in itself, combined with liquidations, provides a reasonable level of security for lenders.

Collateral risk - Origin has chosen 3 of the largest LSTs to ever exist to back OETH, and they have maintained their peg quite well since launch. They have also demonstrated significant growth in circulating supply, so the Origin team is confident that the 3 LSTs will maintain their peg and that OETH will remain stable to ETH. OETH is also using Chainlink oracles for pricing data for rETH and stETH, and plans to utilize Curve’s time-weighted price oracle for frxETH to ensure accurate pricing at all times. In situations where any OETH collateral falls below peg, [OIP-4 disables minting](https://github.com/OriginProtocol/origin-dollar/issues/1000) of additional OETH tokens using the de-pegged asset.

Smart contract risk of OETH - Origin is taking every step possible to be proactive and lessen the chance of losing funds. Security reviews are prioritized over new feature development, with regular audits being done, and multiple engineers are required to review each code change with a detailed checklist. There are timelocks before protocol upgrades are launched, and deep dives into the exploits of other protocols are constantly being done to make sure the same exploits don’t exist on Origin contracts. Security is extremely important to the Origin team. OETH was built reusing 95% of the OUSD code, of which 10+ audits have been done since 2020. All audits can be seen on [Audits - OUSD](https://docs.oeth.com/security-and-risks/audits), and OpenZeppelin is now on retainer. On-chain insurance protocol InsurAce awarded OUSD the [highest possible security rating of AAA](https://app.insurace.io/coverage/buycovers), which only 4 projects on the InsurAce platform have received.

## Relevant References
Origin was founded by Web3 veterans Josh Fraser and Matthew Liu in 2017 and is one of the most venerable projects in the space. Josh and Matthew are joined by the fully doxxed Origin [team]("https://www.originprotocol.com/community") and community, which includes hundreds of thousands of members and open-source contributors. Origin has raised $38.1M from top investors including Pantera, Spartan Group, Foundation Capital, BlockTower Capital, Steve Chen, Garry Tan, and Alexis Ohanian, and currently maintains a multimillion dollar treasury. As a technology partner, Origin Story has helped launch some of the largest NFT projects to-date:

* Paris Hilton Launches [‘Past Lives, New Beginnings’]("https://blog.originprotocol.com/paris-hilton-launches-past-lives-new-beginnings-on-origin-story-91f5011a9e29?gi=23f69e708e11")
* 3LAU Launches [Record-Setting $11.7M Auction]("https://blog.originprotocol.com/origin-nft-platform-powers-record-setting-11-7m-auction-with-3lau-c30a6812192c")
* Charlie Bit My Finger NFT Sale [Makes Headlines and Sets New Record](https://blog.originprotocol.com/charlie-bit-my-finger-nft-sale-on-origin-makes-global-headlines-and-sets-new-record-9cf60d5d6a29)
* Macallan Cask NFT [Sells For $2.3 Million](https://www.forbes.com/sites/ginapace/2021/10/31/a-macallan-cask-nft-sold-for-23-million-what-does-this-mean-for-whisky-collectors/?sh=1ebb21df7877)
* First Real Estate Sale via [NFT Marketplace](https://blog.originprotocol.com/the-first-real-estate-sale-via-nft-marketplace-executed-on-origin-protocols-story-marketplace-487127a5a77)

More information on OETH can be found via:

Origin Protocol homepage: http://originprotocol.com/

OETH homepage: https://oeth.com/

OETH docs: https://docs.oeth.com/

Origin Protocol Twitter: https://twitter.com/OriginProtocol

Origin Defi Twitter: https://twitter.com/OriginDeFi
