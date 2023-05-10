import { BN } from "../../../util/number";
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, OracleMaster__factory,
    VaultController__factory,
    VotingVaultController__factory
} from "../../../typechain-types";
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";
import { d } from "../DeploymentInfo";
import { reset } from "../../../util/block";
import * as fs from 'fs';

const { ethers, network, upgrades } = require("hardhat");

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"


async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await reset(15668790)
    await network.provider.send("evm_setAutomine", [true])

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const proposal = new ProposalContext("Balancer and Aave")

    const addBalOracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedBalancer,
            d.BalancerAnchorView
        )

    const addAaveOracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedAave,
            d.AaveAnchorView
        )



    const listBal = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            d.CappedBalancer,
            BN("70e16"),
            d.CappedBalancer,
            BN("10e16")
        )

    const listAave = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            d.CappedAave,
            BN("70e16"),
            d.CappedAave,
            BN("10e16")
        )

    //register on voting vault controller
    const registerBalVVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            d.balancerAddress,
            d.CappedBalancer
        )
    const registerAaveVVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            d.aaveAddress,
            d.CappedAave
        )


    proposal.addStep(addBalOracle, "setRelay(address,address)")
    proposal.addStep(addAaveOracle, "setRelay(address,address)")


    proposal.addStep(listBal, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(listAave, "registerErc20(address,uint256,address,uint256)")


    proposal.addStep(registerBalVVC, "registerUnderlying(address,address)")
    proposal.addStep(registerAaveVVC, "registerUnderlying(address,address)")



    let out = proposal.populateProposal()

    console.log(out)
    const proposalText = fs.readFileSync('./scripts/proposals/BalancerAave/proposal.md', 'utf8');

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

    console.log(data)

    fs.writeFileSync('./scripts/proposals/BalancerAave/proposalHexData.txt', JSON.stringify(data));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
