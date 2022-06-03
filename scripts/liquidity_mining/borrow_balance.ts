import { VaultController__factory } from "../../typechain-types/factories/lending/VaultController__factory";
import * as dotenv from "dotenv";
import { AlchemyWebSocketProvider } from "@ethersproject/providers";
import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from "ethereum-multicall";
import { CallContext } from "ethereum-multicall/dist/esm/models";
import { Vault__factory } from "../../typechain-types";
import { BigNumber } from "ethers";
import { BN } from "../../util/number";
import Decimal from "decimal.js";
dotenv.config();

const rpc_url = process.env.POLYGON_URL;

const main = async () => {
  const cl = new AlchemyWebSocketProvider(137, rpc_url);
  const vc = VaultController__factory.connect(
    "0x385E2C6b5777Bc5ED960508E774E4807DDe6618c",
    cl
  );
  const blockStart = 29130325 - 1000;
  const blockEnd = 29130325;

  const totalLiabilities = new Map<string, Decimal>();
  let totalLiability = new Decimal(0);
  const vaultCount = await vc.vaultsMinted();

  const mc = new Multicall({ ethersProvider: cl });

  for (let b = blockStart; b <= blockEnd; b++) {
    const addrCalls: CallContext[] = [];
    const liabilityCalls: CallContext[] = [];
    for (let i = 1; i <= vaultCount.toNumber(); i++) {
      liabilityCalls.push({
        reference: i.toString(),
        methodName: "vaultLiability",
        methodParameters: [i],
      });
    }
    for (let i = 1; i <= vaultCount.toNumber(); i++) {
      addrCalls.push({
        reference: i.toString(),
        methodName: "vaultAddress",
        methodParameters: [i],
      });
    }
    const idCallContext: ContractCallContext[] = [
      {
        reference: "lib",
        contractAddress: vc.address,
        abi: VaultController__factory.abi,
        calls: liabilityCalls,
      },
      {
        reference: "address",
        contractAddress: vc.address,
        abi: VaultController__factory.abi,
        calls: addrCalls,
      },
    ];
    const ans = await mc.call(idCallContext);
    const vals = ans.results.lib.callsReturnContext.map((x) => {
      return new Decimal(x.returnValues[0].hex).div(1e12);
    });
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
    addrs.forEach((v, i) => {
      let minter = minters[i];
      let val = vals[i];
      if (!totalLiabilities.has(minter)) {
        totalLiabilities.set(minter, new Decimal(0));
      }
      totalLiabilities.set(
        minter,
        totalLiabilities.get(minter)!.add(val.toString())
      );
      totalLiability = totalLiability.add(val);
    });
    console.log(`block ${b} done, ${blockEnd - b} to go`);
  }
  const totals = Array.from(totalLiabilities.entries()).map(([k, v]) => {
    return {
      minter: k,
      share: v.div(totalLiability),
    };
  });
  console.log(
    totals.filter((x) => {
      return x.share.gt(0);
    })
  );
};

main().then(console.log);
