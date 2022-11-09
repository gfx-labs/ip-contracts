import { ethers } from "hardhat";
import {
    AnchoredViewRelay__factory,
  CappedGovToken__factory,
  ChainlinkOracleRelay__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory,
  OracleMaster__factory,
  ProxyAdmin__factory,
  SlowRoll__factory,
  StEthOracleRelay__factory,
  ThreeLines0_100__factory,
  TransparentUpgradeableProxy__factory,
  UniswapV3OracleRelay__factory,
  USDI__factory,
  VaultController__factory,
  VotingVaultController__factory,
} from "../../../../typechain-types";
import { BN } from "../../../../util/number";
import { countdownSeconds, ProposalContext, sleep } from "../../suite/proposal";



const description = `
# IP Sep Update #1

Adjust interest rate curve.

  https://forums.interestprotocol.io/t/interest-rate-curve-adjustment/63

New Parameters:

  s1: 	65%
  s2: 	35%
  r1: 	0.50%
  r2: 	20%
  r3: 	300%

`;

const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("mainnet_5_new_curve");

  p.AddDeploy("new_curve", () => {
    return new ThreeLines0_100__factory(x).deploy(
        BN("300e16"), //r1
        BN("20e16"), //r2
        BN("5e15"), //r3
        BN("35e16"), //s1
        BN("65e16") //s2
    );
  });

  await p.DeployAll()

  const out = p.populateProposal();
  const charlie = new GovernorCharlieDelegate__factory(x).attach(
    "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
  );

  console.log(description)
  console.log(out)
  console.log("PLEASE CHECK PROPOSAL! PROPOSING IN 10 seconds")
  await countdownSeconds(10)
  console.log("sending transaction....")
 // await p.sendProposal(charlie, description, true);

  return "success";
};

main().then(console.log).catch(console.log);
