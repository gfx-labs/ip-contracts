import Decimal from "decimal.js";
import { BigNumber } from "ethers";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { readFileSync } from "fs";
import MerkleTree from "merkletreejs";



const main = async ()=>{
  const csvData = readFileSync("./rewardtree/week_1_7.csv", "utf-8")
  const strdat = csvData.toString()
  const rows = strdat.split("\r\n")
  const obj:any = {}
  for(const row of rows) {
    const splt = row.split(",")
    console.log(row)
    if(splt.length < 2) {
      if(row != "") {
        console.log("ERROR READING ROW", row)
      }
      continue
    }
    if(splt[0] == '') {
      continue
    }
    let a = splt[0]
    a = "0x"+a.substring(a.indexOf("0x")+2).toLowerCase()
    console.log(a)
    if(obj[a] == undefined) {
      obj[a] = BigNumber.from(0)
    }
    obj[a] = obj[a].add(new Decimal(splt[1]).mul(new Decimal(10).pow(18)).toHex())
  }
  for(const k of Object.keys(obj)) {
    obj[k] = obj[k].toString()
  }
  let leafNodes = Object.entries(obj).map(([addr, amount]:[string, any]) =>{
    //addr = addr.replaceAll("0x","")
    return solidityKeccak256(["address", "uint256"], [ addr,amount])
  });
  const merkleTree1 = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  const root = merkleTree1.getHexRoot()
  console.log(obj)

  console.log(`Generated Merkle Tree


              leaf nodes: ${leafNodes}

              root hex: ${root}

              now validating...
              `)
    for(const [addr, amount] of Object.entries(obj)) {
      const key = solidityKeccak256(["address", "uint256"], [addr ,amount])
      const proof = merkleTree1.getProof(key)
      let verified = merkleTree1.verify(proof, key ,root)
      if(verified == false) {
        console.log("failed validation for", addr, amount)
      }
    }
    console.log("validation done. If no failures, then passed")

}

main().then(console.log).catch(console.log)

// Convert a hex string to a byte array
function hexToBytes(hex:any):any {
  hex = hex.replaceAll("0x","")
    for (var bytes = [], c = 0; c < hex.length; c += 2) {
        bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return bytes;
}

// Convert a byte array to a hex string
function bytesToHex(bytes: any):any {
    for (var hex = [], i = 0; i < bytes.length; i++) {
        var current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
        hex.push((current >>> 4).toString(16));
        hex.push((current & 0xF).toString(16));
    }
    return hex.join("");
}
