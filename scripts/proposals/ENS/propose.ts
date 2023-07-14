import { BN } from "../../../util/number";
import {
    CappedGovToken,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, UniswapV3TokenOracleRelay,
    AnchoredViewRelay, OracleMaster__factory,
    VaultController__factory,
    VotingVaultController__factory,
    ChainlinkOracleRelay
} from "../../../typechain-types";
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";
import { a, c, d } from "../../../util/addresser"
import { reset } from "../../../util/block";
import * as fs from 'fs';

const { ethers, network, upgrades } = require("hardhat");

const ensAddress = "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await reset(15529257)
    await network.provider.send("evm_setAutomine", [true])

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const proposal = new ProposalContext("ENS")

    const addOracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            c.CappedENS,
            c.EnsAnchorView
        )


    const listENS = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            c.CappedENS,
            BN("70e16"),
            c.CappedENS,
            BN("10e16")
        )

    //register on voting vault controller
    const registerVVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            ensAddress,
            c.CappedENS
        )


    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(listENS, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerVVC, "registerUnderlying(address,address)")


    let out = proposal.populateProposal()

    console.log(out)
    const proposalText = fs.readFileSync('test/upgrade6/queueAndExecute/proposal.md', 'utf8');

    let gov: GovernorCharlieDelegate;
    gov = new GovernorCharlieDelegate__factory(deployer).attach(
        govAddress
    );

    const data = await gov.connect(deployer).populateTransaction.propose(
        out.targets,
        out.values,
        out.signatures,
        out.calldatas,
        proposalText,
        false
    )

    fs.writeFileSync('./proposalHexData.txt', JSON.stringify(data));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
