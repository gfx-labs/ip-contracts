import { expect, assert } from "chai";
import { ethers, network, tenderly } from "hardhat";
import { stealMoney } from "../../../../../util/money";
import { showBody } from "../../../../../util/format";
import { BN } from "../../../../../util/number";
import { toNumber } from "../../../../../util/math";
import { impersonateAccount, ceaseImpersonation } from "../../../../../util/impersonator"

import { s } from "../scope";
import { d } from "../DeploymentInfo";
import { advanceBlockHeight, fastForward, currentBlock, mineBlock } from "../../../../../util/block";
import {
    IVault__factory,
    ChainlinkOracleRelay__factory,
    GovernorCharlieDelegate__factory,
    GovernorCharlieDelegator__factory,
    OracleMaster__factory,
    VaultController__factory,
    AnchoredViewRelay__factory
} from "../../../../../typechain-types";


import { ProposalContext } from "../../../../../scripts/proposals/suite/proposal";

require("chai").should();
describe("Verify Contracts", () => {
    it("Should return the right name, symbol, and decimals", async () => {

        expect(await s.USDI.name()).to.equal("USDI Token");
        expect(await s.USDI.symbol()).to.equal("USDI");
        expect(await s.USDI.decimals()).to.equal(18);
        //expect(await s.USDI.owner()).to.equal(s.Frank.address);
        s.owner = await s.USDI.owner()
        s.pauser = await s.USDI.pauser()
    });


    it("Check data on VaultControler", async () => {
        let tokensRegistered = await s.VaultController.tokensRegistered()
        expect(tokensRegistered).to.be.gt(0)
        let interestFactor = await s.VaultController.interestFactor()
        expect(await toNumber(interestFactor)).to.be.gt(1)

    });

    it("mint vaults for testing", async () => {
        //showBody("bob mint vault")
        await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
            .reverted;
        await mineBlock();
        s.BobVaultID = await s.VaultController.vaultsMinted()
        let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
        s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
        expect(await s.BobVault.minter()).to.eq(s.Bob.address);

        //showBody("carol mint vault")
        await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
            .reverted;
        await mineBlock();
        s.CaroLVaultID = await s.VaultController.vaultsMinted()
        vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
        s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
        expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
    });

    it("vault deposits", async () => {
        await expect(s.WETH.connect(s.Bob).transfer(s.BobVault.address, s.Bob_WETH))
            .to.not.reverted;
        await expect(
            s.UNI.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_UNI)
        ).to.not.reverted;
        await mineBlock();

        //showBody("bob transfer weth")
        expect(await s.BobVault.tokenBalance(s.wethAddress)).to.eq(s.Bob_WETH)

        //showBody("carol transfer uni")
        expect(await s.CarolVault.tokenBalance(s.uniAddress)).to.eq(s.Carol_UNI)

    });
});

describe("Confirm state before upgrade", async () => {
    it("Confirm STETH oracle does not exist yet", async () => {
        expect(s.Oracle.getLivePrice(s.STETH_ADDRESS)).to.be.revertedWith("token not enabled")
    })
})

describe("Queue and Execute proposal", () => {
    const lido_token_address = "0xae7ab96520de3a18e5e111b5eaab095312d7fe84";

    const governorAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA";
    const proposer = "0x958892b4a0512b28AaAC890FC938868BBD42f064";
    const voteBlocks = 6570;
    const timelockDelay = 43200;
    const owner = ethers.provider.getSigner(s.IP_OWNER)
    const prop = ethers.provider.getSigner(proposer)

    const gov = GovernorCharlieDelegate__factory.connect(governorAddress, prop);



    it("Makes the new proposal", async () => {
        await impersonateAccount(proposer)
        const p = new ProposalContext("mainnet_2_lido");
        // construct the proposal

        const addOracle = await new OracleMaster__factory(prop).
            attach("0xf4818813045e954f5dc55a40c9b60def0ba3d477")
            .populateTransaction.setRelay(
                lido_token_address,
                "0x73052741d8bE063b086c4B7eFe084B0CEE50677A"//p.db.getData(".deploys.new_anchored")
            )
        const listLido = await new VaultController__factory(prop).
            attach("0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3")
            .populateTransaction.registerErc20(
                lido_token_address,
                BN("75e16"),
                lido_token_address,
                BN("10e16")
            )
        const addOptimisticGFX = await new GovernorCharlieDelegate__factory(prop)
            .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
            .populateTransaction._setWhitelistAccountExpiration(
                "0xa6e8772af29b29b9202a073f8e36f447689beef6",
                1658261294 + 30000000,
            )

        const newGov = await new GovernorCharlieDelegator__factory(prop)
            .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
            .populateTransaction._setImplementation(p.db.getData(".deploys.new_gov"));

        const govSetPeriod = await new GovernorCharlieDelegate__factory(prop)
            .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
            .populateTransaction.setMaxWhitelistPeriod(31536000)

        const govSetOpVotes = await new GovernorCharlieDelegate__factory(prop)
            .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
            .populateTransaction["_setOptimisticQuorumVotes(uint256)"]("2000000000000000000000000")

        const govSetOpDelay = await new GovernorCharlieDelegate__factory(prop)
            .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
            .populateTransaction._setOptimisticDelay(25600)

        p.addStep(newGov, "_setImplementation(address)");
        p.addStep(govSetPeriod, "setMaxWhitelistPeriod(uint256)")
        p.addStep(govSetOpVotes, "_setOptimisticQuorumVotes(uint256)")
        p.addStep(govSetOpDelay, "_setOptimisticDelay(uint256)")

        p.addStep(addOracle, "setRelay(address,address)");
        p.addStep(listLido, "registerErc20(address,uint256,address,uint256)");
        p.addStep(addOptimisticGFX, "_setWhitelistAccountExpiration(address,uint256)");


        const out = p.populateProposal();
        //console.log(out);


        const charlie = new GovernorCharlieDelegate__factory(prop).attach(
            governorAddress
        );

        const description = `
            # Test Description

            `;

        await charlie.propose(
            out.targets,
            out.values,
            out.signatures,
            out.calldatas,
            description,
            true
        )

        //await p.sendProposal(charlie, description, true)
        await mineBlock()
        await ceaseImpersonation(proposer)
    })


    it("Queue and Execute", async () => {


        const votingPeriod = await gov.emergencyVotingPeriod()
        const timelock = await gov.emergencyTimelockDelay()

        const block = await currentBlock()
        const votes = await s.IPT.getPriorVotes(proposer, block.number - 2)
        expect(await toNumber(votes)).to.eq(45000000, "Correct number of votes delegated")



        await impersonateAccount(proposer)

        await gov.connect(prop).castVote(4, 1)
        showBody("Advancing a lot of blocks...")
        await advanceBlockHeight(votingPeriod.toNumber());
        await gov.connect(prop).queue(4);
        await mineBlock()
        await fastForward(timelock.toNumber());
        await gov.connect(prop).execute(4);
        await mineBlock();

        await ceaseImpersonation(proposer)


    })

})