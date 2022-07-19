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

export const sleep = async(ms:number)=>{
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const countdownSeconds = async(secs:number)=>{
  while(true){
  console.log(secs)
  await sleep(1000)
  secs = secs - 1
  if(secs < 1){
    return
  }
  }
}

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

interface ExtraPopulatedTransaction {
  p: PopulatedTransaction;
  sig: string;
}

type Data = {
  deploys: any;
};

export class ProposalContext {
  name: string;

  db: JsonDB;
  deploys: Map<string, () => Promise<BaseContract>>;

  steps: ExtraPopulatedTransaction[];

  constructor(name: string) {
    this.deploys = new Map();
    this.steps = [];
    this.name = name;
    this.db = new JsonDB(
      new Config("./proposals/" + name + ".proposal", true, true, ".")
    );
  }

  addStep(p: PopulatedTransaction, sig: string) {
    this.steps.push({ p, sig });
  }
  populateProposal(): ProposalData {
    const out: ProposalData = {
      targets: [],
      values: [],
      signatures: [],
      calldatas: [],
    };
    for (const av of this.steps) {
      const v = av.p;
      out.calldatas.push(v.data ? "0x" + v.data.substring(10) : "");
      out.signatures.push(av.sig);
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
      await res.wait();
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


