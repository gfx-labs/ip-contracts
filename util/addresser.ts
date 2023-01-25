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
    readonly richFTXWallet: string = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
    readonly richBinance14: string = "0x28C6c06298d514Db089934071355E5743bf21d60";
    constructor() { }
}

export const Mainnet: Addresser = new MainnetAddresses();
