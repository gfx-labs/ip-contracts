export interface Addresser {
    wethAddress: string;
    usdcAddress: string;

    compAddress: string;

    usdcWethPool: string;
    usdcCompPool: string;

    chainlinkEth: string;
    compVotingAddress: string;
}

export class MainnetAddresses {
    readonly wethAddress: string = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    readonly usdcAddress: string = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    readonly usdcWethPool: string = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";
    readonly compAddress: string = "0xc00e94cb662c3520282e6f5717214004a7f26888";
    readonly wbtcAddress: string = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    readonly uniAddress: string = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";    
    readonly ensAddress: string = "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72";
    readonly dydxAddress: string = "0x92d6c1e31e14520e676a687f0a93788b716beff5";
    readonly aaveAddress: string = "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9";
    readonly tribeAddress: string = "0xc7283b66eb1eb5fb86327f08e1b5816b0720212b";
    readonly usdcCompPool: string = "0x4786bb29a1589854204a4e62dcbe26a571224c0f";
    readonly chainlinkEth: string = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419";
    readonly compVotingAddress: string = "0x1F2AB8Ac759Fb0E3185630277A554Ae3110bF530"
    constructor() { }
}

export const Mainnet: Addresser = new MainnetAddresses();
