/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BytesLike,
  CallOverrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type { FunctionFragment, Result } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
} from "../common";

export interface UniswapV3OracleRelayInterface extends utils.Interface {
  functions: {
    "_pool()": FunctionFragment;
    "_poolAddress()": FunctionFragment;
    "_quoteTokenIsToken0()": FunctionFragment;
    "currentValue()": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "_pool"
      | "_poolAddress"
      | "_quoteTokenIsToken0"
      | "currentValue"
  ): FunctionFragment;

  encodeFunctionData(functionFragment: "_pool", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "_poolAddress",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "_quoteTokenIsToken0",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "currentValue",
    values?: undefined
  ): string;

  decodeFunctionResult(functionFragment: "_pool", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "_poolAddress",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "_quoteTokenIsToken0",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "currentValue",
    data: BytesLike
  ): Result;

  events: {};
}

export interface UniswapV3OracleRelay extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: UniswapV3OracleRelayInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    _pool(overrides?: CallOverrides): Promise<[string]>;

    _poolAddress(overrides?: CallOverrides): Promise<[string]>;

    _quoteTokenIsToken0(overrides?: CallOverrides): Promise<[boolean]>;

    currentValue(overrides?: CallOverrides): Promise<[BigNumber]>;
  };

  _pool(overrides?: CallOverrides): Promise<string>;

  _poolAddress(overrides?: CallOverrides): Promise<string>;

  _quoteTokenIsToken0(overrides?: CallOverrides): Promise<boolean>;

  currentValue(overrides?: CallOverrides): Promise<BigNumber>;

  callStatic: {
    _pool(overrides?: CallOverrides): Promise<string>;

    _poolAddress(overrides?: CallOverrides): Promise<string>;

    _quoteTokenIsToken0(overrides?: CallOverrides): Promise<boolean>;

    currentValue(overrides?: CallOverrides): Promise<BigNumber>;
  };

  filters: {};

  estimateGas: {
    _pool(overrides?: CallOverrides): Promise<BigNumber>;

    _poolAddress(overrides?: CallOverrides): Promise<BigNumber>;

    _quoteTokenIsToken0(overrides?: CallOverrides): Promise<BigNumber>;

    currentValue(overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    _pool(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    _poolAddress(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    _quoteTokenIsToken0(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    currentValue(overrides?: CallOverrides): Promise<PopulatedTransaction>;
  };
}
