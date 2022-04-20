import { s } from "../mainnet/scope";
import { BigNumber, Event, utils } from "ethers";


export const BN = (a: any): BigNumber => {
    
    return BigNumber.from(a)
}