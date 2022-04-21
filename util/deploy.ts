import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Proxy, ProxyAdmin, TransparentUpgradeableProxy__factory, OwnableUpgradeable } from "../typechain-types"

import { advanceBlockHeight, fastForward, mineBlock, OneWeek, OneYear } from "./block";

export const DeployContractWithProxy = async (factory: ContractFactory, deployer: Signer, admin: ProxyAdmin, ...args: any[]): Promise<any> => {
    const uVC = await factory.connect(deployer).deploy()
    let vc = await new TransparentUpgradeableProxy__factory(deployer).connect(deployer).deploy(uVC.address, admin.address, "0x");
    await mineBlock()
    await vc.deployed()
    await mineBlock()
    const con = factory.attach(vc.address)
    await con.initialize(...args)
    return mineBlock().then(() => { return con })
}

export const DeployContract = async (factory: ContractFactory, deployer: Signer, ...args: any[]): Promise<any> => {
    const uVC = await factory.connect(deployer).deploy(...args)
    await mineBlock()
    await uVC.deployed()
    return mineBlock().then(() => { return factory.attach(uVC.address) })
}