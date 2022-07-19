import { match } from "assert";
import { ethers } from "hardhat";
import {
    AnchoredViewRelay__factory,
    ChainlinkOracleRelay__factory,
  GovernorCharlieDelegate__factory,
  GovernorCharlieDelegator__factory,
  ProxyAdmin__factory,
  USDI__factory,
  VaultController__factory,
} from "../../../../typechain-types";
import { BN } from "../../../../util/number";
import { countdownSeconds, ProposalContext, sleep } from "../../suite/proposal";

const description = `
# IP July Update #2

Lists Lido Staked Eth, or stEth, to the protocol.

  Parameters:

  LTV: 75%
  Liquidation Penalty: 10%
  Cap: Infinite

  Oracle: Chainlink + Curvefi Anchored View, 10% wide on each side
  Chainlink Oracle: 0xcfe54b5cd566ab89272946f602d76ea879cab4a8
  Curve Pool:
`;


const lido_token_address = ""
const chainlink_oracle_address = "0xcfe54b5cd566ab89272946f602d76ea879cab4a8"
const curve_pool_address = ""


const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("mainnet_1_optimistic");

  // deploy the Curvefi Oracle
  p.AddDeploy("new_curvefi", () => {
 //   return new (x).deploy();
  });
  // chainlink
  p.AddDeploy("new_chainlink", () => {
    return new ChainlinkOracleRelay__factory(x).deploy(
      chainlink_oracle_address,
      1,
      1,
    );
  });

  await p.DeployAll();

  // now construct the proposal
  // AnchoredView
  p.AddDeploy("new_anchored", () => {
    return new AnchoredViewRelay__factory(x).deploy(
      p.db.getData(".deploys.new_curvefi"),
      p.db.getData(".deploys.new_chainlink"),
      10,
      100,
    );
  });

  await p.DeployAll();


  const listLido = await  new VaultController__factory(x).
    attach("0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3").
  populateTransaction.registerErc20(
    lido_token_address,
    BN("10e16"),
    lido_token_address,
    BN("75e16"),
  )

  const addOptimisticGFX = await new GovernorCharlieDelegate__factory(x)
  .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
  .populateTransaction._setWhitelistAccountExpiration("0xa6e8772af29b29b9202a073f8e36f447689beef6",31536000)

  p.addStep(addOracle, "upgrade(address,address)");
  p.addStep(listLido, "registerErc20(address,uint256,address,uint256)");
  p.addStep(addOptimisticGFX, "_setWhitelistAccountExpiration(address,uint256)");

  const addOptimisticGFX = await new GovernorCharlieDelegate__factory(x)
  .attach("0x266d1020A84B9E8B0ed320831838152075F8C4cA")
  .populateTransaction._setWhitelistAccountExpiration(
    "0xa6e8772af29b29b9202a073f8e36f447689beef6",
    31536000
  )


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
