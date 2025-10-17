const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { FhevmType } = require("@fhevm/hardhat-plugin");

/*
 * End‑to‑end test simulating a complete voting session.  This test
 * orchestrates deployment, multiple voter interactions, and final
 * decryption of the aggregated result, mirroring a real user journey.
 */
describe("FHEPoll end‑to‑end", function () {
  it("runs through an entire poll with three voters", async function () {
    const [deployer, alice, bob, carol] = await ethers.getSigners();

    // Deploy a fresh poll contract.  A deployment per test ensures
    // isolated state and avoids cross‑test contamination.
    const Factory = await ethers.getContractFactory("FHEPoll");
    const poll = await Factory.deploy();
    // In Ethers v6 the `deployed` helper has been removed.  Wait for
    // deployment explicitly to ensure the contract is mined.
    await poll.waitForDeployment();

    // Helper function to cast a vote on behalf of a signer.  Encapsulates
    // the encryption workflow and transaction sending in one place,
    // improving readability and ensuring DRY code.
    async function castVoteFor(signer, value) {
      const contractAddress = await poll.getAddress();
      const input = hre.fhevm.createEncryptedInput(contractAddress, signer.address);
      input.add32(value);
      const encrypted = await input.encrypt();
      // Pass the correct `inputProof` property instead of `.proof`, which is undefined in fhEVM v0.9.  See
      // https://docs.zama.ai/protocol/solidity-guides/smart-contract/inputs for details on the returned object.
      const tx = await poll
        .connect(signer)
        .castVote(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();
    }

    // Alice votes YES (1), Bob votes NO (0), Carol votes YES (1).
    await castVoteFor(alice, 1);
    await castVoteFor(bob, 0);
    await castVoteFor(carol, 1);

    // Fetch the encrypted result from the chain.
    const encryptedSum = await poll.getSum();

    // Decrypt using the last voter (carol) who has permission on the latest handle.
    const contractAddress = await poll.getAddress();
    const clearSum = await hre.fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedSum,
      contractAddress,
      carol,
    );

    // The poll should reflect two YES votes and one NO vote, resulting in a
    // total sum of 2.  This assertion confirms the end‑to‑end flow works.
    expect(clearSum).to.equal(2n);
  });
});