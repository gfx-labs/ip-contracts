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
  InterestProtocolTokenDelegate__factory,
  InterestProtocolToken__factory,
  ThreeLines0_100__factory,
  TransparentUpgradeableProxy__factory,
  USDI__factory,
  VaultController__factory,
} from "../../../../typechain-types";
import { BN } from "../../../../util/number";
import { ProposalContext } from "../../suite/proposal";

const description = `
#  Transfer Token


## Details

Transfer token that owns governance
`;

const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("mainnet_1_optimistic");

  // deploy the new vault controller
  p.AddDeploy("new_vc", () => {
    return new VaultController__factory(x).deploy();
  });
  p.AddDeploy("new_gov", () => {
    return new GovernorCharlieDelegate__factory(x).deploy();
  });
  p.AddDeploy("new_usdi", () => {
    return new USDI__factory(x).deploy();
  });

  await p.DeployAll();
  // now construct the proposal
  const newGov = await new GovernorCharlieDelegator__factory(x)
  .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
  .populateTransaction._setImplementation(p.db.getData(".deploys.new_gov"));

  const newVC = await new TransparentUpgradeableProxy__factory(x)
  .attach("0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3")
  .populateTransaction.upgradeTo(p.db.getData(".deploys.new_vc"));

  const newUSDi = await new TransparentUpgradeableProxy__factory(x)
  .attach("0x2a54ba2964c8cd459dc568853f79813a60761b58")
  .populateTransaction.upgradeTo(p.db.getData(".deploys.new_usdi"));

  p.addStep(newGov, "_setImplementation(address)");
  p.addStep(newVC, "upgradeTo(address)");
  p.addStep(newUSDi, "upgradeTo(address)");

  const out = p.populateProposal();
  console.log(out);

  const charlie = new GovernorCharlieDelegate__factory(x).attach(
    "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
  );

  //await p.sendProposal(charlie, description, true);

  return "success";
};

main().then(console.log).catch(console.log);
