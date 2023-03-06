import { VaultController__factory } from "../../typechain-types/factories/lending/VaultController__factory";
import * as dotenv from "dotenv";
import {
  Multicall,
  ContractCallContext,
} from "ethereum-multicall";
import { CallContext } from "ethereum-multicall/dist/esm/models";
import { IVaultController__factory, Vault__factory } from "../../typechain-types";
import Decimal from "decimal.js";
import { BlockRounds } from "./q3_data";

import { utils, BigNumber } from "ethers";

import { writeFileSync } from "fs";
import { sleep } from "../proposals/suite/proposal";
import { AlchemyWebSocketProvider } from "@ethersproject/providers";
import { ethers } from "hardhat";
dotenv.config();

//const rpc_url = process.env.MAINNET_URL
const rpc_url = "https://mainnet.rpc.gfx.xyz/" //"https://brilliant.staging.gfx.town"
const main = async () => {

  //const cl = new AlchemyWebSocketProvider(1, rpc_url!);
  const cl = new ethers.providers.JsonRpcProvider(rpc_url!)
  //const cl = new ethers.providers.WebSocketProvider(rpc_url)
  const vc = IVaultController__factory.connect(
    "0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3",
    cl
  );

  const vaultCount = await vc.vaultsMinted();

  const mc = new Multicall({ ethersProvider: cl });

  const addrCalls: CallContext[] = [];
  for (let i = 1; i <= vaultCount.toNumber(); i++) {
    addrCalls.push({
      reference: i.toString(),
      methodName: "vaultAddress",
      methodParameters: [i],
    });
  }

  const idCallContext: ContractCallContext[] = [
    {
      reference: "address",
      contractAddress: vc.address,
      abi: VaultController__factory.abi,
      calls: addrCalls,
    },
  ];

  const ans = await mc.call(idCallContext);
  const addrs = ans.results.address.callsReturnContext.map(
    (x) => x.returnValues[0]
  );

  const addrCallContext: ContractCallContext[] = [];
  for (let addr of addrs) {
    addrCallContext.push({
      reference: addr,
      contractAddress: addr,
      abi: Vault__factory.abi,
      calls: [
        {
          reference: "minter",
          methodName: "minter",
          methodParameters: [],
        },
      ],
    });
  }

  const minters = Object.entries(
    (await mc.call(addrCallContext)).results
  ).map(([k, v]) => {
    return v.callsReturnContext[0].returnValues[0];
  });


  //const weekNum = 1
  const weekNum = 10
  for (const week of [BlockRounds.blockRanges[weekNum]]) {
    //weekNum = weekNum + 1
    const blockStart = week.start
    const blockEnd = week.end
    const totalLiabilities = new Map<string, Decimal>();
    const usedBlocks: number[] = [blockStart];
//   const filter = vc.filters.InterestEvent(null, null, null)
//  const filtered = await vc.queryFilter(filter, blockStart, blockEnd)
//  console.log("Interest Events found: ", filtered.length)
//  for (let i = 0; i < filtered.length; i++) {
//    usedBlocks.push(filtered[i].blockNumber)
//  }
//  //need more blocks to make the values more accurate, 100 random filler blocks
//  for (let j = 0; j < 200; j++) {
//    let R = (Math.floor(Math.random() * (blockEnd - blockStart))) + blockStart
//    if (!usedBlocks.includes(R)) {
//      usedBlocks.push(R)
//    }
//  }
//  usedBlocks.push(blockEnd)
    const runBlock = async (block:number)=> {
      let summaries;
      try {
        const vaultCount = await vc.vaultsMinted({ blockTag: block });
        summaries = await vc.vaultSummaries(1, vaultCount, { blockTag: block })
      } catch (e) {
        console.log("ERROR ON BLOCK", block, e)
        return
      }

      let totalMinted = new Decimal(0);
      //get vault liability relative to total for this block
      //calculate total for all vaults each block?
      summaries.forEach((v) => {
        let val = new Decimal(v.vaultLiability.toString());
        totalMinted = totalMinted.add(val);
      });
      summaries.forEach((v, idx) => {
        let minter = minters[idx];
        let val = new Decimal(v.vaultLiability.toString());
        if (!totalLiabilities.has(minter)) {
          totalLiabilities.set(minter, new Decimal(0));
        }
        totalLiabilities.set(
          minter,
          totalLiabilities.get(minter)!.add(val.div(totalMinted))
        );
      });
      blocks = blocks + 1;
      console.log(`Block ${block} done, ${blocks/(blockEnd-blockStart)}`, totalMinted.div(1e9).div(1e9));
    }


    let pms  = []
    let blocks = 0;
    let idx = 0
    for (let b = blockStart; b <= blockEnd; b++) {
      let pm = runBlock(b)
      pms.push(pm)
      idx = idx + 1
      if(idx % 1000 ==  0) {
        await Promise.all(pms)
        pms = []
      }
    }//end main loop
    await Promise.all(pms)

    //calc totals
    const totals = Array.from(totalLiabilities.entries()).map(([k, v]) => {
      return {
        minter: k,
        share: v.div(blocks),
      };
    });
    let treeJson = totals
      .filter((x) => {
        return x.share.gt(0);
      })
      .map((v) => {
        let extra = 1
        return {
          minter: v.minter,
          amount: v.share.mul(BlockRounds.rewardForBorrower).mul(extra),
        };
      })
    //console.log("done with block range", blockStart, blockEnd)
    //console.log(treeJson)
    console.log(treeJson.length, " total minters")
    writeFileSync(`rewardtree/borrowers_${blockStart}-${blockEnd}.json`, JSON.stringify(treeJson), 'utf8');

  };

}// all done

main()
