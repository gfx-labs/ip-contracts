/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  Signer,
  utils,
  Contract,
  ContractFactory,
  BigNumberish,
  Overrides,
} from "ethers";
import type { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  ChainlinkOracleRelay,
  ChainlinkOracleRelayInterface,
} from "../../../oracle/External/ChainlinkOracleRelay";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "feed_address",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "mul",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "div",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "_divide",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "_feedAddress",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "_multiply",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "currentValue",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b5060405161069538038061069583398181016040528101906100329190610162565b826000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555082600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600281905550806003819055505050506101b5565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006100f9826100ce565b9050919050565b610109816100ee565b811461011457600080fd5b50565b60008151905061012681610100565b92915050565b6000819050919050565b61013f8161012c565b811461014a57600080fd5b50565b60008151905061015c81610136565b92915050565b60008060006060848603121561017b5761017a6100c9565b5b600061018986828701610117565b935050602061019a8682870161014d565b92505060406101ab8682870161014d565b9150509250925092565b6104d1806101c46000396000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c806328147333146100515780635873be3e1461006f578063698996f81461008d5780639a7ac214146100ab575b600080fd5b6100596100c9565b6040516100669190610258565b60405180910390f35b6100776100ed565b604051610084919061028c565b60405180910390f35b6100956100f3565b6040516100a2919061028c565b60405180910390f35b6100b3610102565b6040516100c0919061028c565b60405180910390f35b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60025481565b60006100fd610108565b905090565b60035481565b600080600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166350d25bcd6040518163ffffffff1660e01b815260040160206040518083038186803b15801561017357600080fd5b505afa158015610187573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906101ab91906102e2565b9050600081136101f0576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016101e790610392565b60405180910390fd5b60006003546002548361020391906103e1565b61020d919061046a565b9050809250505090565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061024282610217565b9050919050565b61025281610237565b82525050565b600060208201905061026d6000830184610249565b92915050565b6000819050919050565b61028681610273565b82525050565b60006020820190506102a1600083018461027d565b92915050565b600080fd5b6000819050919050565b6102bf816102ac565b81146102ca57600080fd5b50565b6000815190506102dc816102b6565b92915050565b6000602082840312156102f8576102f76102a7565b5b6000610306848285016102cd565b91505092915050565b600082825260208201905092915050565b7f636861696e6c696e6b206f7261636c65207265706f727465642070726963652060008201527f62656c6f77203000000000000000000000000000000000000000000000000000602082015250565b600061037c60278361030f565b915061038782610320565b604082019050919050565b600060208201905081810360008301526103ab8161036f565b9050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b60006103ec82610273565b91506103f783610273565b9250817fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff04831182151516156104305761042f6103b2565b5b828202905092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601260045260246000fd5b600061047582610273565b915061048083610273565b9250826104905761048f61043b565b5b82820490509291505056fea2646970667358221220908c26f9a31283ff20599b6a9fa2c89dd134616eeed5f4a599cfe071b84ee05e64736f6c63430008090033";

type ChainlinkOracleRelayConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: ChainlinkOracleRelayConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class ChainlinkOracleRelay__factory extends ContractFactory {
  constructor(...args: ChainlinkOracleRelayConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override deploy(
    feed_address: string,
    mul: BigNumberish,
    div: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ChainlinkOracleRelay> {
    return super.deploy(
      feed_address,
      mul,
      div,
      overrides || {}
    ) as Promise<ChainlinkOracleRelay>;
  }
  override getDeployTransaction(
    feed_address: string,
    mul: BigNumberish,
    div: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(feed_address, mul, div, overrides || {});
  }
  override attach(address: string): ChainlinkOracleRelay {
    return super.attach(address) as ChainlinkOracleRelay;
  }
  override connect(signer: Signer): ChainlinkOracleRelay__factory {
    return super.connect(signer) as ChainlinkOracleRelay__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): ChainlinkOracleRelayInterface {
    return new utils.Interface(_abi) as ChainlinkOracleRelayInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ChainlinkOracleRelay {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as ChainlinkOracleRelay;
  }
}
