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
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    ChainlinkTokenOracleRelay,
    ChainlinkTokenOracleRelay__factory,
    BalancerPeggedAssetRelay,
    BalancerPeggedAssetRelay__factory,
    UniswapV3OracleRelay__factory,
    CHI_Oracle__factory,
    IOracleRelay
} from "../../../typechain-types";
import { DeployContractWithProxy, DeployContract } from "../../../util/deploy";
import { ProposalContext } from "../suite/proposal";
import { getGas, toNumber } from "../../../util/math";
import { d } from "../DeploymentInfo"
import { showBody, showBodyCyan } from "../../../util/format";
import { reset } from "../../../util/block";
import { BigNumber } from "ethers";

const { ethers, network, upgrades } = require("hardhat");
const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const CHAI_ADDR = "0x06AF07097C9Eeb7fD685c692751D5C66dB49c215"
const CHAI_CAP = BN("1000000e18")


let CappedCHAI: CappedGovToken

let anchorViewCHAI: IOracleRelay

const deployCapTokens = async (deployer: SignerWithAddress) => {
    const proxy = ProxyAdmin__factory.connect(d.ProxyAdmin, deployer)
    //const CappedGovFactory = await ethers.getContractFactory("CappedGovToken")

    //deploy capped CHAI
    const ucCHAI = await new CappedGovToken__factory(deployer).deploy()

    const cCHAI = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        ucCHAI.address,
        proxy.address,
        "0x"
    )
    await cCHAI.deployed()

    CappedCHAI = new CappedGovToken__factory(deployer).attach(cCHAI.address)
    console.log("Capped CHAI deployed to: ", cCHAI.address)
    const initCHAI = await CappedCHAI.initialize(
        "Capped CHAI",
        "cCHAI",
        CHAI_ADDR,
        d.VaultController,
        d.VotingVaultController
    )
    await initCHAI.wait()
    console.log("Capped CHAI Initialized", CappedCHAI.address)



}

const deployOracles = async (deployer: SignerWithAddress) => {
    let peggedBalancerFactory = new BalancerPeggedAssetRelay__factory(deployer)
    let UniV3Factory = new UniswapV3TokenOracleRelay__factory(deployer)
    let chainlinkFactory = new ChainlinkOracleRelay__factory(deployer)
    let mainTokenFactory = new ChainlinkTokenOracleRelay__factory(deployer)
    let anchorViewFactory = new AnchoredViewRelay__factory(deployer)

    anchorViewCHAI = await new CHI_Oracle__factory(deployer).deploy("0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7")


    await anchorViewCHAI.deployed()
    showBody("CHAI anchor view deployed: ", anchorViewCHAI.address)
    showBodyCyan("CHAI anchor view price: ", await toNumber(await anchorViewCHAI.currentValue()))


}

const deploy = async (deployer: SignerWithAddress) => {


    await deployCapTokens(deployer)

    console.log("All Cap Tokens deployed")

    await deployOracles(deployer)

    console.log("All oracles have been deployed successfully")

    await CappedCHAI.setCap(CHAI_CAP)
    console.log("Set CHAI cap to: ", await toNumber(CHAI_CAP))



};

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await network.provider.send("evm_setAutomine", [true])
    //await reset(16744427)


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

/**
 Capped CHAI deployed to:  0xDdAD1d1127A7042F43CFC209b954cFc37F203897
Capped CHAI Initialized 0xDdAD1d1127A7042F43CFC209b954cFc37F203897
All Cap Tokens deployed
↓   CHAI anchor view deployed:  0x9Aa2Ccb26686dd7698778599cD0f4425a5231e18
↓   CHAI anchor view price:  1.0205021615169114
All oracles have been deployed successfully
Set CHAI cap to:  1000000
 */