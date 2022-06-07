import {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  PopulatedTransaction,
  Signer,
} from "ethers";

import { JsonDB } from "node-json-db";
import { Config } from "node-json-db/dist/lib/JsonDBConfig";
import { GovernorCharlieDelegate } from "../../../typechain-types";

export interface ProposalContext {
  PreProposal: (x: Signer) => PromiseLike<any>;
  Proposal: (x: Signer) => PromiseLike<any>;
}

interface ProposalData {
  targets: string[];
  values: BigNumberish[];
  signatures: string[];
  calldatas: BytesLike[];
}

type Data = {
  deploys: any;
};

export class ProposalContext {
  name: string;

  db: JsonDB;
  deploys: Map<string, () => Promise<BaseContract>>;

  steps: PopulatedTransaction[];

  constructor(name: string) {
    this.deploys = new Map();
    this.steps = [];
    this.name = name;
    this.db = new JsonDB(
      new Config("./proposals/" + name + ".proposal", true, true, ".")
    );
  }

  addStep(p: PopulatedTransaction) {
    this.steps.push(p);
  }

  populateProposal(): ProposalData {
    const out: ProposalData = {
      targets: [],
      values: [],
      signatures: [],
      calldatas: [],
    };
    for (const v of this.steps) {
      out.calldatas.push(v.data ? "0x" + v.data.substring(10) : "");
      out.signatures.push(v.data ? v.data.substring(0, 10) : "");
      out.values.push(v.value ? v.value : 0);
      out.targets.push(
        v.to ? v.to : "0x0000000000000000000000000000000000000000"
      );
    }
    return out;
  }

  async sendProposal(
    charlie: GovernorCharlieDelegate,
    description: string,
    emergency?: boolean
  ) {
    const out = this.populateProposal();
    const txn = await charlie
      .propose(
        out.targets,
        out.values,
        out.signatures,
        out.calldatas,
        description,
        emergency ? true : false
      )
      .then(async (res) => {
        this.db.push(".proposal.proposeTxn", res.hash);
      });
  }

  AddDeploy(name: string, deployment: () => Promise<BaseContract>) {
    this.deploys.set(name, deployment);
  }

  DeployAddress(n: string): string {
    const x = this.db.getData(".deploys." + n);
    return x ? x : "";
  }

  async DeployAll() {
    for (const [k, v] of this.deploys.entries()) {
      const dbv = this.db.exists(".deploys." + k);
      if (!dbv) {
        console.log("deploying:", k);
        await v()
          .then(async (x: any) => {
            return x.deployed().then(() => {
              this.db.push(".deploys." + k, x.address);
            });
          })
          .catch((e: any) => {
            console.log(`failed to deploy ${k}, ${e}`);
          });
      }
    }
  }
}
