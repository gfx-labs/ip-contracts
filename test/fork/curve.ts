import { expect } from "chai";
import { ethers } from "hardhat";
import { Mainnet } from "../util/addresser";
import { Deployment } from "../util/contractor";
import { BN } from "../util/number";

let contracts = Deployment;

const first = async () => {
    let accounts = await ethers.getSigners();
    await contracts.deploy(accounts[0]).catch(console.log);
};

describe("curve-threelines:", () => {
    before("deploy contracts", first);
    it("test curve", async () => {
        let val = (await contracts.Curve!.get_value_at("0x0000000000000000000000000000000000000000", "0")).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(2);
        val = (await contracts.Curve!.get_value_at("0x0000000000000000000000000000000000000000", BN("25e16"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(1.025);
        val = (await contracts.Curve!.get_value_at("0x0000000000000000000000000000000000000000", BN("50e16"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.05);
        val = (await contracts.Curve!.get_value_at("0x0000000000000000000000000000000000000000", BN("525e15"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.0475);
        val = (await contracts.Curve!.get_value_at("0x0000000000000000000000000000000000000000", BN("55e16"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.045);
        val = (await contracts.Curve!.get_value_at("0x0000000000000000000000000000000000000000", BN("1e18"))).div(1e14).toNumber() / (1e4)
        expect(val).to.eq(0.01);
    });
});

describe("curve-master:", () => {
    before("deploy contracts", first);

});
