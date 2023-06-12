import { network } from "hardhat";
import hre from 'hardhat';
import { currentBlock, resetCurrentOP } from "../../../util/block";
import { s } from "./scope";
import { Deployment, DeploymentInfo } from "./optimisimDeployment";
import { BN } from "../../../util/number";
import { showBody, showBodyCyan } from "../../../util/format";
const { ethers } = require("hardhat");

async function main() {

    //check for test network
    const networkName = hre.network.name
    if (networkName == "hardhat" || networkName == "localhost") {
        console.log("TEST DEPLOYMENT: ", networkName)
        await network.provider.send("evm_setAutomine", [true])
        await resetCurrentOP()
        const block = await currentBlock()
        console.log("Deploying on OPTIMISM as of block: ", block.number)
    } else {
        console.log("DEPLOYING TO: ", networkName)
    }
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    console.log("Deployer: ", deployer.address)

    let info: DeploymentInfo = {

        //token parameters
        WethLTV: BN("85e16"),
        WethLiqInc: BN("5e16"),
        WethCap: BN("2700e18"), //$5mm

        wBtcLTV: BN("8e17"),
        wBtcLiqInc: BN("7e16"),
        wBtcCap: BN("190e8"), //$5mm

        OpLTV: BN("7e17"),
        OpLiqInc: BN("7e16"),
        OpCap: BN("1500000e18"), //$2mm

        wstEthLTV: BN("8e17"),
        wstEthLiqInc: BN("7e16"),
        wstEthCap: BN("1000e18"),//$2mm 

        rEthLTV: BN("75e16"),
        rEthLiqInc: BN("7e16"),
        rEthCap: BN("500e18"),//$1mm 


        //external contracts
        wethAddress: s.wethAddress,
        opAddress: s.opAddress,
        usdcAddress: s.usdcAddress,
        wbtcAddress: s.wbtcAddress,
        aaveAddress: s.aaveAddress,
        uniAddress: s.uniAddress,
        wstethAddress: s.wstethAddress,
        rethAddress: s.rethAddress,

        //oracle contracts
        wETH_CL_FEED: s.wETH_CL_FEED,
        wETH_UNI_POOL: s.wETH_UNI_POOL,

        wstETH_CL_FEED: s.wstETH_CL_FEED,
        wstETH_UNI_POOL: s.wstETH_UNI_POOL,

        rETH_CL_FEED: s.rETH_CL_FEED,
        rETH_UNI_POOL: s.rETH_UNI_POOL,

        OP_CL_FEED: s.OP_CL_FEED,
        OP_UNI_POOL: s.OP_UNI_POOL,

        wBTC_CL_FEED: s.wBTC_CL_FEED,
        wBTC_UNI_POOL: s.wBTC_UNI_POOL,

        UNI_CL_FEED: s.UNI_CL_FEED,
        UNI_UNI_POOL: s.UNI_UNI_POOL,

        AAVE_CL_FEED: s.AAVE_CL_FEED,
        AAVE_UNI_POOL: s.AAVE_UNI_POOL,

        //deployed contracts
        VaultController: "0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85",
        USDI: "0xF352DC165783538A26e38A536e76DceF227d90F2",
        ProxyAdmin: "0x2dB08783F13c4225A1963b2437f0D459a5BCB4D8",
        VotingVaultController: "0x9C3b60A1ad08740fCD842351ff0960C1Ee3FeA52",
        CappedImplementation: "0x54fE0D5dA2C787a93f2Dcb4d25E202C4e44e4458",
        CappedWeth: "0x696607447225f6690883e718fd0Db0Abaf36B6E2", 
        CappedWbtc: "0x5a83002E6d8dF75c79ADe9c209F21C31B0AB14B2",
        CappedOp: "0xb549c8cc8011CA0d023A73DAD54d725125b25F31", 
        CappedWstEth: "0xE1442bA08e330967Dab4fd4Fc173835e9730bff6",
        CappedRETH: "0x399bA3957D0e5F6e62836506e760787FDDFb01c3"

    }

    const d = new Deployment(deployer, info)
    await d
        .ensure()
        .then(() => {
            showBodyCyan("CONTRACTS ALL DEPLOYED")
        })
        .catch((e) => {
            console.log(e)
        })

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

/**
DEPLOYING TO:  op
Deployer:  0x085909388fc0cE9E5761ac8608aF8f2F52cb8B89
Verifying Vanilla Protocol Deployment
Ensure external
proxyAdmin deployed to:  0x2dB08783F13c4225A1963b2437f0D459a5BCB4D8
VaultController implementation deployed:  0xE565E118e75304dD3cF83dff409c90034b7EA18a
VaultController proxy deployed:  0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85
VaultController initialized:  0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85
oracleMaster deployed:  0xBdCF0bb40eb8642f907133bDB5Fcc681D81f0651
Registering oracle master
Registered oracle master
USDI implementation address:  0x181C4bB6413534b09B7dA80a098D2DcEb2B55Fe8
USDI proxy address:  0xF352DC165783538A26e38A536e76DceF227d90F2
USDI initialized:  0xF352DC165783538A26e38A536e76DceF227d90F2
Set VaultController on USDI to:  0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85
Set USDI on VaultController to:  0xF352DC165783538A26e38A536e76DceF227d90F2
VotingVaultController implementation deployed:  0x2338457F771Cf7Ca7889Aad848eEbA18807Cb206
VotingVaultController proxy deployed:  0x9C3b60A1ad08740fCD842351ff0960C1Ee3FeA52
VotingVaultController initialized with VC address: 0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85
Vanilla protocol ensured
Deploying new weth oracle
    ↓   weth ORACLE PRICE:  1,837.29
Deploying Capped weth
Deployed CappedGovToken Implementation:  0x54fE0D5dA2C787a93f2Dcb4d25E202C4e44e4458
Capped wETH deployed:  0x696607447225f6690883e718fd0Db0Abaf36B6E2
Capped wETH initialized:  0x696607447225f6690883e718fd0Db0Abaf36B6E2
setting weth oracle to be weth relay
Registering Capped weth on VaultController
Registering Capped weth on VotingVaultController
Setting cap for weth
Deploying new wBTC oracle
    ↓   wBtc ORACLE PRICE:  26,487.401439
Deploying Capped wBtc
Capped wBtctimisim deployed:  0x5a83002E6d8dF75c79ADe9c209F21C31B0AB14B2
Capped wBtc initialized:  0x5a83002E6d8dF75c79ADe9c209F21C31B0AB14B2
setting wBtc oracle to be wBtc relay
Registering Capped wBtc on VaultController
Registering Capped wBtc on VotingVaultController
Setting cap for wBtc
Deploying new OP oracle
    ↓   OP ORACLE PRICE:  1.325141
Deploying Capped OP
Capped Optimisim deployed:  0xb549c8cc8011CA0d023A73DAD54d725125b25F31
Capped Optimism initialized:  0xb549c8cc8011CA0d023A73DAD54d725125b25F31
setting OP oracle to be OP relay
Registering Capped OP on VaultController
Registering Capped OP on VotingVaultController
Setting cap for OP
Deploying new wstEth oracle
    ↓   wstEth ORACLE PRICE:  2,067.80338088
Deploying Capped wstEth
Capped wstEthtimisim deployed:  0xE1442bA08e330967Dab4fd4Fc173835e9730bff6
Capped wstETH initialized:  0xE1442bA08e330967Dab4fd4Fc173835e9730bff6
setting wstEth oracle to be wstEth relay
Registering Capped wstEth on VaultController
Registering Capped wstEth on VotingVaultController
Setting cap for wstEth
Deploying new rEth oracle
    ↓   rEth ORACLE PRICE:  1,975.038800341474
Deploying Capped rEth
Capped rETH deployed:  0x399bA3957D0e5F6e62836506e760787FDDFb01c3
Capped rETH initialized:  0x399bA3957D0e5F6e62836506e760787FDDFb01c3
setting rEth oracle to be rEth relay
Registering Capped rEth on VaultController
Registering Capped rEth on VotingVaultController
Setting cap for rEth
    ↓   CONTRACTS ALL DEPLOYED

real    5m18.007s
user    0m2.969s
sys     0m2.109s
 */