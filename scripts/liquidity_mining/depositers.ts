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
import { BigNumber } from "ethers";
import { BN } from "../../util/number";
import Decimal from "decimal.js";
import { BlockRounds } from "./q3_data";
import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import { sleep } from "../proposals/suite/proposal";

const GENESIS_BLOCK = 14936125

const threshold = BN("1e18")

dotenv.config();

const rpc_url =  "https://mainnet.rpc.gfx.xyz/"//"https://brilliant.staging.gfx.town"

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

  const blacklist: string[] = [
    "0x0000000000000000000000000000000000000000",
    "0x63594b2011a0f2616586bf3eef8096d42272f916", //curve pool
    "0x63aac74200ba1737f81beeaeda64a539d9883922", //uni pool
    "0x266d1020a84b9e8b0ed320831838152075f8c4ca", //gov
    "0x9008d19f58aabd9ed0d60971565aa8510560ab41", //cow
    "0x818e9ae6b8355b17e3a221351e67b6f2cf803ce0", //yearn strat
  ]

  const cl = new ethers.providers.WebSocketProvider(rpc_url)
  //const cl = new ethers.providers.JsonRpcProvider(rpc_url)
  const tk = IUSDI__factory.connect(USDI_ADDR, cl);
  //const blockEnd = 15346983;
  //const blockStart = blockEnd - 1000;

  const vc = IVaultController__factory.connect(
    "0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3",
    cl
  );

  const weekNum = 3
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
  })
  console.log("Total USDI holders: ", addrs.length)
  let filteredAddrs: string[] = []

  for (let h = 0; h < addrs.length; h++) {

    let balance = await tk.balanceOf(addrs[h], { blockTag: blockStart })
    if (balance! < threshold) {
      //remove addrs from blacklist
      if (!blacklist.includes(addrs[h])) {
        filteredAddrs.push(addrs[h])
      }else {
        console.log("Filtered: ", addrs[h])
      }
    }
  }
  console.log("Filtered USDI holders: ", filteredAddrs.length)

  //gather the blocks in the range that have a transfer or interest event
  //first entry should be blockStart and last should be blockEnd
  const usedBlocks: number[] = [blockStart];

  //first add the interest event blocks, these are already in the range per the query
  for (let i = 0; i < vcFiltered.length; i++) {
    usedBlocks.push(vcFiltered[i].blockNumber)
  }

  //next add the transfers that happen after block start and are not also interest event blocks
  for (let i = 0; i < TotalUsdiTransfers.length; i++) {
    if ((TotalUsdiTransfers[i].blockNumber > blockStart) && !usedBlocks.includes(TotalUsdiTransfers[i].blockNumber)) {
      usedBlocks.push(TotalUsdiTransfers[i].blockNumber)
    }
  }

  console.log("Blocks in the range that include a transfer or an Interest Event: ", usedBlocks.length)

  //add filler blocks to improve data accuracy 
  for (let j = 0; j < 500; j++) {
    let R = (Math.floor(Math.random() * (blockEnd - blockStart))) + blockStart
    if (!usedBlocks.includes(R)) {
      usedBlocks.push(R)
    }
  }

  console.log(`Gathering data for ${usedBlocks.length} blocks`)

  let blocks = 0;

  for (let b = 0; b <= usedBlocks.length; b++) {


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
      ]);
    } catch (e: any) {
      console.log("error", e, "SKIPPING BLOCK", b)
      continue
    }
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

    console.log(`Block ${usedBlocks[b]} done, ${usedBlocks.length - b} to go`, totalBal.div(1e9).div(1e9));
  }

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
