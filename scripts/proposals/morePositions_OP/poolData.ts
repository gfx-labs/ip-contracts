import { BigNumber } from "ethers"
import { od } from "../../../util/addresser"

type poolData = {
    addr: string,
    oracle0: string,
    oracle1: string
}

export type ExactInputSingleParams = {
    tokenIn: string,
    tokenOut: string,
    fee: number,
    recipient: string,
    deadline: number,
    amountIn: BigNumber,
    amountOutMinimum: BigNumber,
    sqrtPriceLimitX96: BigNumber
}

const wethOp3000: poolData = {
    addr: "0x68F5C0A2DE713a54991E01858Fd27a3832401849",
    oracle0: od.EthOracle,
    oracle1: od.OpOracle
}
const wstethWeth100: poolData = {
    addr: "0x04F6C85A1B00F6D9B75f91FD23835974Cc07E65c",
    oracle0: od.wstEthOracle,
    oracle1: od.EthOracle
}
const usdcWeth500: poolData = {
    addr: "0x1fb3cf6e48F1E7B10213E7b6d87D4c073C7Fdb7b",
    oracle0: od.UsdcStandardRelay,
    oracle1: od.EthOracle
}
const wethOp500: poolData = {
    addr: "0xFC1f3296458F9b2a27a0B91dd7681C4020E09D05",
    oracle0: od.EthOracle,
    oracle1: od.OpOracle
}
const wethSnx3000: poolData = {
    addr: "0x0392b358CE4547601BEFa962680BedE836606ae2",//not verrified
    oracle0: od.EthOracle,
    oracle1: od.SnxOracle//double check token0/token1? 
}
const wethWBTC500: poolData = {
    addr: "0x85c31ffa3706d1cce9d525a00f1c7d4a2911754c",//not verrified
    oracle0: od.EthOracle,
    oracle1: od.wbtcOracleScaler//double check token0/token1? 
}
const wethUSDC3000: poolData = {
    addr: "0xB589969D38CE76D3d7AA319De7133bC9755fD840",//not verrified
    oracle0: od.EthOracle,
    oracle1: od.UsdcStandardRelay
}

export const listings: poolData[] = [
    wethOp3000,
    wstethWeth100,
    usdcWeth500,
    wethOp500,
    wethSnx3000,
    wethWBTC500,
    wethUSDC3000
]

