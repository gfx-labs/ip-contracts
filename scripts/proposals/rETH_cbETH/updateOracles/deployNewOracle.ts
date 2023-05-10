import { BN } from "../../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    UniswapV3TokenOracleRelay__factory,
    UniswapV3TokenOracleRelay,
    AnchoredViewRelay,
    AnchoredViewRelay__factory, ChainlinkOracleRelay, ChainlinkTokenOracleRelay__factory
} from "../../../../typechain-types";
import { toNumber } from "../../../../util/math";
import { showBodyCyan } from "../../../../util/format";
import { reset } from "../../../../util/block";

const { ethers, network, upgrades } = require("hardhat");

//old anchor view = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2

const deployedRelay = "0x9128bA6B88a3851d6aa856aadE7dA0Bb694560Db"

const newDataFeed = "0xf017fcb346a1885194689ba23eff2fe6fa5c483b"
const chainlinkCBETHfeed = "0x67eF3CAF8BeB93149F48e8d20920BEC9b4320510"


let anchorCBETH: UniswapV3TokenOracleRelay
let mainCBETH: ChainlinkOracleRelay
let anchorViewCBETH: AnchoredViewRelay




const deployOracles = async (deployer: SignerWithAddress) => {
    let chainlinkFactory = new ChainlinkTokenOracleRelay__factory(deployer)
    let anchorViewFactory = new AnchoredViewRelay__factory(deployer)


    anchorCBETH = UniswapV3TokenOracleRelay__factory.connect(deployedRelay, deployer)
    showBodyCyan("Previously deployed cbETH anchor relay price: ", await toNumber(await anchorCBETH.currentValue()))

    mainCBETH = await chainlinkFactory.deploy(
        newDataFeed,
        BN("1"),
        BN("1")
    )
    await mainCBETH.deployed()
    console.log("cbETH chainlink data relay deployed: ", mainCBETH.address)
    showBodyCyan("cbETH chainlink data feed price: ", await toNumber(await mainCBETH.currentValue()))

    anchorViewCBETH = await anchorViewFactory.deploy(
        anchorCBETH.address,
        mainCBETH.address,
        BN("10"),
        BN("100")
    )
    await anchorViewCBETH.deployed()
    console.log("Anchor View cbETH deployed: ", anchorViewCBETH.address)
    showBodyCyan("cbETH Anchor view price: ", await toNumber(await anchorViewCBETH.currentValue()))


}

const deploy = async (deployer: SignerWithAddress) => {


    await deployOracles(deployer)

    console.log("New oracles have been deployed successfully")


};

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await network.provider.send("evm_setAutomine", [true])
    await reset(16135439)



    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    await deploy(deployer)

    console.log("Mission accomplished")


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

/**
↓   Previously deployed cbETH anchor relay price:  1,184.7716045374773
cbETH chainlink data relay deployed:  0x413Fe735D0311Dc45d9C88c59b1127b2a3015925
↓   cbETH chainlink data feed price:  1,184.8398083574425
Anchor View cbETH deployed:  0xae7Be6FE233bd33F9F9149050932cBa728793fdd
↓   cbETH Anchor view price:  1,184.8398083574425
New oracles have been deployed successfully
Mission accomplished
 */