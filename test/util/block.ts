import { network } from "hardhat";

export const advanceBlockHeight = async (blocks: number) => {
  const txns = [];
  for (let i = 0; i < blocks; i++) {
    txns.push(network.provider.send("evm_mine"));
  }
  await Promise.all(txns);
};

export const fastForward = async (time: number) => {
  return network.provider.request({
    method: "evm_increaseTime",
    params: [time],
  });
};
