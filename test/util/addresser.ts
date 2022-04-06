export interface Addresser {
  wethAddress: string;
  usdcAddress: string;

  compAddress: string;

  usdcWethPool: string;
  usdcCompPool: string;
}

class MainnetAddresses {
  readonly wethAddress: string = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  readonly usdcAddress: string = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  readonly usdcWethPool: string = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";
  readonly compAddress: string = "0xc00e94cb662c3520282e6f5717214004a7f26888";
  readonly usdcCompPool: string = "0x4786bb29a1589854204a4e62dcbe26a571224c0f";
  constructor() {}
}

export const Mainnet: Addresser = new MainnetAddresses();
