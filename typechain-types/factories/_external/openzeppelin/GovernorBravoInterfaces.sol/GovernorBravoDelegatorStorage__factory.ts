/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import type { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  GovernorBravoDelegatorStorage,
  GovernorBravoDelegatorStorageInterface,
} from "../../../../_external/openzeppelin/GovernorBravoInterfaces.sol/GovernorBravoDelegatorStorage";

const _abi = [
  {
    inputs: [],
    name: "admin",
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
    name: "implementation",
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
    name: "pendingAdmin",
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
];

const _bytecode =
  "0x608060405234801561001057600080fd5b5060c98061001f6000396000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c8063267822471460415780635c60da1b14606f578063f851a440146081575b600080fd5b6001546053906001600160a01b031681565b6040516001600160a01b03909116815260200160405180910390f35b6002546053906001600160a01b031681565b6000546053906001600160a01b03168156fea2646970667358221220458f5de9401f8d7321b48c8dd74a2897e273937db31242af2d2845105a13630664736f6c63430008090033";

type GovernorBravoDelegatorStorageConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: GovernorBravoDelegatorStorageConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class GovernorBravoDelegatorStorage__factory extends ContractFactory {
  constructor(...args: GovernorBravoDelegatorStorageConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<GovernorBravoDelegatorStorage> {
    return super.deploy(
      overrides || {}
    ) as Promise<GovernorBravoDelegatorStorage>;
  }
  override getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  override attach(address: string): GovernorBravoDelegatorStorage {
    return super.attach(address) as GovernorBravoDelegatorStorage;
  }
  override connect(signer: Signer): GovernorBravoDelegatorStorage__factory {
    return super.connect(signer) as GovernorBravoDelegatorStorage__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): GovernorBravoDelegatorStorageInterface {
    return new utils.Interface(_abi) as GovernorBravoDelegatorStorageInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): GovernorBravoDelegatorStorage {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as GovernorBravoDelegatorStorage;
  }
}
