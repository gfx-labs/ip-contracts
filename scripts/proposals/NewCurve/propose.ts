import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, CurveMaster__factory
} from "../../../typechain-types";
import { ProposalContext } from "../suite/proposal";
import { d } from "../DeploymentInfo";
import { reset } from "../../../util/block";
import * as fs from 'fs';

const { ethers, network, upgrades } = require("hardhat");

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"


const ZER0 = "0x0000000000000000000000000000000000000000"
const newLinesAddress = "0x482855c43a0869D93C5cA6d9dc9EDdF3DAE031Ea"

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await reset(15885327)
    await network.provider.send("evm_setAutomine", [true])

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const proposal = new ProposalContext("New Curve")

    const registerNewCUrve = await new CurveMaster__factory().
        attach(d.Curve).
        populateTransaction.setCurve(
            ZER0,
            newLinesAddress
        )

    
    proposal.addStep(registerNewCUrve, "setCurve(address,address)")
  
    let out = proposal.populateProposal()

    console.log(out)
    const proposalText = fs.readFileSync('./scripts/proposals/NewCurve/proposal.md', 'utf8');

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
    
    //showBody(JSON.stringify(data))
    fs.writeFileSync('./scripts/proposals/NewCurve/proposalHexData.txt', JSON.stringify(data));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
