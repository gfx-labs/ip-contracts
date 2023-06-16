export interface Addresser {
    wethAddress: string;
    usdcAddress: string;

    compAddress: string;

    usdcWethPool: string;
    usdcCompPool: string;

    chainlinkEthFeed: string;
    compVotingAddress: string;

}

export class MainnetAddresses {
    readonly wethAddress: string = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    readonly usdcAddress: string = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    readonly usdcWethPool: string = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";
    readonly compAddress: string = "0xc00e94cb662c3520282e6f5717214004a7f26888";
    readonly wbtcAddress: string = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    readonly usdcWbtcPool: string = "0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35";
    readonly uniAddress: string = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
    readonly usdcUniPool: string = "0xD0fC8bA7E267f2bc56044A7715A489d851dC6D78";
    readonly ensAddress: string = "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72";
    readonly dydxAddress: string = "0x92d6c1e31e14520e676a687f0a93788b716beff5";
    readonly aaveAddress: string = "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9";
    readonly tribeAddress: string = "0xc7283b66eb1eb5fb86327f08e1b5816b0720212b";
    readonly usdcCompPool: string = "0x4786bb29a1589854204a4e62dcbe26a571224c0f";
    readonly chainlinkEthFeed: string = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419";
    readonly chainlinkCompFeed: string = "0xdbd020caef83efd542f4de03e3cf0c28a4428bd5";
    readonly chainlinkUniFeed: string = "0x553303d460EE0afB37EdFf9bE42922D8FF63220e";
    readonly chainlinkBtcFeed: string = "0xf4030086522a5beea4988f8ca5b36dbc97bee88c";
    readonly compVotingAddress: string = "0x1F2AB8Ac759Fb0E3185630277A554Ae3110bF530";
    readonly richAVAXWallet: string = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
    readonly richBinance14: string = "0x28C6c06298d514Db089934071355E5743bf21d60";
    constructor() { }
}

export class MainnetBPTaddresses {
    readonly CappedBPT_Implementation: string = "0x0CDb61ab468a2f89D1636c95b32D88c0eA6ef826"
    readonly NewVVC_Implementation: string = "0x17B7bD832666Ac28A6Ad35a93d4efF4eB9A07a17"

    //first preposal
    readonly CappedB_stETH_STABLE: string = "0x7d3CD037aE7efA9eBed7432c11c9DFa73519303d"
    readonly wstEthRelay: string = "0x0E2a18163e6cB2eB11568Fad35E42dE4EE67EA9a"
    readonly B_stETH_STABLEPOOL_ORACLE: string = "0xD6B002316D4e13d2b7eAff3fa5Fc6c20D2CeF4be"

}

export class OptimisimAddresses {
    //Tokens
    readonly wethAddress: string = "0x4200000000000000000000000000000000000006"
    readonly opAddress: string = "0x4200000000000000000000000000000000000042"
    readonly usdcAddress: string = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607"
    readonly wbtcAddress: string = "0x68f180fcCe6836688e9084f035309E29Bf0A2095"
    readonly aaveAddress: string = "0x76FB31fb4af56892A25e32cFC43De717950c9278"
    readonly uniAddress: string = "0x6fd9d7AD17242c41f7131d257212c54A0e816691"
    readonly wstethAddress: string = "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb"
    readonly rethAddress: string = "0x9Bcef72be871e61ED4fBbc7630889beE758eb81D"


    //oracle contracts
    readonly wETH_CL_FEED: string = "0x13e3ee699d1909e989722e753853ae30b17e08c5"
    readonly wETH_UNI_POOL: string = "0x85149247691df622eaF1a8Bd0CaFd40BC45154a9" //wETH/USDC 500 pool CONTRACT NOT VERRIFIED

    readonly wstETH_CL_FEED: string = "0x698b585cbc4407e2d54aa898b2600b53c68958f7"
    readonly wstETH_UNI_POOL: string = "0x4a5a2A152e985078e1A4AA9C3362c412B7dd0a86" //wETH/wstETH 500 pool FALSE

    readonly rETH_CL_FEED: string = "0x1a8F81c256aee9C640e14bB0453ce247ea0DFE6F"
    readonly rETH_UNI_POOL: string = "0xAEfC1edaeDE6ADaDcdF3bB344577D45A80B19582" //wETH/rETH 500 pool TRUE

    readonly OP_CL_FEED: string = "0x0d276fc14719f9292d5c1ea2198673d1f4269246"
    readonly OP_UNI_POOL: string = "0x68F5C0A2DE713a54991E01858Fd27a3832401849" // wETH/OP 3k pool TRUE

    readonly wBTC_CL_FEED: string = "0x718a5788b89454aae3a028ae9c111a29be6c2a6f"
    readonly wBTC_UNI_POOL: string = "0x73B14a78a0D396C521f954532d43fd5fFe385216" //wETH/wBTC 3k pool CONTRACT NOT VERRIFIED

    readonly UNI_CL_FEED: string = "0x11429ee838cc01071402f21c219870cbac0a59a0"
    readonly UNI_UNI_POOL: string = "0xAD4c666fC170B468B19988959eb931a3676f0e9F" //wETH/UNI 3k pool CONTRACT NOT VERRIFIED + BAD LIQUIDITY ~9k USD WETH

    readonly AAVE_CL_FEED: string = "0x338ed6787f463394d24813b297401b9f05a8c9d1"
    readonly AAVE_UNI_POOL: string = "0x790fde1FD6d2568050061a88c375d5c2E06b140B" //wETH/AAVE 10k pool TRUE BAD LIQUIDITY ~2k USD WETH

}

export class OptimisimDeploys {
        //protocol
        readonly VaultController: string = "0x05498574BD0Fa99eeCB01e1241661E7eE58F8a85"
        readonly Oracle: string = "0xBdCF0bb40eb8642f907133bDB5Fcc681D81f0651"
        readonly USDI: string = "0x889be273BE5F75a177f9a1D00d84D607d75fB4e1"
        readonly ProxyAdmin: string = "0x2dB08783F13c4225A1963b2437f0D459a5BCB4D8"
        readonly VotingVaultController: string = "0x9C3b60A1ad08740fCD842351ff0960C1Ee3FeA52"
        readonly Curve: string = "0xC3A17DC6b70cD58f8aE49Fb969CCA5A57cf84A73"
        readonly ThreeLines: string = "0x7C53378987F6e82050b1244B4d836f785147544b"
        readonly CappedImplementation: string = "0x54fE0D5dA2C787a93f2Dcb4d25E202C4e44e4458"
        readonly CappedWeth: string = "0x696607447225f6690883e718fd0Db0Abaf36B6E2"
        readonly EthOracle: string = "0xcB88cf29121E5380c818A7dd4E8C21d964369dF3"
        readonly CappedWbtc: string = "0x5a83002E6d8dF75c79ADe9c209F21C31B0AB14B2"
        readonly wBtcOracle: string = "0xDDB3BCFe0304C970E263bf1366db8ed4DE0e357a"
        readonly CappedOp: string = "0xb549c8cc8011CA0d023A73DAD54d725125b25F31"
        readonly OpOracle: string = "0x8C8AE22fea16C43743C846902eC7E34204894189"
        readonly CappedWstEth: string = "0xE1442bA08e330967Dab4fd4Fc173835e9730bff6"
        readonly wstEthOracle: string = "0xB765006321C6Be998f0ef62802d2548E76870D3B"
        readonly CappedRETH: string = "0x399bA3957D0e5F6e62836506e760787FDDFb01c3"
        readonly rEthOracle: string = "0x99bd1f28a5A7feCbE39a53463a916794Be798FC3"    
}

export const Mainnet: Addresser = new MainnetAddresses();
