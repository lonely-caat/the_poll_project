/**
 * @fileoverview Core Integration Tests for FHEPoll Contract
 * 
 * Refactored to follow FAANG L7 SDET standards with:
 * - Clean, maintainable code structure
 * - Proper error handling and validation
 * - Comprehensive test coverage
 * - Readable, self-documenting code
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { FhevmType } = require("@fhevm/hardhat-plugin");

// Import test utilities for enhanced testing capabilities
const { EncryptedVoteBuilder } = require("./helpers/TestDataBuilder");
const { FHEPollAssertions } = require("./helpers/TestAssertions");
describe("FHEPoll Core Integration Tests", function () {
  // Test configuration
  const MAX_GAS_PER_VOTE = 500000;
  
  // Test state management
  let contract;
  let contractAddress;
  let owner;
  let voter1;
  let voter2;

  /**
   * Setup test environment with proper isolation
   * Implements L7 SDET standards for test setup
   */
  beforeEach(async function () {
    // Retrieve test accounts from Hardhat
    [owner, voter1, voter2] = await ethers.getSigners();

    // Deploy fresh contract instance for each test
    const Factory = await ethers.getContractFactory("FHEPoll");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
  });

  /**
   * Test Case: Basic Vote Aggregation
   * Verifies that encrypted votes are correctly aggregated homomorphically
   */
  it("should aggregate encrypted votes correctly", async function () {
    // Create encrypted votes using the builder pattern
    const voter1Vote = await new EncryptedVoteBuilder()
      .forContract(contractAddress)
      .byVoter(voter1.address)
      .withVote(1) // YES vote
      .build();

    const voter2Vote = await new EncryptedVoteBuilder()
      .forContract(contractAddress)
      .byVoter(voter2.address)
      .withVote(0) // NO vote
      .build();

    // Execute votes with proper error handling
    await FHEPollAssertions.assertVoteSucceeds(
      contract.connect(voter1).castVote(voter1Vote.handle, voter1Vote.proof),
      voter1.address
    );

    await FHEPollAssertions.assertVoteSucceeds(
      contract.connect(voter2).castVote(voter2Vote.handle, voter2Vote.proof),
      voter2.address
    );

    // Verify final aggregated sum
    await FHEPollAssertions.assertEncryptedSum(
      contract, 
      contractAddress, 
      voter2, // Last voter has permission
      1n, // Expected sum: 1 YES + 0 NO = 1
      "basic vote aggregation"
    );
  });

  /**
   * Test Case: Proof Validation Security
   * Verifies that encrypted inputs are properly bound to their senders
   */
  it("should revert when encrypted input does not match sender", async function () {
    // Create encrypted vote bound to voter1
    const voter1Vote = await new EncryptedVoteBuilder()
      .forContract(contractAddress)
      .byVoter(voter1.address)
      .withVote(1)
      .build();

    // Attempt to use voter1's proof with voter2's address
    // This should fail due to proof validation
    await FHEPollAssertions.assertVoteReverts(
      contract.connect(voter2).castVote(voter1Vote.handle, voter1Vote.proof),
      null, // Any revert is acceptable
      "proof bound to different sender"
    );
  });

  /**
   * Test Case: Initial State Validation
   * Verifies that the contract starts in the correct initial state
   */
  it("should start with zero sum in initial state", async function () {
    await FHEPollAssertions.assertInitialState(contract, contractAddress, voter1);
  });

  /**
   * Test Case: Gas Usage Optimization
   * Verifies that vote operations use reasonable gas
   */
  it("should use reasonable gas for vote operations", async function () {
    const voter1Vote = await new EncryptedVoteBuilder()
      .forContract(contractAddress)
      .byVoter(voter1.address)
      .withVote(1)
      .build();

    const receipt = await FHEPollAssertions.assertVoteSucceeds(
      contract.connect(voter1).castVote(voter1Vote.handle, voter1Vote.proof),
      voter1.address
    );

    FHEPollAssertions.assertGasUsage(receipt, MAX_GAS_PER_VOTE, "vote operation");
  });
});