
import { utils } from "ethers";
import { mergeLists } from "../../util/math"
import { writeFileSync } from "fs";

const LPS = require('../../rewardtree/lenders_17149390-17199373')
const BORROWERS = require('../../rewardtree/borrowers_17149390-17199373')


//for format minter:amount  ===>> {minter: minter, amount: amount}
const prepareList = async (list: any) => {

    let LIST: any[] = []


    for (let i = 0; i < list.length; i++) {

        const ZERO = "0x0000000000000000000000000000000000000000"

        if (list[i].minter != ZERO) {
            LIST.push(
                {
                    minter: list[i].minter,
                    amount: Number(list[i].amount)
                }
            )
        }



    }

    return LIST


}

//LPS: JSON, borrowers: JSON
async function main() {

    let formatLPS = await prepareList(LPS)

    let formatBORROW = await prepareList(BORROWERS)


    let mergedList = await mergeLists(formatBORROW, formatLPS)

    let valueAdjusted: any[] = []

    for (let minter of mergedList) {

        //console.log(minter.amount.toString())


        valueAdjusted.push({
            minter: minter.minter,
            amount: utils.parseEther(minter.amount.toFixed(18).toString()).toString()
        })

    }

    //console.log(valueAdjusted)

    let formatObject: Record<string, string> = {}


    for (const object of valueAdjusted) {
        formatObject[object.minter] = object.amount
    }

    writeFileSync(`rewardtree/mergedAndFormatWeek45.json`, JSON.stringify(valueAdjusted), 'utf8')
    writeFileSync(`rewardtree/week45Object.json`, JSON.stringify(formatObject), 'utf8')

    console.log("DONE")

}



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
