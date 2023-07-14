import { ethers } from "hardhat";
import {
  AnchoredViewRelay__factory,
  CappedGovToken__factory,
  ChainlinkOracleRelay__factory,
  GovernorCharlieDelegate__factory, OracleMaster__factory, TransparentUpgradeableProxy__factory,
  UniswapV3OracleRelay__factory, VaultController__factory
} from "../../../../typechain-types";
import { BN } from "../../../../util/number";
import { countdownSeconds, ProposalContext } from "../../suite/proposal";


const matic_token_address = "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0"
const chainlink_oracle_address = "0x7bac85a8a13a4bcd8abb3eb7d6b4d632c5a57676"
const uniswap_pool_address = "0x07a6e955ba4345bae83ac2a6faa771fddd8a2011"

const description = `
# IP Aug Update #1

List MATIC token to the protocol.

  LTV: 80%
  Liquidation Penalty: 10%
  Cap: 50,000,000 MATIC

  Oracle: Chainlink + Uniswapv3 Anchored View, 10% wide on each side
  Token Address: ${matic_token_address}
  Chainlink Oracle: ${chainlink_oracle_address}
  Uniswap Pool: ${uniswap_pool_address}
`;

const main = async () => {
  const accounts = await ethers.getSigners();
  const x = accounts[0];
  const p = new ProposalContext("mainnet_4_matic");

  p.AddDeploy("capped_matic", ()=> {
    return new CappedGovToken__factory(x).deploy();
  });
  p.AddDeploy("capped_matic_proxy", () => {
    return new TransparentUpgradeableProxy__factory(x).deploy(
      p.db.getData(".deploys.capped_matic"),
      "0x3D9d8c08dC16Aa104b5B24aBDd1aD857e2c0D8C5",
      "0x"
    )
  });
  await p.DeployAll();

  // chainlink
  p.AddDeploy("new_chainlink", () => {
    return new ChainlinkOracleRelay__factory(x).deploy(
      chainlink_oracle_address,
      BN("1e10"),
      1,
    );
  });
  // deploy the uniswap Oracle
  p.AddDeploy("new_uniswap", () => {
   return new UniswapV3OracleRelay__factory(x).deploy(
     60 * 60 * 4,
     uniswap_pool_address,
     false,
     BN("1e12"),
     BN("1"),
   );
  });

  p.AddDeploy("new_anchored", () => {
    return new AnchoredViewRelay__factory(x).deploy(
      p.db.getData(".deploys.new_uniswap"),
      p.db.getData(".deploys.new_chainlink"),
      10,
      100,
    );
  });

  await p.DeployAll()

  const addOracle = await new OracleMaster__factory(x).
    attach("0xf4818813045e954f5dc55a40c9b60def0ba3d477")
  .populateTransaction.setRelay(
    p.db.getData(".deploys.capped_matic_proxy"),
    p.db.getData(".deploys.new_anchored")
  )
  const listMatic = await  new VaultController__factory(x).
    attach("0x4aae9823fb4c70490f1d802fc697f3fff8d5cbe3").
  populateTransaction.registerErc20(
    p.db.getData(".deploys.capped_matic_proxy"),
    BN("80e16"),
    p.db.getData(".deploys.capped_matic_proxy"),
    BN("8e16")
  )

  p.addStep(addOracle, "setRelay(address,address)");
  p.addStep(listMatic, "registerErc20(address,uint256,address,uint256)");


  const out = p.populateProposal();
  const charlie = new GovernorCharlieDelegate__factory(x).attach(
    "0x266d1020A84B9E8B0ed320831838152075F8C4cA"
  );

  console.log(description)
  console.log(out)
  console.log("PLEASE CHECK PROPOSAL! PROPOSING IN 10 seconds")
  await countdownSeconds(10)
  console.log("sending transaction....")
  await p.sendProposal(charlie, description, true);

  return "success";
};

main().then(console.log).catch(console.log);
