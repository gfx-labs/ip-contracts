// this is for testing the govenernance contract on a live deploy
//
//
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
  WavePool__factory,
} from "../../../../typechain-types";
import { BN } from "../../../../util/number";
import { ProposalContext } from "../../suite/proposal";
import { treeFromObject } from "../../../../util/wave";

const description = `
# Test Proposal 2


## Details

this proposal is for testing emergency proposals

good job me

`;

const obj = {
  "0x50818e936aB61377A18bCAEc0f1C32cA27E38923": BN("5e5"),
  "0xA8F5d96E2DDfb5ec3F24B960A5a44EbC620064A3": BN("10e5"),
  "0x9C3744f033563a5fC6e38B79eD316972961a400F": BN("5e5"),
  "0xad8b917596d9e6a970393f089dcff0a9c9858934": BN("5e5"),
  "0x1b05DF9509080D94d6BF74814E54a9e727F7b402": BN("5e5"),
  "0x6739dCb4fe0B31f5E93c0742ad96386D8A0927A8": BN("5e5"),
};

const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("polygonEmergency");

  //npx hardhat verify --network polygon 0xC02266Fb401a0c52E68fA4cd63b27D84BDb10BcC 0xC02266Fb401a0c52E68fA4cd63b27D84BDb10BcC 0 0xC02266Fb401a0c52E68fA4cd63b27D84BDb10BcC 29324978 0x4140ea691c1d761667b09f2387404b9457bbdb6417b9bda8a04d660c39e115d7 29292578 0x4140ea691c1d761667b09f2387404b9457bbdb6417b9bda8a04d660c39e115d7 29250178 0x0000000000000000000000000000000000000000000000000000000000000000 29260178
  const tree = treeFromObject(obj);
  p.AddDeploy("waves", () => {
    return new WavePool__factory(x).deploy(
      "0x50818e936aB61377A18bCAEc0f1C32cA27E38923",
      0,
      "0xe8504e3B854940818c8F3D61DC155FA9919dd10F",
      29324978,
      tree.getHexRoot(),
      29292578,
      tree.getHexRoot(),
      29260178,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      29260178
    );
  });

  console.log(tree.getHexRoot());
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
