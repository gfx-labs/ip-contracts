import { network } from "hardhat";

export const advanceBlockHeight = async (blocks: number) => {
    for (let i = 0; i < blocks; i++) {
        await network.provider.send("evm_mine")
    }
    return
};

export const fastForward = async (time: number) => {
    await network.provider.request({
        method: "evm_increaseTime",
        params: [time],
    })
    return
};

export const mineBlock = async () => {
    await fastForward(15)
    await advanceBlockHeight(1)
    return
}

export const OneYear = 60 * 60 * 24 * 365.25
export const OneWeek = 60 * 60 * 24 * 7;
export const OneDay = 60 * 60 * 24;