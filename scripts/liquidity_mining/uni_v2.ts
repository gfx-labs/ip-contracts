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
dotenv.config();

const POLYGON_POOL = "0x203c05ACb6FC02F5fA31bd7bE371E7B213e59Ff7";
const rpc_url = process.env.POLYGON_URL;

const main = async () => {
  const cl = new AlchemyWebSocketProvider(137, rpc_url);
  const tk = ERC20Detailed__factory.connect(POLYGON_POOL, cl);
  const blockStart = 29130325 - 100;
  const blockEnd = 29130325;

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

  let blocks = 0;
  for (let b = blockStart; b <= blockEnd; b++) {
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

    const resp = await mc.call([
      {
        reference: "balance",
        contractAddress: tk.address,
        abi: ERC20Detailed__factory.abi,
        calls: addrCalls,
      },
    ]);
    const holderBal = resp.results.balance.callsReturnContext.map((x) => {
      return {
        holder: x.reference,
        val: new Decimal(x.returnValues[0].hex),
      };
    });
    let totalBal = new Decimal(0);
    holderBal.forEach((x) => {
      totalBal = totalBal.add(x.val);
    });

    holderBal.forEach((x) => {
      if (!totalBalances.has(x.holder)) {
        totalBalances.set(x.holder, new Decimal(0));
      }
      totalBalances.set(
        x.holder,
        totalBalances.get(x.holder)!.add(x.val.div(totalBal))
      );
      totalBalance = totalBalance.add(x.val);
    });
    console.log(`block ${b} done, ${blockEnd - b} to go`);
  }
  const totals = Array.from(totalBalances.entries()).map(([k, v]) => {
    return {
      minter: k,
      share: v.div(blocks),
    };
  });
  console.log(
    totals
      .filter((x) => {
        return x.share.gt(0);
      })
      .map((v) => {
        return {
          minter: v.minter,
          amount: v.share.mul(BlockRounds.rewardForBorrower),
        };
      })
  );
};

main().then(console.log);
