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
# Test Proposal 1


## Details

this proposal is for testing

good job me

`;

const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("polygonNormal");

  // deploy the new vault controller
  p.AddDeploy("vaultcontroller", () => {
    return new VaultController__factory(x).deploy();
  });
  p.AddDeploy("USDI", () => {
    return new USDI__factory(x).deploy();
  });
  p.AddDeploy("governor", () => {
    return new GovernorCharlieDelegate__factory(x).deploy();
  });
  const s1 = BN("40e16");
  const s2 = BN("60e16");
  const r0 = BN("600e16");
  const r1 = BN("10e16");
  const r2 = BN("5e15");
  p.AddDeploy("curve", () => {
    return new ThreeLines0_100__factory(x).deploy(r0, r1, r2, s1, s2);
  });
  await p.DeployAll();

  // now construct the proposal

  // set the new curve
  const newCurve = await new CurveMaster__factory(x)
    .attach("0x52b2de5e0b5a9b2af71ff61f1ef2efb89d2138af")
    .populateTransaction.setCurve(
      "0x0000000000000000000000000000000000000000",
      p.db.getData(".deploys.curve")
    );
  //set uni parameters
  const setUni = await new VaultController__factory(x)
    .attach("0x385E2C6b5777Bc5ED960508E774E4807DDe6618c")
    .populateTransaction.updateRegisteredErc20(
      "0xBAB395136FaEa31F33f32737218D79E2e92b32C1",
      BN("55e16"),
      "0xBAB395136FaEa31F33f32737218D79E2e92b32C1",
      BN("15e16")
    );

  // then do the upgrades
  const upgradeVaultController = await new ProxyAdmin__factory(x)
    .attach("0xafDBA0899A00ca07D36d019eF7649803b70a9c08")
    .populateTransaction.upgrade(
      "0x385E2C6b5777Bc5ED960508E774E4807DDe6618c",
      p.db.getData(".deploys.vaultcontroller")
    );

  const upgradeUSDI = await new ProxyAdmin__factory(x)
    .attach("0xafDBA0899A00ca07D36d019eF7649803b70a9c08")
    .populateTransaction.upgrade(
      "0x203c05ACb6FC02F5fA31bd7bE371E7B213e59Ff7",
      p.db.getData(".deploys.USDI")
    );

  const upgradeGovernor = await new GovernorCharlieDelegator__factory(x)
    .attach("0x3389d29e457345E4f22731292D9C10ddFc78088f")
    .populateTransaction._setImplementation(p.db.getData(".deploys.governor"));

  //p.addStep(newCurve, "setCurve(address,address)");
  //p.addStep(setUni, "updateRegisteredErc20(address,uint256,address,uint256)");
  p.addStep(upgradeVaultController, "upgrade(address,address)");
  p.addStep(upgradeUSDI, "upgrade(address,address)");
  //p.addStep(upgradeGovernor, "_setImplementation(address)");

  const out = p.populateProposal();
  console.log(out);

  const charlie = new GovernorCharlieDelegate__factory(x).attach(
    "0x3389d29e457345E4f22731292D9C10ddFc78088f"
  );
  await p.sendProposal(charlie, description, true);

  return "success";
};

main().then(console.log).catch(console.log);
