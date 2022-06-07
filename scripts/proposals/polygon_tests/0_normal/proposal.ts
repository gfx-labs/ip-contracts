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
  GovernorCharlieDelegate__factory,
  ThreeLines0_100__factory,
  USDI__factory,
  VaultController__factory,
} from "../../../../typechain-types";
import { BN } from "../../../../util/number";
import { ProposalContext } from "../../suite/proposal";

const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("polygonNormal");

  // deploy the new vault controller
  p.AddDeploy("vaultcontroller", new VaultController__factory(x).deploy);
  p.AddDeploy("USDI", new USDI__factory(x).deploy);
  p.AddDeploy("governor", new GovernorCharlieDelegate__factory(x).deploy);
  const s1 = BN("60e16");
  const s2 = BN("40e16");
  const r0 = BN("5e15");
  const r1 = BN("10e16");
  const r2 = BN("600e16");
  p.AddDeploy("curve", () => {
    return new ThreeLines0_100__factory(x).deploy(r0, r1, r2, s1, s2);
  });
};
