import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Deployment, DeploymentInfo } from "./deployment/deployment";
import {
  CurveMaster__factory,
  OracleMaster__factory,
  ThreeLines0_100__factory,
  UniswapV3OracleRelay__factory,
  VaultController__factory,
} from "../typechain-types";
import { utils, BigNumber } from "ethers";

import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { showBody } from "../util/format";

const { ethers, network, upgrades } = require("hardhat");

async function sleep(milliseconds: number) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if (new Date().getTime() - start > milliseconds) {
      break;
    }
  }
}

//ropsten addresses
const keyAmount = BN("5e5");
let root1: string;
let merkleTree1: MerkleTree;
const initMerkle = async () => {
  const whitelist1 = {
    '0xd37ca44e9c70bc155c0e7ab9c0cc4528f4734b96': '1528400833198551000000',
    '0x71fa3775fe1ad35273eda0c1574a62fe597c358c': '27603239000000000000',
    '0xcfc50541c3deaf725ce738ef87ace2ad778ba0c5': '191838231962388000000000',
    '0xc16414ac1fedfdac4f8a09674d994e1bbb9d7113': '1325464117263954000000',
    '0x432dcbda06e8b296ca29705572d7cb6315ed8bed': '52378064651388530000000',
    '0x391891af67e29d97e61e30c3036a0874f5da411e': '21340862965000000000000',
    '0xe4f8288e2e7eaee5ac51dc8a8270715156544246': '1552564274094652000000',
    '0x31db5f5f9cc510b55c56b595d565b8bbbd0421c2': '1167292828700000000000',
    '0x9776a4a25e08230aa132865d5fce43bc48f0eb18': '821848642300000000000',
    '0xbcbeac56eef250e8a4859be46c6cbfd93aae5d2f': '34934450049999700000000',
    '0x19282e37b5319727501e9577d79dbcdf43803883': '51824948584041900000000',
    '0x9ac6a6b24bcd789fa59a175c0514f33255e1e6d0': '50635383492552130000000',
    '0x81ee46e6b3daf5da90a4b5ee635f610915fff3e2': '82400083790000000000',
    '0xb29cc8a719333d423757fbfc1591fcf13686d8a1': '889279218783355000000',
    '0x32a59b87352e980dd6ab1baf462696d28e63525d': '4470057645900000000000',
    '0x3cbc3bed185b837d79ba18d36a3859ecbcfc3dc8': '212082476110235800000000',
    '0x0988e41c02915fe1befa78c556f946e5f20ffbd3': '205424153000000000000',
    '0x8f2831544eadcc0e0410f50f4f5c8706818be198': '4814038457903653000000',
    '0x30c2c4f2106f12241e3d741ba330658f2f4a3da9': '276487936100000000000',
    '0x3bd58f67bae1c3dacd5d06442c89ef638ca8c8b2': '1304691059487388000000',
    '0x3f7e19951dfe627d839b17c2b515324fc5103af4': '10781868296019500000000',
    '0xcb33844b365c53d3462271cee9b719b6fc8ba06a': '112847886322286300000000',
    '0x0996aed0a897826ce5b92c70fa8a2233254cb8d1': '1484364380000000000000',
    '0x31479f409dee2ec7ecda7f4141f4a75c5e7145a0': '978538379000000000',
    '0x1b7f54f1f77f2b3f58f2e3fc86833f783f05decb': '142331918668532000000',
    '0xf01cc7154e255d20489e091a5aea10bc136696a8': '173145485167011000000',
    '0x19b35dc1bbd0e3c40e4ddc19e098dbb92c223816': '13097405550000000000',
    '0x958892b4a0512b28aaac890fc938868bbd42f064': '29880716716997000000',
    '0x7bd82d87f75dc36f47e3508b6f8e77ca63b16e75': '126981875165070000000',
    '0x060a24a6c7a493d2bc58db7b03bece9e67d2bd53': '4253358120000000',
    '0x478d49e4f016f96510c3aa9428acecb44e7601d2': '25277909140473700000000',
    '0xa53a13a80d72a855481de5211e7654fabdfe3526': '78327727571957500000000',
    '0x0bbf7580e036ea5d69abe679cc90117eec2e3dc1': '2789776147916490000000',
    '0xd3df502ae3e5db05b5dd8a744417a5ad51c11f9b': '8188535647722980000000',
    '0xef764bac8a438e7e498c2e5fccf0f174c3e3f8db': '90089669038959100000000',
    '0x72b7448f470d07222dbf038407cd69cc380683f3': '45857879831425120000000',
    '0x289c23cd7cacafd4bfee6344ef376fa14f1bf42d': '4663689127140970000000',
    '0x882657826c60043cac02d7359743db64932f5c98': '107697997590020000000000',
    '0xe49473c41b98ca7cb69ec79df4986590344397fc': '112504314709878000000',
    '0x91c6f1a3933d465d97236f54d73be8e36405360c': '102070326026477000000',
    '0x8ac5c1cbafc564fbd01ee4b116dea85e6a593ab4': '684020963711863000000',
    '0x07a1f6fc89223c5ebd4e4ddae89ac97629856a0f': '19334559563899000000',
    '0x5853ed4f26a3fcea565b3fbc698bb19cdf6deb85': '385774531436000000',
    '0x931433324e6b0b5b04e3460ef3fb3f78dda3c721': '1628078655616440000000',
    '0xcc2b2295ca9e2b8513d549b54df1d8fb9072f4b1': '29855470613601000000',
    '0x042a135bd342910ad7f67bbda74e3fd4125d1272': '6527302097900830000000',
    '0xb0a4e99371dfb0734f002ae274933b4888f618ef': '4845885021813820000000',
    '0x5cbb52f4ec9d66b39a1a04e185713703ee6c64b8': '52784849942904000000',
    '0x12fb8a80a55ac4a42990c8f2f8df11f3a45e0afd': '94584357793485000000',
    '0xc7a3f400cdde42cf52f240e46ae83d59f3df1303': '1252000000000000000000',
    '0xa5dcec366b04a127d0f4efee183346f25434d648': '10000000000000000000000',
    '0x37114ac674c3efd157968bbc11dc41ce416121b8': '7444000000000000000000',
    '0x503d0b8ece3b4e67997ce51806cf2519d883e996': '60000000000000000000000',
    '0xe6156d93fba1f2387fce5f50f1bb45ef51ed5f2b': '668000000000000000000',
    '0x14bdfda5b5b829f14332a52c15129386284ce36a': '600000000000000000000',
    '0xcd51be3eb3e13d1c144a7fa2536c12a4040a8e29': '4000000000000000000000',
    '0x10d6d2e343281d388291a3e02f3293aaeda67178': '10000000000000000000000',
    '0xc3b3cdd158f8944531f6c302cfb7b5e1b88c0344': '200000000000000000000',
    '0xa92a40457e419c5ec245a646da09112cdcc6cfb6': '2000000000000000000000',
    '0xaf7080022dc6bf068aed0d52949f7b7da00eb992': '6816000000000000000000',
    '0x2215136948eff53e1454c0e6b5833249c20d2bc4': '8000000000000000000000',
    '0x749972809f4a5a5de9615640d8f44dc94fff59fe': '396000000000000000000'
  };

  let list: any[] = []

  let keys = Object.keys(whitelist1)
  let values = Object.values(whitelist1)

  for (let i = 0; i < keys.length; i++) {
    list.push(
      {
        minter: keys[i],
        amount: values[i]
      }
    )
  }


  //showBody(list)
  let leafNodes = list.map((obj) =>
    solidityKeccak256(["address", "uint256"], [obj.minter, obj.amount])
  )
  //showBody("NODES: ", leafNodes)
  let merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
  let root = merkleTree.getHexRoot()

  showBody("ROOT: ", root)

};

async function main() {
  await initMerkle();
  /**
     console.log(root1);
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const account = "0x50818e936aB61377A18bCAEc0f1C32cA27E38923";
  
    let leaf = solidityKeccak256(["address", "uint256"], [account, keyAmount]);
    let proof = merkleTree1.getHexProof(leaf);
    console.log(proof);
   */
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
