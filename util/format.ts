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
export const showBodyCyan = (...data: any) => {
    showLine('\x1b[36m',"   ↓  ", ...data, '\x1b[0m');

    /**
        Reset = "\x1b[0m"
        Bright = "\x1b[1m"
        Dim = "\x1b[2m"
        Underscore = "\x1b[4m"
        Blink = "\x1b[5m"
        Reverse = "\x1b[7m"
        Hidden = "\x1b[8m"

        FgBlack = "\x1b[30m"
        FgRed = "\x1b[31m"
        FgGreen = "\x1b[32m"
        FgYellow = "\x1b[33m"
        FgBlue = "\x1b[34m"
        FgMagenta = "\x1b[35m"
        FgCyan = "\x1b[36m"
        FgWhite = "\x1b[37m"

        BgBlack = "\x1b[40m"
        BgRed = "\x1b[41m"
        BgGreen = "\x1b[42m"
        BgYellow = "\x1b[43m"
        BgBlue = "\x1b[44m"
        BgMagenta = "\x1b[45m"
        BgCyan = "\x1b[46m"
        BgWhite = "\x1b[47m"
     */
};

const addCommas = (x: string) => {
    let val = x.split(".")
    let nx = val[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (val.length == 1) {
        return nx
    }
    return nx + "." + val[1]
};
