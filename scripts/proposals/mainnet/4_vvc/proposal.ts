import { ethers } from "hardhat";
import {
  CappedGovToken__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory,
  OracleMaster__factory,
  ProxyAdmin__factory,
  StEthOracleRelay__factory,
  TransparentUpgradeableProxy__factory,
  USDI__factory,
  VaultController__factory,
  VotingVaultController__factory,
} from "../../../../typechain-types";
import { BN } from "../../../../util/number";
import { countdownSeconds, ProposalContext, sleep } from "../../suite/proposal";

const description = `
# Add VVC
add VVC
`;



const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("mainnet_4_vvc");

  // new governor
  p.AddDeploy("new_vvc", () => {
    return new VotingVaultController__factory(x).deploy();
  });

  await p.DeployAll();
  p.AddDeploy("new_vvc_proxy", () => {
    return new TransparentUpgradeableProxy__factory(x).deploy(
      p.db.getData(".deploys.new_vvc"),
      "0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5",
      "0x",
    );
  });
  await p.DeployAll();
  p.AddDeploy("capped_token", ()=> {
    return new CappedGovToken__factory(x).deploy();
  });
  await p.DeployAll();
  p.AddDeploy("capped_token_proxy", () => {
    return new TransparentUpgradeableProxy__factory(x).deploy(
      p.db.getData(".deploys.capped_token"),
      "0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5",
      "0x"
    )
  });
  await p.DeployAll();

  await new CappedGovToken__factory(x).attach(
    p.db.getData(".deploys.capped_token_proxy")
  ).initialize(
  "Capped IPT", "cIPT",
  "0xd909c5862cdb164adb949d92622082f0092efc3d",
  "0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3",
  p.db.getData(".deploys.new_vvc_proxy"),
  )



              return "success";
};

main().then(console.log).catch(console.log);
