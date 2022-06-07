// this is for testing the govenernance contract on a live deploy
//
//
//
//
// this proposal will do the following
// 1. Upgrade the VaultController implementation
// 2. Upgrade the USDi implementation
// 3. Upgrade the Governor implementation
// 4. Set a new interest rate curve
// 5. Modify a parameter of an existing token

import { ethers } from "hardhat";
import { Signer } from "ethers";
import {
  CurveMaster__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory,
  ProxyAdmin__factory,
  ThreeLines0_100__factory,
  USDI__factory,
  VaultController__factory,
} from "../../../../typechain-types";
import { BN } from "../../../../util/number";
import { ProposalContext } from "../../suite/proposal";

const description = `
# Test Proposal 2


## Details

this proposal is for testing emergency proposals

good job me

`;

const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("polygonEmergency");

  await p.DeployAll();

  // now construct the proposal
  const donateReserve = await new USDI__factory(x)
    .attach("0x203c05ACb6FC02F5fA31bd7bE371E7B213e59Ff7")
    .populateTransaction.donateReserve();
  //set uni parameters

  p.addStep(donateReserve);

  const out = p.populateProposal();
  console.log(out);

  const charlie = new GovernorCharlieDelegate__factory(x).attach(
    "0x3389d29e457345E4f22731292D9C10ddFc78088f"
  );
  await p.sendProposal(charlie, description, true);

  return "success";
};

main().then(console.log).catch(console.log);
