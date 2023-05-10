import { BN } from "../../../../util/number";
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, AnchoredViewRelay, OracleMaster__factory
} from "../../../../typechain-types";
import { ProposalContext } from "../../suite/proposal";
import { d } from "../../DeploymentInfo";
import { reset } from "../../../../util/block";
import * as fs from 'fs';

const { ethers, network, upgrades } = require("hardhat");

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const newAnchorView = "0xae7Be6FE233bd33F9F9149050932cBa728793fdd"




async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await reset(16135523 )
    await network.provider.send("evm_setAutomine", [true])

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const proposal = new ProposalContext("UPDATE ORACLES")

    const addNewCBETH_Oracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedCBETH,
            newAnchorView
        )

    proposal.addStep(addNewCBETH_Oracle, "setRelay(address,address)")
  

    let out = proposal.populateProposal()

    console.log(out)
    const proposalText = fs.readFileSync('./scripts/proposals/rETH_cbETH/updateOracles/proposal.md', 'utf8');

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

    fs.writeFileSync('./scripts/proposals/rETH_cbETH/updateOracles/proposalHexData.txt', JSON.stringify(data));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
