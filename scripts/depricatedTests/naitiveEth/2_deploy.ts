import { s } from "../scope";
//import { expect, assert } from "chai";
import { showBody, showBodyCyan } from "../../../util/format";
import { BN } from "../../../util/number";
import { advanceBlockHeight, nextBlockTime, fastForward, mineBlock, OneWeek, OneYear } from "../../../util/block";
import { utils, BigNumber } from "ethers";
import { calculateAccountLiability, payInterestMath, calculateBalance, getGas, getArgs, truncate, getEvent, calculatetokensToLiquidate, calculateUSDI2repurchase, changeInBalance } from "../../../util/math";
import { currentBlock, reset } from "../../../util/block"
import MerkleTree from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";
import { expect, assert } from "chai";
import {
    AnchoredViewRelay,
    AnchoredViewRelay__factory,
    ChainlinkOracleRelay,
    ChainlinkOracleRelay__factory,
    CurveMaster,
    CurveMaster__factory,
    IERC20,
    IERC20__factory,
    IOracleRelay,
    OracleMaster,
    OracleMaster__factory,
    ProxyAdmin,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    ThreeLines0_100,
    ThreeLines0_100__factory,
    UniswapV3OracleRelay__factory,
    USDI,
    USDI__factory,
    Vault,
    VaultController,
    VaultController__factory,
    IVOTE,
    IVOTE__factory,
} from "../../../typechain-types"
import { red } from "bn.js";




import { DeployContract, DeployContractWithProxy } from "../../../util/deploy";
let ProxyController: ProxyAdmin


const deployProxy = async () => {
    s.ProxyAdmin = await DeployContract(new ProxyAdmin__factory(s.Frank), s.Frank)
    await mineBlock()
    s.VaultController = await DeployContractWithProxy(
        new VaultController__factory(s.Frank),
        s.Frank,
        s.ProxyAdmin
    )
    await mineBlock()
    s.USDI = await DeployContractWithProxy(
        new USDI__factory(s.Frank),
        s.Frank,
        s.ProxyAdmin,
        s.usdcAddress
    )
    await mineBlock()
    let owner = await s.USDI.owner()
    //showBody("OWNER: ", owner)
    //showBody("Frank: ", s.Frank.address)

    //await expect(s.USDI.owner()).to.equal(s.Frank.address)
    //showBody("vault controller set vault owner")
    await s.USDI.setVaultController(s.VaultController.address)
    //await expect(s.USDI.setVaultController(s.VaultController.address)).to.not.reverted
    await mineBlock()

}


require('chai').should()
describe("Deploy Contracts", () => {
    before(async () => {
        await deployProxy()
    })
    it("Verify deployment of VaultController proxy", async () => {

        const protocolFee = await s.VaultController.connect(s.Andy).protocolFee()
        await mineBlock()
        const expectedProtocolFee = BN("1e14")
        assert.equal(protocolFee.toString(), expectedProtocolFee.toString(), "VaultController Initialized")

    })
    it("Verify deployment of USDi proxy", async () => {
        const reserveAddress = await s.USDI.reserveAddress()
        await mineBlock()
        const expectedReserveAddress = s.usdcAddress
        assert.equal(reserveAddress, expectedReserveAddress, "USDi Initialized")
    })
    describe("Sanity check USDI deploy", () => {
        it("Should return the right name, symbol, and decimals", async () => {
            expect(await s.USDI.name()).to.equal("USDI Token");
            expect(await s.USDI.symbol()).to.equal("USDI");
            expect(await s.USDI.decimals()).to.equal(18);
            expect(await s.USDI.owner()).to.equal(s.Frank.address)
        });
        it(`The burner address should have ${BN("1e18").toLocaleString()} fragment`, async () => {
            expect(await s.USDI.balanceOf("0x0000000000000000000000000000000000000000")).to.eq(BN("1e18"));
        });
        it(`the totalSupply should be ${BN("1e18").toLocaleString()}`, async () => {
            expect(await s.USDI.totalSupply()).to.eq(BN("1e18"));
        });
        it("the owner should be the Frank", async () => {
            expect(await s.USDI.owner()).to.eq(await s.Frank.getAddress());
        });
    });

    it("Deploy Curve", async () => {
        await mineBlock()
        s.ThreeLines = await DeployContract(new ThreeLines0_100__factory(s.Frank), s.Frank,
            BN("200e16"),
            BN("5e16"),
            BN("45e15"),
            BN("50e16"),
            BN("55e16"),
        );
        await mineBlock()
        s.Curve = await DeployContract(new CurveMaster__factory(s.Frank), s.Frank)
        await mineBlock()
        await expect(s.VaultController.registerCurveMaster(s.Curve.address)).to.not.reverted;
        await mineBlock()
    })


    it("Deploy Oracles", async () => {
        s.Oracle = await DeployContract(new OracleMaster__factory(s.Frank), s.Frank);
        //showBody("set vault oraclemaster")
        await expect(s.VaultController.connect(s.Frank).registerOracleMaster(
            s.Oracle.address
        )).to.not.reverted;

        //showBody("create uniswap comp relay")
        s.UniswapRelayCompUsdc = await DeployContract(new UniswapV3OracleRelay__factory(s.Frank),
            s.Frank,
            60,
            s.usdcCompPool, true, BN("1e12"), BN("1"));
        await mineBlock()
        expect(await s.UniswapRelayCompUsdc.currentValue()).to.not.eq(0)

        //showBody("create uniswap eth relay")
        s.UniswapRelayEthUsdc = await DeployContract(new UniswapV3OracleRelay__factory(s.Frank),
            s.Frank,
            60,
            s.usdcWethPool, true, BN("1e12"), BN("1"));
        await mineBlock()

        //showBody("create chainlink comp relay")
        s.ChainlinkComp = await DeployContract(new ChainlinkOracleRelay__factory(s.Frank), s.Frank,
            "0xdbd020caef83efd542f4de03e3cf0c28a4428bd5", BN("1e10"), BN("1")
        );
        await mineBlock()
        expect(await s.ChainlinkComp.currentValue()).to.not.eq(0)

        //showBody("create chainlink eth relay")
        s.ChainlinkEth = await DeployContract(new ChainlinkOracleRelay__factory(s.Frank), s.Frank,
            "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419", BN("1e10"), BN("1")
        )
        await mineBlock()
        expect(await s.ChainlinkEth.currentValue()).to.not.eq(0)

        //showBody("create COMP anchoredview")
        s.AnchoredViewComp = await DeployContract(new AnchoredViewRelay__factory(s.Frank), s.Frank,
            s.UniswapRelayCompUsdc.address,
            s.ChainlinkComp.address,
            BN("30"),
            BN("100")
        );
        await mineBlock()
        expect(await s.AnchoredViewComp.currentValue()).to.not.eq(0)

        //showBody("create ETH anchoredview")
        s.AnchoredViewEth = await DeployContract(new AnchoredViewRelay__factory(s.Frank), s.Frank,
            s.UniswapRelayEthUsdc.address,
            s.ChainlinkEth.address,
            BN("10"),
            BN("100")
        );
        await mineBlock()
        expect(await s.AnchoredViewEth.currentValue()).to.not.eq(0)
        await mineBlock()
    })

    it("Set vault oracles and CFs", async () => {
        //showBody("set vault COMP oracle to anchored view")
        await expect(s.Oracle.connect(s.Frank).setRelay(
            s.compAddress,
            s.AnchoredViewComp.address
        )).to.not.reverted;

        //showBody("set vault ETH oracle to anchored view")
        await s.Oracle.connect(s.Frank).setRelay(
            s.wethAddress,
            s.AnchoredViewEth.address,
        );
        //showBody("register weth")
        await expect(s.VaultController.connect(s.Frank).registerErc20(
            s.wethAddress,
            s.wETH_LTV,
            s.wethAddress,
            s.LiquidationIncentive,
        )).to.not.reverted;
        //showBody("register comp")
        await expect(s.VaultController.connect(s.Frank).registerErc20(
            s.compAddress,
            s.COMP_LTV,
            s.compAddress,
            s.LiquidationIncentive,
        )).to.not.reverted;

        //showBody("register vaultcontroller usdi")
        await expect(s.VaultController.connect(s.Frank)
            .registerUSDi(s.USDI.address)).to.not.reverted
        await mineBlock()
    })
    it("test setting a new curve", async () => {
        await expect(s.Curve.connect(s.Frank).setCurve(
            "0x0000000000000000000000000000000000000000",
            s.ThreeLines.address
        )).to.not.reverted;
        await mineBlock();
    })
})


