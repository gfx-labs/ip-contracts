import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    CappedGovToken,
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory,
    CappedGovToken__factory,
    UniswapV3TokenOracleRelay__factory,
    UniswapV3TokenOracleRelay,
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    OracleMaster__factory,
    VaultController__factory,
    VotingVaultController__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    ProxyAdmin__factory
} from "../../../typechain-types";
import { DeployContractWithProxy, DeployContract } from "../../../util/deploy";
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";
import { toNumber } from "../../../util/math";
import { d } from "../DeploymentInfo"
import { showBody } from "../../../util/format";

const { ethers, network, upgrades } = require("hardhat");

const ensAddress = "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"
const ENS_CAP = BN("100000e18")//100k ENS tokens - ~$1.5mm USD

const weth3k = "0x92560C178cE069CC014138eD3C2F5221Ba71f58a"//good liquidity - 910 weth, ~$3.4mm TVL 
const chainLinkDataFeed = "0x5C00128d4d1c2F4f652C267d7bcdD7aC99C16E16"

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

let anchor: UniswapV3TokenOracleRelay
let mainRelay: ChainlinkOracleRelay
let CappedENS: CappedGovToken

const deploy = async (deployer: SignerWithAddress) => {
    //uniV3Relay
    anchor = await DeployContract(
        new UniswapV3TokenOracleRelay__factory(deployer),
        deployer,
        60,
        weth3k,
        true,//weth is token0
        BN("1"),
        BN("1")
    )
    await anchor.deployed()
    console.log("Uniswap V3 Anchor deployed to: ", anchor.address)

    //chainlink relay
    mainRelay = await DeployContract(
        new ChainlinkOracleRelay__factory(deployer),
        deployer,
        chainLinkDataFeed,
        BN("1e10"),
        BN("1")
    )
    await mainRelay.deployed()
    console.log("Chainlink main relay deployed to: ", mainRelay.address)

    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)

    CappedENS = await DeployContractWithProxy(
        new CappedGovToken__factory(deployer),
        deployer,
        proxy,
        "CappedENS",
        "cENS",
        ensAddress,
        d.VaultController,
        d.VotingVaultController
    )
    await CappedENS.deployed()
    console.log("Capped ENS deployed to: ", CappedENS.address)

    await CappedENS.setCap(ENS_CAP)
    console.log("Set CappedENS cap to: ", ENS_CAP.toString())

    await CappedENS.transferOwnership(govAddress)
    console.log("Transferred ownership of CappedENS to: ", govAddress)

};

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await network.provider.send("evm_setAutomine", [true])

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    await deploy(deployer)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
