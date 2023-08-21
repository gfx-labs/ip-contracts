import { Signer, ContractFactory } from "ethers";
import { ProxyAdmin, TransparentUpgradeableProxy__factory } from "../typechain-types";

import { mineBlock } from "./block";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const DeployContractWithProxy = async (
    factory: ContractFactory,
    deployer: Signer,
    admin: ProxyAdmin,
    ...args: any[]
): Promise<any> => {
    if (process.env.NOPROXY == "TRUE" || process.env.NOPROXY == "true") {
        const vc = await factory.connect(deployer).deploy()
        await mineBlock()
        await vc.deployed()
        await mineBlock()
        const con = factory.attach(vc.address)
        await con.initialize(...args)
        return mineBlock().then(() => { return con })
    }
    const uVC = await factory.connect(deployer).deploy()
    let vc = await new TransparentUpgradeableProxy__factory(deployer).connect(deployer).deploy(uVC.address, admin.address, "0x");
    await mineBlock()
    await vc.deployed()
    await mineBlock()
    const con = factory.attach(vc.address)
    await con.initialize(...args)

    //    await tenderly.network().verify({
    //        name: con.,
    //        address: con.address
    //    })

    return mineBlock().then(() => { return con })
}

export const DeployContract = async (factory: ContractFactory, deployer: Signer, ...args: any[]): Promise<any> => {
    const uVC = await factory.connect(deployer).deploy(...args)
    await mineBlock()
    await uVC.deployed()
    return mineBlock().then(() => { return factory.attach(uVC.address) })
}


//pass implementation if re-using an existing one, or pass "" to deploy a new one
export const DeployNewProxyContract = async (
    factory: ContractFactory,
    deployer: SignerWithAddress,
    admin: string,
    implementation?: string,
    ...args: any[]
): Promise<any> => {
    if (implementation ==  undefined) {
        //deploy new implementation
        const newImp = await factory.connect(deployer).deploy()
        await newImp.deployed()
        implementation = newImp.address
        console.log("New Implementation Deployed: ", implementation)
    }


    const newProxy = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        implementation,
        admin,
        "0x"
    )
    await newProxy.deployed()

    const contract = factory.attach(newProxy.address)
    const initialize = await contract.initialize(...args)
    await initialize.wait()
    return mineBlock().then(() => { return contract })

}
