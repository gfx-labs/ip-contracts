import { ethers } from "hardhat";
import {
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory,
  ProxyAdmin__factory,
  USDI__factory,
  VaultController__factory,
} from "../../../../typechain-types";
import { countdownSeconds, ProposalContext } from "../../suite/proposal";

const description = `
# IP July Update

A small update to Vault Controller and USDi for less friction in transfers.

Adds Optimistic governance to governor charlie

Add GFX labs as an optimistic proposer
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


  const newVC = await new ProxyAdmin__factory(x)
  .attach("0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5")
  .populateTransaction.upgrade(
    "0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3",
    p.db.getData(".deploys.new_vc"),
  )

  const newUSDi = await new ProxyAdmin__factory(x)
  .attach("0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5")
  .populateTransaction.upgrade(
    "0x2a54ba2964c8cd459dc568853f79813a60761b58",
    p.db.getData(".deploys.new_usdi")
  )
  const addOptimisticGFX = await new GovernorCharlieDelegate__factory(x)
  .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
  .populateTransaction._setWhitelistAccountExpiration("0xa6e8772af29b29b9202a073f8e36f447689beef6",31536000)

  p.addStep(newGov, "_setImplementation(address)");
  p.addStep(newVC, "upgrade(address,address)");
  p.addStep(newUSDi, "upgrade(address,address)");
  p.addStep(addOptimisticGFX, "_setWhitelistAccountExpiration(address,uint256)");

  const out = p.populateProposal();
  const charlie = new GovernorCharlieDelegate__factory(x).attach(
    "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
  );

  console.log("PLEASE CHECK PROPOSAL! PROPOSING IN 10 seconds")
  await countdownSeconds(10)
  console.log("sending transaction....")
  await p.sendProposal(charlie, description, true);

  return "success";
};

main().then(console.log).catch(console.log);
