import { VaultController__factory } from "../../typechain-types/factories/lending/VaultController__factory";
import * as dotenv from "dotenv";
import { AlchemyWebSocketProvider } from "@ethersproject/providers";
import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from "ethereum-multicall";
import { CallContext } from "ethereum-multicall/dist/esm/models";
import { ERC20Detailed__factory, Vault__factory } from "../../typechain-types";
import { BigNumber } from "ethers";
import { BN } from "../../util/number";
import Decimal from "decimal.js";
import { BlockRounds } from "./q1_data";
import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import { sleep } from "../proposals/suite/proposal";

dotenv.config();

//const POLYGON_POOL = "0x203c05ACb6FC02F5fA31bd7bE371E7B213e59Ff7";
const POOL = "0x63aac74200ba1737f81beeaeda64a539d9883922"
const rpc_url = process.env.ALCHEMY_API

const main = async () => {

  const cl = new AlchemyWebSocketProvider(1, rpc_url);
  //const cl = new ethers.providers.JsonRpcProvider(rpc_url)
  const tk = ERC20Detailed__factory.connect(POOL, cl);


  let weekNum = 0
  for(const week of BlockRounds.blockRanges) {
    weekNum = weekNum + 1
    if(weekNum == 1){
      continue
    }
    const   blockStart = week.start
    const   blockEnd = week.end
    const totalBalances = new Map<string, Decimal>();
    let totalBalance = new Decimal(0);

    const addrs: string[] = ["0x50818e936aB61377A18bCAEc0f1C32cA27E38923"];
    const mc = new Multicall({ ethersProvider: cl });
    (
      await tk.queryFilter(
        tk.filters["Transfer(address,address,uint256)"](
          undefined,
          undefined,
          undefined
        )
      )
    ).map((x) => {
      if (!addrs.includes(x.args[1])) {
        addrs.push(x.args[1]);
      }
    });

    console.log(blockStart, blockEnd)
    let blocks = 0;
    for (let b = (blockStart+30000); b <= blockEnd; b++) {
      const addrCalls: CallContext[] = [];
      const liabilityCalls: CallContext[] = [];
      const addrCallContext: ContractCallContext[] = [];
      blocks = blocks + 1;
      for (let addr of addrs) {
        addrCalls.push({
          reference: addr,
          methodName: "balanceOf",
          methodParameters: [addr],
        });
      }

      let resp: any
      try {
        resp = await mc.call([
          {
            reference: "balance",
            contractAddress: tk.address,
            abi: ERC20Detailed__factory.abi,
            calls: addrCalls,
          },
        ], {blockNumber: b.toString()});
      }catch(e:any){
        console.log("error",e,"SKIPPING BLOCK", b)
        continue
      }
      const holderBal = resp.results.balance.callsReturnContext.map((x:any) => {
        return {
          holder: x.reference,
          val: new Decimal(x.returnValues[0].hex),
        };
      });
      let totalBal = new Decimal(0);
      holderBal.forEach((x:any) => {
        totalBal = totalBal.add(x.val);
      });

      holderBal.forEach((x:any) => {
        if (!totalBalances.has(x.holder)) {
          totalBalances.set(x.holder, new Decimal(0));
        }
        totalBalances.set(
          x.holder,
          totalBalances.get(x.holder)!.add(x.val.div(totalBal))
        );
        totalBalance = totalBalance.add(x.val);
      });
      console.log(`block ${b} done, ${blockEnd - b} to go`, totalBal.div(1e9).div(1e9));
      console.log(totalBalances)
    }
    const totals = Array.from(totalBalances.entries()).map(([k, v]) => {
      return {
        minter: k,
        share: v.div(blocks),
      };
    });
    let treeJson =  totals
    .filter((x) => {
      return x.share.gt(0);
    })
    .map((v) => {
      let extra = 1
      if(weekNum == 1) {
        extra = 7
      }
      return {
        minter: v.minter,
        amount: v.share.mul(BlockRounds.rewardForLM).mul(extra),
      };
    })
    console.log(treeJson)
    writeFileSync(`rewardtree/lps_${blockStart}-${blockEnd}.json`, JSON.stringify(treeJson), 'utf8');
  };
};

main().then(console.log);
