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
    const mv = s.VaultController.connect(s.Bob).mintVault();
    await expect(mv).to.not.reverted;
    await mineBlock();
    showBodyCyan("vault mint gas cost", (await (await mv).wait()).gasUsed);
    let bobVault = await s.VaultController.vaultAddress(1);
    s.BobVault = IVault__factory.connect(bobVault, s.Bob);
    expect(await s.BobVault.minter()).to.eq(s.Bob.address);

    //showBody("carol mint vault")
    await expect(s.VaultController.connect(s.Carol).mintVault()).to.not
      .reverted;
    await mineBlock();
    let carolVault = await s.VaultController.vaultAddress(2);
    s.CarolVault = IVault__factory.connect(carolVault, s.Carol);
    expect(await s.CarolVault.minter()).to.eq(s.Carol.address);
  });
  it("vault deposits", async () => {
    await expect(s.WETH.connect(s.Bob).transfer(s.BobVault.address, s.Bob_WETH))
      .to.not.reverted;
    await expect(
      s.UNI.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_UNI)
    ).to.not.reverted;
    await mineBlock();

    //showBody("bob transfer weth")
    expect(await s.BobVault.tokenBalance(s.wethAddress)).to.eq(s.Bob_WETH);

    //showBody("carol transfer uni")
    expect(await s.CarolVault.tokenBalance(s.uniAddress)).to.eq(s.Carol_UNI);
    await expect(
      s.ENS.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_ENS)
    ).to.not.reverted;
    await expect(
      s.DYDX.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_DYDX)
    ).to.not.reverted;
    await expect(
      s.AAVE.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_AAVE)
    ).to.not.reverted;
    await expect(
      s.TRIBE.connect(s.Carol).transfer(s.CarolVault.address, s.Carol_TRIBE)
    ).to.not.reverted;
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
    ).to.not.reverted;
    await expect(
      s.CarolVault.delegateCompLikeTo(s.compVotingAddress, s.dydxAddress)
    ).to.not.reverted;
    await expect(
      s.CarolVault.delegateCompLikeTo(s.compVotingAddress, s.aaveAddress)
    ).to.not.reverted;
    await expect(
      s.CarolVault.delegateCompLikeTo(s.compVotingAddress, s.tribeAddress)
    ).to.not.reverted;
    await mineBlock();
    const currentVotesAAVE = await s.AAVE.connect(s.Carol).getPowerCurrent(
      s.compVotingAddress,
      BN("0")
    );
    const currentVotesENS = await s.ENS.connect(s.Carol).getVotes(
      s.compVotingAddress
    );
    const currentVotesDYDX = await s.DYDX.connect(s.Carol).getPowerCurrent(
      s.compVotingAddress,
      BN("0")
    );
    const currentVotesTRIBE = await s.TRIBE.connect(s.Carol).getCurrentVotes(
      s.compVotingAddress
    );

    expect(s.Carol_AAVE).to.eq(currentVotesAAVE);
    expect(s.Carol_ENS).to.eq(currentVotesENS);
    expect(s.Carol_DYDX).to.eq(currentVotesDYDX);
    expect(s.Carol_TRIBE).to.eq(currentVotesTRIBE);

  });
});
