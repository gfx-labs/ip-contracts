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


const CHAI_LTV = BN("98e16")
const CHAI_LiqInc = BN("7500000000000000")//0.0075 / 0.75%

const CHAI_ADDR = "0x06AF07097C9Eeb7fD685c692751D5C66dB49c215"


const CappedCHAI_ADDR = "0xDdAD1d1127A7042F43CFC209b954cFc37F203897"
const anchorViewAddr = "0x9Aa2Ccb26686dd7698778599cD0f4425a5231e18"

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    await reset(16770877)
    await network.provider.send("evm_setAutomine", [true])



    const accounts = await ethers.getSigners();
    const deployer = accounts[0];

    const proposal = new ProposalContext("LIST CHAI")

    const addOracleCHAI = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            CappedCHAI_ADDR,
            anchorViewAddr
        )

    const listCHAI = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            CappedCHAI_ADDR,
            CHAI_LTV,
            CappedCHAI_ADDR,
            CHAI_LiqInc
        )

    const registerCHAI_VVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            CHAI_ADDR,
            CappedCHAI_ADDR
        )

    //list CHAI
    proposal.addStep(addOracleCHAI, "setRelay(address,address)")
    proposal.addStep(listCHAI, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerCHAI_VVC, "registerUnderlying(address,address)")

    let out = proposal.populateProposal()

    console.log(out)
    const proposalText = fs.readFileSync('./scripts/proposals/CHAI/proposal.md', 'utf8');

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

    showBody("Data: ", data)
    //fs.writeFileSync('./scripts/proposals/CHAI/proposalHexData.txt', JSON.stringify(data));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
