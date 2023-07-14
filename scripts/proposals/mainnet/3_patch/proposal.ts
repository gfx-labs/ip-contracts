import { ethers } from "hardhat";
import {
  GovernorCharlieDelegate__factory, ProxyAdmin__factory, VaultController__factory
} from "../../../../typechain-types";
import { countdownSeconds, ProposalContext } from "../../suite/proposal";

const description = `
# IP Aug Update #3
patch to vc
`;




const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("mainnet_3_patch");

  // new governor
  p.AddDeploy("new_vc", () => {
    return new VaultController__factory(x).deploy();
  });

  await p.DeployAll();
  const newVC = await new ProxyAdmin__factory(x)
  .attach("0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5")
  .populateTransaction.upgrade(
    "0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3",
    p.db.getData(".deploys.new_vc"),
  )

  const changeTBL = await new VaultController__factory(x)
  .attach("0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3").populateTransaction
  .patchTBL()

  p.addStep(newVC, "upgrade(address,address)");
  p.addStep(changeTBL, "patchTBL()");

  const out = p.populateProposal();
  const charlie = new GovernorCharlieDelegate__factory(x).attach(
    "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
  );

  console.log(out)
  console.log("PLEASE CHECK PROPOSAL! PROPOSING IN 10 seconds")
  await countdownSeconds(10)
  console.log("sending transaction....")
  await p.sendProposal(charlie, description, true);

  return "success";
};

main().then(console.log).catch(console.log);
