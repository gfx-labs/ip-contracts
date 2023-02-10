# Proposal to Change Governance Parameters

This is a proposal to amend the governance parameters. 

## Below are the **current** parameters
#### Standard Proposal Parameters
* proposal threshold: 1,000,000
* voting delay (blocks): 13140 - about 1.8 days 
* voting period (blocks): 40320 - about 5.6 days
* proposal timelock delay (seconds): 172800 - 2 days
* quorum threshold: 10,000,000

#### Emergency Proposal Parameters
* emergency voting period (blocks): 6570 - about 0.9 days
* emergency voting timelockDelay (seconds): 43200 - 12 hours
* emergency quorum threshold: 50,000,000

#### Optimistic Proposal Parameters
* optimistic voting delay (blocks): 25600 - about 3.5 days
* voting period (blocks): 40320 - about 5.6 days
* optimistic negative quorum threshold: 2,000,000

[Docs Governance Info](https://interestprotocol.io/book/docs/concepts/Governance/Overview/)

### Proposed change
The current parameters are not productive due to the low circulating supply of IPT. By my tally, there is approximately 18 million IPT in the wild, and the more realistic voting supply is likely closer to 9 million. However, with the [GFX Labs Delegation Program](https://medium.com/interest-protocol/permissionless-unbiased-token-delegation-by-gfx-labs-328ac6fd4528) coming into effect in the coming weeks, we can likely expect the voting supply to increase between 2-5m.

At this time, I believe the key parameters to update are the following:
#### Standard Proposal Parameters
* proposal threshold: 200,000
* quorum threshold: 2,000,000

#### Optimistic Proposal Parameters
* optimistic negative  quorum threshold: 500,000

By decreasing the proposal threshold, approximately 25 addresses would have proposal power, and that number will likely increase to 35 after the Delegation Program takes effect. Decreasing the quorum from one million to five hundred thousand should be a sufficient improvement. 

If we find that too many proposals are being made, we can increase the proposal threshold, or if we find the quorum threshold is too easily achieved, we can increase it.

## Links
[Forum thread](https://forums.interestprotocol.io/t/proposal-to-change-governance-parameters/141?u=getty)
## Recongized Delegator Facilitator Pay
600 USDi will be transferred from the treasury to Feems.eth to pay for Feem's efforts on the recongized delegate program.