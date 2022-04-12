/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type {
  FunctionFragment,
  Result,
  EventFragment,
} from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
} from "../../common";

export interface VaultInterface extends utils.Interface {
  functions: {
    "_baseLiability()": FunctionFragment;
    "_id()": FunctionFragment;
    "_masterAddress()": FunctionFragment;
    "_minter()": FunctionFragment;
    "decrease_liability(uint256)": FunctionFragment;
    "delegateCompLikeTo(address,address)": FunctionFragment;
    "deposit_erc20(address,uint256)": FunctionFragment;
    "getBalances(address)": FunctionFragment;
    "getBaseLiability()": FunctionFragment;
    "getMinter()": FunctionFragment;
    "increase_liability(uint256)": FunctionFragment;
    "masterTransfer(address,address,uint256)": FunctionFragment;
    "withdraw_erc20(address,uint256)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "_baseLiability"
      | "_id"
      | "_masterAddress"
      | "_minter"
      | "decrease_liability"
      | "delegateCompLikeTo"
      | "deposit_erc20"
      | "getBalances"
      | "getBaseLiability"
      | "getMinter"
      | "increase_liability"
      | "masterTransfer"
      | "withdraw_erc20"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "_baseLiability",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "_id", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "_masterAddress",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "_minter", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "decrease_liability",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "delegateCompLikeTo",
    values: [string, string]
  ): string;
  encodeFunctionData(
    functionFragment: "deposit_erc20",
    values: [string, BigNumberish]
  ): string;
  encodeFunctionData(functionFragment: "getBalances", values: [string]): string;
  encodeFunctionData(
    functionFragment: "getBaseLiability",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "getMinter", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "increase_liability",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "masterTransfer",
    values: [string, string, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "withdraw_erc20",
    values: [string, BigNumberish]
  ): string;

  decodeFunctionResult(
    functionFragment: "_baseLiability",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "_id", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "_masterAddress",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "_minter", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "decrease_liability",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "delegateCompLikeTo",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "deposit_erc20",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getBalances",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getBaseLiability",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "getMinter", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "increase_liability",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "masterTransfer",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "withdraw_erc20",
    data: BytesLike
  ): Result;

  events: {
    "Deposit(address,uint256)": EventFragment;
    "Withdraw(address,uint256)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "Deposit"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "Withdraw"): EventFragment;
}

export interface DepositEventObject {
  token_address: string;
  amount: BigNumber;
}
export type DepositEvent = TypedEvent<[string, BigNumber], DepositEventObject>;

export type DepositEventFilter = TypedEventFilter<DepositEvent>;

export interface WithdrawEventObject {
  token_address: string;
  amount: BigNumber;
}
export type WithdrawEvent = TypedEvent<
  [string, BigNumber],
  WithdrawEventObject
>;

export type WithdrawEventFilter = TypedEventFilter<WithdrawEvent>;

export interface Vault extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: VaultInterface;

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
    _baseLiability(overrides?: CallOverrides): Promise<[BigNumber]>;

    _id(overrides?: CallOverrides): Promise<[BigNumber]>;

    _masterAddress(overrides?: CallOverrides): Promise<[string]>;

    _minter(overrides?: CallOverrides): Promise<[string]>;

    decrease_liability(
      base_amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    delegateCompLikeTo(
      compLikeDelegatee: string,
      CompLikeToken: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    deposit_erc20(
      token_address: string,
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    getBalances(addr: string, overrides?: CallOverrides): Promise<[BigNumber]>;

    getBaseLiability(overrides?: CallOverrides): Promise<[BigNumber]>;

    getMinter(overrides?: CallOverrides): Promise<[string]>;

    increase_liability(
      base_amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    masterTransfer(
      _token: string,
      _to: string,
      _amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    withdraw_erc20(
      token_address: string,
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;
  };

  _baseLiability(overrides?: CallOverrides): Promise<BigNumber>;

  _id(overrides?: CallOverrides): Promise<BigNumber>;

  _masterAddress(overrides?: CallOverrides): Promise<string>;

  _minter(overrides?: CallOverrides): Promise<string>;

  decrease_liability(
    base_amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  delegateCompLikeTo(
    compLikeDelegatee: string,
    CompLikeToken: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  deposit_erc20(
    token_address: string,
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  getBalances(addr: string, overrides?: CallOverrides): Promise<BigNumber>;

  getBaseLiability(overrides?: CallOverrides): Promise<BigNumber>;

  getMinter(overrides?: CallOverrides): Promise<string>;

  increase_liability(
    base_amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  masterTransfer(
    _token: string,
    _to: string,
    _amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  withdraw_erc20(
    token_address: string,
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  callStatic: {
    _baseLiability(overrides?: CallOverrides): Promise<BigNumber>;

    _id(overrides?: CallOverrides): Promise<BigNumber>;

    _masterAddress(overrides?: CallOverrides): Promise<string>;

    _minter(overrides?: CallOverrides): Promise<string>;

    decrease_liability(
      base_amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    delegateCompLikeTo(
      compLikeDelegatee: string,
      CompLikeToken: string,
      overrides?: CallOverrides
    ): Promise<void>;

    deposit_erc20(
      token_address: string,
      amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    getBalances(addr: string, overrides?: CallOverrides): Promise<BigNumber>;

    getBaseLiability(overrides?: CallOverrides): Promise<BigNumber>;

    getMinter(overrides?: CallOverrides): Promise<string>;

    increase_liability(
      base_amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    masterTransfer(
      _token: string,
      _to: string,
      _amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    withdraw_erc20(
      token_address: string,
      amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {
    "Deposit(address,uint256)"(
      token_address?: null,
      amount?: null
    ): DepositEventFilter;
    Deposit(token_address?: null, amount?: null): DepositEventFilter;

    "Withdraw(address,uint256)"(
      token_address?: null,
      amount?: null
    ): WithdrawEventFilter;
    Withdraw(token_address?: null, amount?: null): WithdrawEventFilter;
  };

  estimateGas: {
    _baseLiability(overrides?: CallOverrides): Promise<BigNumber>;

    _id(overrides?: CallOverrides): Promise<BigNumber>;

    _masterAddress(overrides?: CallOverrides): Promise<BigNumber>;

    _minter(overrides?: CallOverrides): Promise<BigNumber>;

    decrease_liability(
      base_amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    delegateCompLikeTo(
      compLikeDelegatee: string,
      CompLikeToken: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    deposit_erc20(
      token_address: string,
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    getBalances(addr: string, overrides?: CallOverrides): Promise<BigNumber>;

    getBaseLiability(overrides?: CallOverrides): Promise<BigNumber>;

    getMinter(overrides?: CallOverrides): Promise<BigNumber>;

    increase_liability(
      base_amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    masterTransfer(
      _token: string,
      _to: string,
      _amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    withdraw_erc20(
      token_address: string,
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    _baseLiability(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    _id(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    _masterAddress(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    _minter(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    decrease_liability(
      base_amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    delegateCompLikeTo(
      compLikeDelegatee: string,
      CompLikeToken: string,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    deposit_erc20(
      token_address: string,
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    getBalances(
      addr: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getBaseLiability(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    getMinter(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    increase_liability(
      base_amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    masterTransfer(
      _token: string,
      _to: string,
      _amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    withdraw_erc20(
      token_address: string,
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;
  };
}
