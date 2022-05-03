import { BigNumberish } from "ethers";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import MerkleTree from "merkletreejs";
import { BigFromN } from "./stringn";
import { BN } from "./number";

//import merkleWallets from "../test/data/data.json";

const merkleWallets = require("../test/data/data.json")

const hashFn = (data: string) => keccak256(data).slice(2);


export const createTree = (): MerkleTree => {
  const elements = Object.entries(merkleWallets).map(([account, balance]) =>
    solidityKeccak256(
      ["address", "uint256"],
      [account, BN(balance).div(BN("1e9")).toString()]
    )
  );
  const tree = new MerkleTree(elements, hashFn, { sort: true });
  return tree;
};


export const treeFromAccount = (accounts: string[]): MerkleTree => {
  const elements = accounts.map(x => solidityKeccak256(["address"], [x]))
  const tree = new MerkleTree(elements, hashFn, { sort: true });
  return tree;
}


export const treeFromObject = (obj: any): MerkleTree => {
  const elements = Object.entries(obj).map(([account, balance]) =>
    solidityKeccak256(
      ["address", "uint256"],
      [
        account,
        BigFromN(balance as any)
          .div(BigFromN("1e9"))
          .toString(),
      ]
    )
  );
  const tree = new MerkleTree(elements, hashFn, { sort: true });
  return tree;
};

export const getAccountProof = (
  tree: MerkleTree,
  account: string,
  amount: BigNumberish
) => {
  const element = solidityKeccak256(
    ["address", "uint256"],
    [account, amount.toString()]
  );
  return tree.getHexProof(element);
};



/**
 const sortObject = (o: any) =>
  Object.keys(o)
    .sort()
    .reduce((r, k) => (((r as any)[k] = o[k]), r), {});
const main = async () => {
  const startBlock = 13646000;

  const combined: any = {};
  for (const [id, amt] of Object.entries(tribeHolders)) {
    if (combined[id] == undefined) {
      combined[id] = BigNumber.from(0);
    }
    combined[id] = combined[id].add(amt);
  }

  for (const [id, amt] of Object.entries(univ2Holders)) {
    if (combined[id] == undefined) {
      combined[id] = BigNumber.from(0);
    }
    combined[id] = combined[id].add(amt);
  }

  for (const [id, amt] of Object.entries(ftribeHolders)) {
    if (combined[id] == undefined) {
      combined[id] = BigNumber.from(0);
    }
    combined[id] = combined[id].add(amt);
  }
  const tree = treeFromObject(combined);
  for (const [id, amt] of Object.entries(sortObject(combined))) {
    combined[id] = combined[id].toString();
  }
  const checkinfo = {
    root: tree.getHexRoot(),
    total_holders: Object.entries(combined).length,
    run_at: new Date(),
    run_by: os.userInfo(),
  };
  fs.writeFileSync(
    "merkle/8_final_tribe_credits.json",
    JSON.stringify(combined)
  );
  console.log("finished job 8");
  console.log(checkinfo);
  fs.writeFileSync("merkle/8_merkle_tree.json", JSON.stringify(checkinfo));
  process.exit(0);
};

main().then(console.log).catch(console.log);
 */
