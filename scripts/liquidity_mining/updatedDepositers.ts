import { VaultController__factory } from "../../typechain-types/factories/lending/VaultController__factory";
import * as dotenv from "dotenv";
import { AlchemyWebSocketProvider } from "@ethersproject/providers";
import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from "ethereum-multicall";
import { CallContext } from "ethereum-multicall/dist/esm/models";
import { ERC20Detailed__factory, IUSDI__factory, IVaultController__factory, Vault__factory } from "../../typechain-types";
import { BigNumber, utils } from "ethers";
import { BN } from "../../util/number";
import Decimal from "decimal.js";
import { BlockRounds } from "./q4_data";
import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import { sleep } from "../proposals/suite/proposal";
import { toNumber } from "../../util/math";

const GENESIS_BLOCK = 14936125

const threshold = BN("1e18")

dotenv.config();

//const rpc_url =  "https://brilliant.staging.gfx.town" //s"https://mainnet.rpc.gfx.xyz/"//
const rpc_url = process.env.MAINNET_URL

const USDI_ADDR = "0x2A54bA2964C8Cd459Dc568853F79813a60761B58"

/**
 * PLAN
 * Get all addrs that have ever held USDI
 * Remove all holders whose balance is 0 || less than some threshold (1 USDI) at the startBlock
 * Remove blacklisted addrs
 * Include all blocks that have a transfer of USDI or Interest Event + ~100 random filler blocks all within the block range
 * Profit??
 */

const main = async () => {
  console.log("URL: ", rpc_url)


  const blacklist: string[] = [
    "0x0000000000000000000000000000000000000000",
    "0x63594b2011a0f2616586bf3eef8096d42272f916", //curve pool
    "0x63aac74200ba1737f81beeaeda64a539d9883922", //uni pool
    "0x266d1020a84b9e8b0ed320831838152075f8c4ca", //gov
    "0x9008d19f58aabd9ed0d60971565aa8510560ab41", //cow
    "0x818e9ae6b8355b17e3a221351e67b6f2cf803ce0", //yearn strat
    "0xa6e8772af29b29B9202a073f8E36f447689BEef6"  //gfx labs
  ]

  const formatBlacklist = blacklist.map(function (x) { return x.toUpperCase() })

  //onsole.log("Format: ", formatBlacklist)



  const cl = new ethers.providers.WebSocketProvider(rpc_url!)
  //const cl = new ethers.providers.JsonRpcProvider(rpc_url)
  const tk = IUSDI__factory.connect(USDI_ADDR, cl);
  //const blockEnd = 15346983;
  //const blockStart = blockEnd - 1000;

  const vc = IVaultController__factory.connect(
    "0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3",
    cl
  );

  const weekNum = 1
  const week = BlockRounds.blockRanges[weekNum]

  const blockStart = week.start
  const blockEnd = week.end
  const totalBalances = new Map<string, Decimal>();
  let totalBalance = new Decimal(0);
  let addrs: string[] = ["0x50818e936aB61377A18bCAEc0f1C32cA27E38923"];
  const mc = new Multicall({ ethersProvider: cl });

  const transferFilter = tk.filters.Transfer(null, null, null)
  const interestFilter = vc.filters.InterestEvent(null, null, null)

  console.log("Block start: ", blockStart)
  console.log("Block end: ", blockEnd)

  const TotalUsdiTransfers = await tk.queryFilter(transferFilter, GENESIS_BLOCK, blockEnd)
  const vcFiltered = await vc.queryFilter(interestFilter, blockStart, blockEnd)
  console.log("Interest events found in the block range: ", vcFiltered.length)

  TotalUsdiTransfers.map((x) => {
    if (!addrs.includes(x.args[1])) {
      addrs.push(x.args[1]);
    }
    if (!addrs.includes(x.args[0])) {
      addrs.push(x.args[0]);
    }
  })
  console.log("Total USDI holders: ", addrs.length)
  let filteredAddrs: string[] = []

  for (let h = 0; h < addrs.length; h++) {
    if (formatBlacklist.includes(addrs[h].toUpperCase())) {
      console.log("Filtered: ", addrs[h])
    } else {
      filteredAddrs.push(addrs[h])
    }
  }
  //    let balance = await tk.balanceOf(addrs[h], { blockTag: blockStart })


  console.log("Filtered USDI holders: ", filteredAddrs.length)



  const runBlock = async (block: number) => {
    const addrCalls: CallContext[] = [];
    for (let addr of filteredAddrs) {
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
      ], { blockNumber: block });
    } catch (e: any) {
      console.log("error", e, "SKIPPING BLOCK", block)
      return
    }
    //console.log("RESPONSE: ", resp.blockNumber)
    const holderBal = resp.results.balance.callsReturnContext.map((x: any) => {
      return {
        holder: x.reference,
        val: new Decimal(x.returnValues[0].hex),
      };
    });
    let totalBal = new Decimal(0);
    holderBal.forEach((x: any) => {
      totalBal = totalBal.add(x.val);
    });

    holderBal.forEach((x: any) => {
      if (!totalBalances.has(x.holder)) {
        totalBalances.set(x.holder, new Decimal(0));
      }
      totalBalances.set(
        x.holder,
        totalBalances.get(x.holder)!.add(x.val.div(totalBal))
      );
      totalBalance = totalBalance.add(x.val);
    });
    blocks = blocks + 1;

    console.log(`Block ${block} done, ${blocks/(blockEnd-blockStart)}`, totalBal.div(1e9).div(1e9));
  }



  let pms = []
  let blocks = 0;
  let idx = 0
  console.log("LOOPING: : : ")
  for (let b = blockStart; b <= blockEnd; b++) {
    //console.log("Running block: ", b);
    let pm = runBlock(b)
    pms.push(pm)
    idx = idx + 1
    if (idx % 25 == 0) {
      //console.log("Loop 500")
      await Promise.all(pms)
      pms = []
    }
  }
  await Promise.all(pms)

  const totals = Array.from(totalBalances.entries()).map(([k, v]) => {
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
        amount: v.share.mul(BlockRounds.rewardForLender).mul(extra),
      };
    })
  //console.log(treeJson)
  writeFileSync(`rewardtree/lenders_${blockStart}-${blockEnd}.json`, JSON.stringify(treeJson), 'utf8');

  console.log("DONE")
  process.exit()
};


main()
