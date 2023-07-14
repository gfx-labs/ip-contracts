import { BN } from "../../../util/number";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    GovernorCharlieDelegate,
    GovernorCharlieDelegate__factory, OracleMaster__factory,
    VaultController__factory,
    VotingVaultController__factory
} from "../../../typechain-types";
import { ProposalContext } from "../suite/proposal";
import { getGas } from "../../../util/math";
import { a, c, d } from "../../../util/addresser"
import { showBody } from "../../../util/format";

import * as fs from 'fs';

const { ethers, network, upgrades } = require("hardhat");

const govAddress = "0x266d1020A84B9E8B0ed320831838152075F8C4cA"

const CappedLINK_ADDR = "0x5F39aD3df3eD9Cf383EeEE45218c33dA86479165"
const LINK_ADDR = "0x514910771AF9Ca656af840dff83E8264EcF986CA"
const LINK_LiqInc = BN("75000000000000000")
const LINK_LTV = BN("75e16")
const anchorViewAddrLINK = "0x8415011818C398dC40258f699a7cb58C85953F43"

const CappedYFI_ADDR = "0xe2C1d2E7aA4008081CAAFc350A040246b9EBB579"
const YFI_ADDR = "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e"
const YFI_LiqInc = BN("100000000000000000")
const YFI_LTV = BN("7e17")
const anchorViewAddrYFI = "0x924854279824c9c05da81d3CD1fBde30Ea3C71b6"


const proposeLINK = async (deployer: SignerWithAddress) => {
    const proposal = new ProposalContext("LIST LINK")

    const addOracleLINK = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            CappedLINK_ADDR,
            anchorViewAddrLINK
        )

    const listLINK = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            CappedLINK_ADDR,
            LINK_LTV,
            CappedLINK_ADDR,
            LINK_LiqInc
        )

    const registerLINK_VVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            LINK_ADDR,
            CappedLINK_ADDR
        )

    //list LINK
    proposal.addStep(addOracleLINK, "setRelay(address,address)")
    proposal.addStep(listLINK, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerLINK_VVC, "registerUnderlying(address,address)")

    let out = proposal.populateProposal()

    const proposalText = fs.readFileSync('./scripts/proposals/LINK&YFI/LINKproposal.md', 'utf8');

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

    console.log("Sending proposal from ", deployer.address)
    const result = await gov.connect(deployer).propose(
        out.targets,
        out.values,
        out.signatures,
        out.calldatas,
        proposalText,
        false
    )
    const gas = await getGas(result) 
    showBody("Gas to propose: ", gas)
    showBody(out)

    showBody("Done")

    //showBody("Done")

    //showBody("Data: ", data)
    //fs.writeFileSync('./scripts/proposals/LINK&YFI/LINKproposalHexData.txt', JSON.stringify(data));
}

const proposeYFI = async (deployer: SignerWithAddress) => {
    const proposal = new ProposalContext("LIST YFI")

    const addOracleYFI = await new OracleMaster__factory().
        attach(d.Oracle).
        populateTransaction.setRelay(
            CappedYFI_ADDR,
            anchorViewAddrYFI
        )

    const listYFI = await new VaultController__factory().
        attach(d.VaultController).
        populateTransaction.registerErc20(
            CappedYFI_ADDR,
            YFI_LTV,
            CappedYFI_ADDR,
            YFI_LiqInc
        )

    const registerYFI_VVC = await new VotingVaultController__factory().
        attach(d.VotingVaultController).
        populateTransaction.registerUnderlying(
            YFI_ADDR,
            CappedYFI_ADDR
        )
    //list YFI
    proposal.addStep(addOracleYFI, "setRelay(address,address)")
    proposal.addStep(listYFI, "registerErc20(address,uint256,address,uint256)")
    proposal.addStep(registerYFI_VVC, "registerUnderlying(address,address)")

    let out = proposal.populateProposal()

    const proposalText = fs.readFileSync('./scripts/proposals/LINK&YFI/YFIproposal.md', 'utf8');

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

    

    //showBody("Done")

    //showBody("Data: ", data)
    //fs.writeFileSync('./scripts/proposals/LINK&YFI/YFIproposalHexData.txt', JSON.stringify(data));
}

async function main() {
    //enable this for testing on hardhat network, disable for testnet/mainnet deploy
    //await reset(17117568)
    //await network.provider.send("evm_setAutomine", [true])



    const accounts = await ethers.getSigners();
    const deployer = accounts[1];

    await proposeLINK(deployer)
    //await proposeYFI(deployer)




}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

/**
 {
  targets: [
    '0xf4818813045E954f5Dc55a40c9B60Def0ba3D477',
    '0x4aaE9823Fb4C70490F1d802fC697F3ffF8D5CbE3',
    '0xaE49ddCA05Fe891c6a5492ED52d739eC1328CBE2'
  ],
  values: [ 0, 0, 0 ],
  signatures: [
    'setRelay(address,address)',
    'registerErc20(address,uint256,address,uint256)',
    'registerUnderlying(address,address)'
  ],
  calldatas: [
    '0x0000000000000000000000005f39ad3df3ed9cf383eeee45218c33da864791650000000000000000000000008415011818c398dc40258f699a7cb58c85953f43',
    '0x0000000000000000000000005f39ad3df3ed9cf383eeee45218c33da864791650000000000000000000000000000000000000000000000000a688906bd8b00000000000000000000000000005f39ad3df3ed9cf383eeee45218c33da86479165000000000000000000000000000000000000000000000000010a741a46278000',
    '0x000000000000000000000000514910771af9ca656af840dff83e8264ecf986ca0000000000000000000000005f39ad3df3ed9cf383eeee45218c33da86479165'
  ]
}
 */