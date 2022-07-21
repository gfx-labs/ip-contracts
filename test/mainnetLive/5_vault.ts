import { s } from "./scope";
import { expect } from "chai";
import { showBody, showBodyCyan } from "../../util/format";
import { mineBlock } from "../../util/block";
import { IVault__factory } from "../../typechain-types";
import { BN } from "../../util/number";
import { toNumber } from "../../util/math";
import { utils } from "ethers";


describe("Vault setup:", () => {
  it("mint vaults", async () => {
    //showBody("bob mint vault")
    await expect(s.VaultController.connect(s.Bob).mintVault()).to.not
      .reverted;
    await mineBlock();
    s.BobVaultID = await s.VaultController.vaultsMinted()
    let vaultAddress = await s.VaultController.vaultAddress(s.BobVaultID)
    s.BobVault = IVault__factory.connect(vaultAddress, s.Bob);
    expect(await s.BobVault.minter()).to.eq(s.Bob.address);

    //showBody("carol mint vault")
    await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
      .reverted;
    await mineBlock();
    s.CaroLVaultID = await s.VaultController.vaultsMinted()
    vaultAddress = await s.VaultController.vaultAddress(s.CaroLVaultID)
    s.CarolVault = IVault__factory.connect(vaultAddress, s.Carol);
    expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
  });
  it("vault deposits", async () => {
    await s.WETH.connect(s.Bob).transfer(s.BobVault.address, s.Bob_WETH)
      
    await s.UNI.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_UNI)
    
    await mineBlock();

    //showBody("bob transfer weth")
    expect(await s.BobVault.tokenBalance(s.wethAddress)).to.eq(s.Bob_WETH);

    //showBody("carol transfer uni")
    expect(await s.CarolVault.tokenBalance(s.uniAddress)).to.eq(s.Carol_UNI);
    await s.ENS.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_ENS)
    
    await s.DYDX.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_DYDX)
    
    await mineBlock()
  });

  it("what happens when someone simply transfers ether to a vault? ", async () => {
    let tx = {
      to: s.BobVault.address,
      value: utils.parseEther("1")
    }
    await expect(s.Bob.sendTransaction(tx)).to.be.reverted
    await mineBlock()
  })

  it("carol should be able to delegate votes", async () => {

    await expect(
      s.CarolVault.delegateCompLikeTo(s.compVotingAddress, s.ensAddress)
    )
    await expect(
      s.CarolVault.delegateCompLikeTo(s.compVotingAddress, s.dydxAddress)
    )
    await mineBlock();

    const currentVotesENS = await s.ENS.connect(s.Carol).getVotes(
      s.compVotingAddress
    );
    const currentVotesDYDX = await s.DYDX.connect(s.Carol).getPowerCurrent(
      s.compVotingAddress,
      BN("0")
    );
    //showBody("ENS: ", await toNumber(await s.ENS.balanceOf(s.CarolVault.address)))

    //expect(s.Carol_ENS).to.eq(currentVotesENS);
    //expect(s.Carol_DYDX).to.eq(currentVotesDYDX);

  });
});
