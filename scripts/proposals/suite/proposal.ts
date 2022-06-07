import { BaseContract, Signer } from "ethers";

import { Low, JSONFile } from "lowdb";

export interface ProposalContext {
  PreProposal: (x: Signer) => PromiseLike<any>;
  Proposal: (x: Signer) => PromiseLike<any>;
}

type Data = {
  deploys: any;
};

export class ProposalContext {
  name: string;

  db: Low<Data>;
  deploys: Map<string, () => Promise<BaseContract>>;

  constructor(name: string) {
    this.deploys = new Map();
    this.name = name;
    const adapter = new JSONFile<Data>("./proposals/" + name + ".proposal");
    this.db = new Low<Data>(adapter);
  }

  AddDeploy(name: string, deployment: () => Promise<BaseContract>) {
    this.deploys.set(name, deployment);
  }

  async DeployAll() {
    await this.db.read();
    this.db.data ||= { deploys: {} };
    this.deploys.forEach(async (v, k) => {
      const dbv = this.db.data!.deploys[k];
      if (dbv === undefined) {
        await v()
          .then((x) => {
            this.db.data!.deploys[k] = x.address;
          })
          .catch((e) => {
            console.log(`failed to deploy ${k}, ${e}`);
          });
        await this.db.read();
      }
    });
  }
}
