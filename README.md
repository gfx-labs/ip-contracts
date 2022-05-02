# usdi contracts


slightly outdated documentation & overview located at

https://ip.pages.gfx.cafe/app/book

while most of the information is accurate, some of the functions have been renamed from snake_case to lowerCamel

whitepaper located in whitepaper/

## repository

```
*
├───test - test suites
│   └───mainnet/* - simulation of deployment and basic user interaction. npx hardhat test test/mainnet/index.ts
│   └───governance/* - simulation of governance processes. npx hardhat test test/governance/index.ts
├───contracts
│   ├───_external - external contracts copied into the repository, e.g. openzeppelin, uniswap, chainlink
│   │   └── (out of scope)
│   ├── governance - governance related contracts
│   │   ├── governor - governor is a reimplmentation of Governor Bravo, aptly named Governor Charlie. It uses a custom proxy system
│   │   │   ├── GovernorDelegate.sol - Delegate for governor contract
│   │   │   ├── GovernorDelegator.sol - Delegator for governor contract
│   │   │   ├── GovernorStorage.sol - Storage structs for governor contract
│   │   │   ├── IGovernor.sol - Interface & events for governor contract
│   │   │   ├── IIpt.sol - Helper IIpt interface
│   │   │   └── Structs.sol - Structs shared by governance
│   │   └─ token
│   │       ├── IToken.sol - Interface & events for governance token
│   │       ├── TokenDelegate.sol - Delegate for governance token
│   │       ├── TokenDelegator.sol - Delegator for governance token
│   │       └── TokenStorage.sol - Storage structs for governance token
│   ├── lending - contracts related to the IP lending system
│   │   ├── IVaultController.sol - Interface & events for vault controller
│   │   ├── IVault.sol - Interface & events for vault
│   │   ├── VaultController.sol - Vault controller, master of all vaults. manages interest across all vaults
│   │   └── Vault.sol - individual vault, simply an accounting wallet
│   ├── oracle
│   │   ├── External
│   │   │   ├── ChainlinkOracleRelay.sol - an oracle which hooks to a chainlink oracle
│   │   │   └── UniswapV3OracleRelay.sol - an oracle which hooks to a uniswap v3 pool
│   │   ├── Logic
│   │   │   └── AnchoredViewRelay.sol - an oracle which consumes two oracle relays and constructs an anchored view
│   │   ├── IOracleRelay.sol - generic interface for an oracle relay which can report a price
│   │   ├── IOracleMaster.sol - Interface for the oracle master
│   │   └── OracleMaster.sol - Oracle master is effecitvely an address book of oracle relays
│   ├── token
│   │   └── UFragments.sol - the amplforth ufragments contract
│   ├───IUSDI.sol - interface & events for USDI
│   └───USDI.sol - relabancing erc20 token
└───hardhat.config.ts - configuration for hardhat
```


## setup


`npm run setup`


## compile


`npm run compile`


## test

`npm run test`

`npm run testgov`
