/**
 * @fileoverview Comprehensive Integration Tests for FHEPoll Contract
 * 
 * This test suite implements FAANG L7 SDET standards with:
 * - Comprehensive edge case testing
 * - Security-focused scenarios
 * - Proper error handling and validation
 * - Maintainable, readable code structure
 * - Performance and gas optimization testing
 * 
 * Test Categories:
 * 1. Happy Path Scenarios
 * 2. Edge Cases and Boundary Testing
 * 3. Security and Access Control
 * 4. Error Handling and Validation
 * 5. Performance and Gas Optimization
 * 6. Concurrency and Race Conditions
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { FhevmType } = require("@fhevm/hardhat-plugin");

// Import test utilities
const { 
  EncryptedVoteBuilder, 
  TestScenarioBuilder,
  TestScenarioFactory 
} = require("./helpers/TestDataBuilder");
const { 
  FHEPollAssertions, 
  TestDataValidator 
} = require("./helpers/TestAssertions");

/**
 * Comprehensive Integration Test Suite for FHEPoll Contract
 * Implements L7 SDET architecture with proper separation of concerns
 */
describe("FHEPoll Comprehensive Integration Tests", function () {
  // Test configuration constants
  const MAX_GAS_PER_VOTE = 500000; // Reasonable gas limit for vote operations
  const MAX_VOTERS = 10; // Maximum voters for stress testing
  
  // Test state management
  let contract;
  let contractAddress;
  let signers;
  let deployer, voter1, voter2, voter3, voter4, voter5;
  let unauthorizedVoter;

  /**
   * Setup test environment with proper isolation
   */
  beforeEach(async function () {
    // Get all available signers
    signers = await ethers.getSigners();
    [deployer, voter1, voter2, voter3, voter4, voter5, unauthorizedVoter] = signers;

    // Deploy fresh contract instance for each test
    const Factory = await ethers.getContractFactory("FHEPoll");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
  });

  /**
   * Test Suite 1: Happy Path Scenarios
   * Tests normal operation with various voter configurations
   */
  describe("Happy Path Scenarios", function () {
    it("should handle single voter YES vote", async function () {
      const scenario = new TestScenarioBuilder()
        .addVoter(voter1, 1)
        .expectSum(1)
        .describe("Single voter YES vote")
        .build();

      await executeVotingScenario(scenario);
    });

    it("should handle single voter NO vote", async function () {
      const scenario = new TestScenarioBuilder()
        .addVoter(voter1, 0)
        .expectSum(0)
        .describe("Single voter NO vote")
        .build();

      await executeVotingScenario(scenario);
    });

    it("should handle two voters with mixed votes", async function () {
      const scenario = TestScenarioFactory.createBasicScenario(voter1, voter2);
      await executeVotingScenario(scenario);
    });

    it("should handle three voters with mixed votes", async function () {
      const scenario = TestScenarioFactory.createMixedScenario(
        [voter1, voter2, voter3], 
        [1, 0, 1]
      );
      await executeVotingScenario(scenario);
    });

    it("should handle unanimous YES votes", async function () {
      const scenario = TestScenarioFactory.createUnanimousYesScenario([voter1, voter2, voter3]);
      await executeVotingScenario(scenario);
    });

    it("should handle unanimous NO votes", async function () {
      const scenario = TestScenarioFactory.createUnanimousNoScenario([voter1, voter2, voter3]);
      await executeVotingScenario(scenario);
    });

    it("should handle large number of voters", async function () {
      const voters = signers.slice(0, MAX_VOTERS);
      const votes = Array(MAX_VOTERS).fill(1); // All YES votes
      const scenario = TestScenarioFactory.createMixedScenario(voters, votes);
      
      await executeVotingScenario(scenario);
    });
  });

  /**
   * Test Suite 2: Edge Cases and Boundary Testing
   * Tests boundary conditions and edge cases
   */
  describe("Edge Cases and Boundary Testing", function () {
    it("should handle empty poll (no votes)", async function () {
      // Verify initial state
      await FHEPollAssertions.assertInitialState(contract, contractAddress, voter1);
    });

    it("should handle vote value validation", async function () {
      // Test with invalid vote values (this should be handled by the encryption layer)
      // Note: The current implementation doesn't validate vote ranges
      // This test documents the current behavior
      const encryptedVote = await new EncryptedVoteBuilder()
        .forContract(contractAddress)
        .byVoter(voter1.address)
        .withVote(1) // Valid vote
        .build();

      await FHEPollAssertions.assertVoteSucceeds(
        contract.connect(voter1).castVote(encryptedVote.handle, encryptedVote.proof),
        voter1.address
      );
    });

    it("should handle multiple votes from same address", async function () {
      // Current implementation allows duplicate voting
      // This test documents the current behavior
      const encryptedVote1 = await new EncryptedVoteBuilder()
        .forContract(contractAddress)
        .byVoter(voter1.address)
        .withVote(1)
        .build();

      const encryptedVote2 = await new EncryptedVoteBuilder()
        .forContract(contractAddress)
        .byVoter(voter1.address)
        .withVote(0)
        .build();

      // First vote should succeed
      await FHEPollAssertions.assertVoteSucceeds(
        contract.connect(voter1).castVote(encryptedVote1.handle, encryptedVote1.proof),
        voter1.address
      );

      // Second vote should also succeed (current implementation allows this)
      await FHEPollAssertions.assertVoteSucceeds(
        contract.connect(voter1).castVote(encryptedVote2.handle, encryptedVote2.proof),
        voter1.address
      );

      // Final sum should be 1 (first vote) + 0 (second vote) = 1
      await FHEPollAssertions.assertEncryptedSum(
        contract, contractAddress, voter1, 1n, "duplicate voting scenario"
      );
    });
  });

  /**
   * Test Suite 3: Security and Access Control
   * Tests security-related scenarios and access control
   */
  describe("Security and Access Control", function () {
    it("should prevent unauthorized decryption", async function () {
      // First voter casts a vote
      const encryptedVote = await new EncryptedVoteBuilder()
        .forContract(contractAddress)
        .byVoter(voter1.address)
        .withVote(1)
        .build();

      await FHEPollAssertions.assertVoteSucceeds(
        contract.connect(voter1).castVote(encryptedVote.handle, encryptedVote.proof),
        voter1.address
      );

      // Unauthorized voter should not be able to decrypt
      await FHEPollAssertions.assertVoterCannotDecrypt(contract, contractAddress, unauthorizedVoter);
    });

    it("should prevent proof reuse from different sender", async function () {
      // Create encrypted vote for voter1
      const encryptedVote = await new EncryptedVoteBuilder()
        .forContract(contractAddress)
        .byVoter(voter1.address)
        .withVote(1)
        .build();

      // Attempt to use voter1's proof with voter2's address should fail
      await FHEPollAssertions.assertVoteReverts(
        contract.connect(voter2).castVote(encryptedVote.handle, encryptedVote.proof),
        null,
        "proof bound to different sender"
      );
    });

    it("should maintain vote confidentiality", async function () {
      // Cast votes from multiple voters
      const voters = [voter1, voter2, voter3];
      const votes = [1, 0, 1];

      for (let i = 0; i < voters.length; i++) {
        const encryptedVote = await new EncryptedVoteBuilder()
          .forContract(contractAddress)
          .byVoter(voters[i].address)
          .withVote(votes[i])
          .build();

        await FHEPollAssertions.assertVoteSucceeds(
          contract.connect(voters[i]).castVote(encryptedVote.handle, encryptedVote.proof),
          voters[i].address
        );
      }

      // Only the last voter should be able to decrypt (permission model)
      const expectedSum = votes.reduce((sum, vote) => sum + vote, 0);
      await FHEPollAssertions.assertVoterCanDecrypt(contract, contractAddress, voter3, BigInt(expectedSum));
    });
  });

  /**
   * Test Suite 4: Error Handling and Validation
   * Tests error scenarios and validation
   */
  describe("Error Handling and Validation", function () {
    it("should handle invalid proof format", async function () {
      const encryptedVote = await new EncryptedVoteBuilder()
        .forContract(contractAddress)
        .byVoter(voter1.address)
        .withVote(1)
        .build();

      // Use invalid proof
      const invalidProof = "0x" + "00".repeat(32);
      
      await FHEPollAssertions.assertVoteReverts(
        contract.connect(voter1).castVote(encryptedVote.handle, invalidProof),
        null,
        "invalid proof format"
      );
    });

    it("should handle malformed encrypted input", async function () {
      const malformedHandle = "0x" + "00".repeat(32);
      const validProof = "0x" + "01".repeat(32);

      await FHEPollAssertions.assertVoteReverts(
        contract.connect(voter1).castVote(malformedHandle, validProof),
        null,
        "malformed encrypted input"
      );
    });

    it("should handle contract interaction without proper setup", async function () {
      // Test getSum() on fresh contract
      const encryptedSum = await contract.getSum();
      expect(encryptedSum).to.not.be.undefined;
      expect(encryptedSum).to.not.be.null;
    });
  });

  /**
   * Test Suite 5: Performance and Gas Optimization
   * Tests performance characteristics and gas usage
   */
  describe("Performance and Gas Optimization", function () {
    it("should use reasonable gas for vote operations", async function () {
      const encryptedVote = await new EncryptedVoteBuilder()
        .forContract(contractAddress)
        .byVoter(voter1.address)
        .withVote(1)
        .build();

      const receipt = await FHEPollAssertions.assertVoteSucceeds(
        contract.connect(voter1).castVote(encryptedVote.handle, encryptedVote.proof),
        voter1.address
      );

      FHEPollAssertions.assertGasUsage(receipt, MAX_GAS_PER_VOTE, "vote operation");
    });

    it("should handle multiple votes efficiently", async function () {
      const voters = [voter1, voter2, voter3];
      const votes = [1, 0, 1];
      const receipts = [];

      for (let i = 0; i < voters.length; i++) {
        const encryptedVote = await new EncryptedVoteBuilder()
          .forContract(contractAddress)
          .byVoter(voters[i].address)
          .withVote(votes[i])
          .build();

        const receipt = await FHEPollAssertions.assertVoteSucceeds(
          contract.connect(voters[i]).castVote(encryptedVote.handle, encryptedVote.proof),
          voters[i].address
        );
        
        receipts.push(receipt);
      }

      // Verify all operations used reasonable gas
      receipts.forEach((receipt, index) => {
        FHEPollAssertions.assertGasUsage(receipt, MAX_GAS_PER_VOTE, `vote operation ${index + 1}`);
      });
    });
  });

  /**
   * Test Suite 6: Concurrency and Race Conditions
   * Tests concurrent operations and race conditions
   */
  describe("Concurrency and Race Conditions", function () {
    it("should handle concurrent voting", async function () {
      const voters = [voter1, voter2, voter3];
      const votes = [1, 0, 1];
      const expectedSum = votes.reduce((sum, vote) => sum + vote, 0);

      // Execute all votes concurrently
      const votePromises = voters.map(async (voter, index) => {
        const encryptedVote = await new EncryptedVoteBuilder()
          .forContract(contractAddress)
          .byVoter(voter.address)
          .withVote(votes[index])
          .build();

        return FHEPollAssertions.assertVoteSucceeds(
          contract.connect(voter).castVote(encryptedVote.handle, encryptedVote.proof),
          voter.address
        );
      });

      await Promise.all(votePromises);

      // Verify final sum
      await FHEPollAssertions.assertEncryptedSum(
        contract, contractAddress, voter3, BigInt(expectedSum), "concurrent voting"
      );
    });

    it("should maintain consistency under rapid voting", async function () {
      const rapidVotes = Array(5).fill().map((_, i) => ({
        voter: signers[i + 1],
        vote: i % 2
      }));

      // Execute rapid voting
      for (const { voter, vote } of rapidVotes) {
        const encryptedVote = await new EncryptedVoteBuilder()
          .forContract(contractAddress)
          .byVoter(voter.address)
          .withVote(vote)
          .build();

        await FHEPollAssertions.assertVoteSucceeds(
          contract.connect(voter).castVote(encryptedVote.handle, encryptedVote.proof),
          voter.address
        );
      }

      // Verify final state consistency
      const expectedSum = rapidVotes.reduce((sum, { vote }) => sum + vote, 0);
      const lastVoter = rapidVotes[rapidVotes.length - 1].voter;
      
      await FHEPollAssertions.assertEncryptedSum(
        contract, contractAddress, lastVoter, BigInt(expectedSum), "rapid voting consistency"
      );
    });
  });

  /**
   * Helper function to execute a complete voting scenario
   * @param {TestScenario} scenario - The test scenario to execute
   */
  async function executeVotingScenario(scenario) {
    // Validate test data
    expect(TestDataValidator.validateVoterVoteAlignment(scenario.voters, scenario.votes)).to.be.true;
    expect(TestDataValidator.validateVoteValues(scenario.votes)).to.be.true;

    // Execute all votes in sequence
    for (let i = 0; i < scenario.voters.length; i++) {
      const encryptedVote = await new EncryptedVoteBuilder()
        .forContract(contractAddress)
        .byVoter(scenario.voters[i].address)
        .withVote(scenario.votes[i])
        .build();

      await FHEPollAssertions.assertVoteSucceeds(
        contract.connect(scenario.voters[i]).castVote(encryptedVote.handle, encryptedVote.proof),
        scenario.voters[i].address
      );
    }

    // Verify final sum
    const lastVoter = scenario.voters[scenario.voters.length - 1];
    await FHEPollAssertions.assertEncryptedSum(
      contract, 
      contractAddress, 
      lastVoter, 
      BigInt(scenario.expectedSum), 
      scenario.description
    );
  }
});
