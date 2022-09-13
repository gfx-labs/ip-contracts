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
    TransparentUpgradeableProxy__factory
} from "../../../typechain-types";
import { DeployContractWithProxy, DeployContract } from "../../../util/deploy";
import { ProposalContext } from "../../../scripts/proposals/suite/proposal";
import { toNumber } from "../../../util/math";
import { d } from "../DeploymentInfo"
import { showBody } from "../../../util/format";
import { reset } from "../../../util/block";

const { ethers, network, upgrades } = require("hardhat");

const ensAddress = "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"
const ENS_CAP = BN("400000e18")//100k ENS tokens - ~$1.5mm USD

const weth3k = "0x92560C178cE069CC014138eD3C2F5221Ba71f58a"//good liquidity - 910 weth, ~$3.4mm TVL 
const chainLinkDataFeed = "0x5C00128d4d1c2F4f652C267d7bcdD7aC99C16E16"

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

let anchor: UniswapV3TokenOracleRelay
let mainRelay: ChainlinkOracleRelay
let anchorView: AnchoredViewRelay
let CappedENS: CappedGovToken



async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await reset(15529257)
    await network.provider.send("evm_setAutomine", [true])

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const proposal = new ProposalContext("ENS")

    const addOracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedENS,
            d.ENS_AnchorView
        )


    const listENS = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            d.CappedENS,
            BN("75e16"),
            d.CappedENS,
            BN("10e16")
        )

    //register on voting vault controller
    const registerVVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            ensAddress,
            d.CappedENS
        )


    proposal.addStep(addOracle, "setRelay(address,address)")
    proposal.addStep(listENS, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerVVC, "registerUnderlying(address,address)")


    let out = proposal.populateProposal()

    console.log(out)



}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
