import { BigNumber } from "ethers";

export const showLine = (...data: any) => {
    let mut = data;

    for (let i = 0; i < mut.length; i++) {
        let temp = mut[i];
        if (BigNumber.isBigNumber(mut[i])) {
            mut[i] = addCommas((temp as BigNumber).toString());
            continue;
        }
        if (typeof temp === "number") {
            mut[i] = addCommas(temp.toString());
            continue;
        }
    }
    console.log(...mut);
};
export const showHeader = (...data: any) => {
    console.log("");
    showLine("    .->", ...data);
};
export const showBody = (...data: any) => {
    showLine("    ↓  ", ...data);
};

const addCommas = (x: string) => {
    let val = x.split(".")
    let nx = val[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (val.length == 1) {
        return nx
    }
    return nx + "." + val[1]
};
