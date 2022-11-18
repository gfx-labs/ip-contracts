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
    await reset(15799536)
    await network.provider.send("evm_setAutomine", [true])

    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const proposal = new ProposalContext("LDO, DYDX, & CRV")

    const addLDOoracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedLDO,
            d.anchorViewLDO
        )

    const addDYDXoracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedDYDX,
            d.anchorViewDYDX
        )

    const addCRVoracle = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            d.CappedCRV,
            d.anchorViewCRV
        )



    const listLDO = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            d.CappedLDO,
            BN("7e17"),
            d.CappedLDO,
            BN("1e17")
        )

    const listDYDX = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            d.CappedDYDX,
            BN("7e17"),
            d.CappedDYDX,
            BN("1e17")
        )

    const listCRV = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            d.CappedCRV,
            BN("7e17"),
            d.CappedCRV,
            BN("1e17")
        )

    //register on voting vault controller
    const registerLDO_VVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            d.LDOaddress,
            d.CappedLDO
        )
    const registerDYDX_VVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            d.DYDXaddress,
            d.CappedDYDX
        )
    const registerCRV_VVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            d.CRVaddress,
            d.CappedCRV
        )


    proposal.addStep(addLDOoracle, "setRelay(address,address)")
    proposal.addStep(addDYDXoracle, "setRelay(address,address)")
    proposal.addStep(addCRVoracle, "setRelay(address,address)")

    proposal.addStep(listLDO, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(listDYDX, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(listCRV, "registerErc20(address,uint256,address,uint256)")


    proposal.addStep(registerLDO_VVC, "registerUnderlying(address,address)")
    proposal.addStep(registerDYDX_VVC, "registerUnderlying(address,address)")
    proposal.addStep(registerCRV_VVC, "registerUnderlying(address,address)")


    let out = proposal.populateProposal()

    console.log(out)
    const proposalText = fs.readFileSync('./scripts/proposals/LDO_DYDX_CRV/proposal.md', 'utf8');

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

    fs.writeFileSync('./scripts/proposals/LDO_DYDX_CRV/proposalHexData.txt', JSON.stringify(data));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
