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
import { ProposalContext } from "../suite/proposal";
import { toNumber } from "../../../util/math";
import { d } from "../DeploymentInfo"
import { showBody } from "../../../util/format";
import { reset } from "../../../util/block";
import * as fs from 'fs';

const { ethers, network, upgrades } = require("hardhat");

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

let anchor: UniswapV3TokenOracleRelay
let mainRelay: ChainlinkOracleRelay
let anchorView: AnchoredViewRelay
let CappedZRX: CappedGovToken

const ZRX_LTV = BN("5e17")
const NEW_UNI_LTV = BN("700000000000000000") //0.70
const ZRX_LiqInc = BN("150000000000000000")

const ZRX_ADDR = "0xE41d2489571d322189246DaFA5ebDe1F4699F498"


const implementation = "0x9BDb5575E24EEb2DCA7Ba6CE367d609Bdeb38246"
const CappedZRX_ADDR = "0xDf623240ec300fD9e2B7780B34dC2F417c0Ab6D2"
const anchorViewAddr = "0xEF12fa3183362506A2dd0ff1CF06b2f4156e751E"

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await reset(16487453)
    await network.provider.send("evm_setAutomine", [true])

    

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const proposal = new ProposalContext("ZRX, VC Upgrade, UNI LTV")

    const addOracleZRX = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            CappedZRX_ADDR,
            anchorViewAddr
        )

    const listZRX = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            CappedZRX_ADDR,
            ZRX_LTV,
            CappedZRX_ADDR,
            ZRX_LiqInc
        )

    const registerZRX_VVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            ZRX_ADDR,
            CappedZRX_ADDR
        )


    const OracleVerbose = OracleMaster__factory.connect(d.Oracle, deployer)
    const VaultControllerVerbose = VaultController__factory.connect(d.VaultController, deployer)
    const currentOracle = await OracleVerbose._relays(d.UNI)
    const currentLiqInc = await VaultControllerVerbose._tokenAddress_liquidationIncentive(d.UNI)

    //showBody("Current Oracle: ", currentOracle)


    const updateUniLTV = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.updateRegisteredErc20(
            d.UNI,
            NEW_UNI_LTV,
            d.UNI,
            currentLiqInc
        )

    const upgradeVC = await new ProxyAdmin__factory().
        attach(d.ProxyAdmin).
        populateTransaction.upgrade(
            d.VaultController,
            implementation
        )


    //upgrade VC
    proposal.addStep(upgradeVC, "upgrade(address,address)")
    //UNI LTV
    proposal.addStep(updateUniLTV, "updateRegisteredErc20(address,uint256,address,uint256)")

    //list ZRX
    proposal.addStep(addOracleZRX, "setRelay(address,address)")
    proposal.addStep(listZRX, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerZRX_VVC, "registerUnderlying(address,address)")

    let out = proposal.populateProposal()

    console.log(out)
    const proposalText = fs.readFileSync('./scripts/proposals/ZRX/proposal.md', 'utf8');

    let gov: GovernorCharlieDelegate;
    gov = new GovernorCharlieDelegate__factory(deployer).attach(
        govAddress
    );

    const data = await gov.connect(deployer).populateTransaction.propose(
        out.targets,
        out.values,
        out.signatures,
        out.calldatas,
        proposalText,
        false
    )

    fs.writeFileSync('./scripts/proposals/ZRX/proposalHexData.txt', JSON.stringify(data));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
