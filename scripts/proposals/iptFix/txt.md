# IPT Admin Proposal
A GFX Labs developer wallet (0x958892b4a0512b28AaAC890FC938868BBD42f064) has been comprised. Unfortunately, the wallet held ownership of GFX's IPT auction contract, and since the contract had reached its withdrawal point, the attacker had the ability to withdraw the IPT tokens not purchased. Subsequently, the attacker transferred and sold 3M IPT tokens. At this time, the attacker holds 2M IPT tokens.

To prevent the community from having these stolen IPTs lingering over the community, we have constructed a proposal to upgrade the IPT token contract to add a function to transfer the tokens from the attacker to the protocol treasury and then revert the upgrade to the prior implementation. 

[Attacker address](https://etherscan.io/address/0x41173311ab332fb08d2b0bb9398ae6d178b3adaf)
[Temporary implementation](https://etherscan.io/address/0x387EedD357836A73eCEf07067E6360A95C254b17)