/**
 * @fileoverview Test Data Builder for FHE Poll Testing
 * Implements Builder Pattern for creating test scenarios with proper encapsulation
 * and immutability principles following FAANG L7 SDET standards.
 */

const { ethers } = require("hardhat");
const hre = require("hardhat");
const { FhevmType } = require("@fhevm/hardhat-plugin");

/**
 * Builder for creating encrypted vote test data
 * Implements Builder Pattern for test data construction
 */
class EncryptedVoteBuilder {
  constructor() {
    this._contractAddress = null;
    this._voterAddress = null;
    this._voteValue = null;
    this._customOptions = {};
  }

  /**
   * Sets the contract address for encryption context
   * @param {string} contractAddress - The contract address
   * @returns {EncryptedVoteBuilder} - Fluent interface for chaining
   */
  forContract(contractAddress) {
    this._contractAddress = contractAddress;
    return this;
  }

  /**
   * Sets the voter address for encryption context
   * @param {string} voterAddress - The voter's address
   * @returns {EncryptedVoteBuilder} - Fluent interface for chaining
   */
  byVoter(voterAddress) {
    this._voterAddress = voterAddress;
    return this;
  }

  /**
   * Sets the vote value (0 for no, 1 for yes)
   * @param {number} value - The vote value
   * @returns {EncryptedVoteBuilder} - Fluent interface for chaining
   */
  withVote(value) {
    if (value !== 0 && value !== 1) {
      throw new Error(`Invalid vote value: ${value}. Must be 0 or 1`);
    }
    this._voteValue = value;
    return this;
  }

  /**
   * Sets custom encryption options
   * @param {Object} options - Custom options for encryption
   * @returns {EncryptedVoteBuilder} - Fluent interface for chaining
   */
  withOptions(options) {
    this._customOptions = { ...this._customOptions, ...options };
    return this;
  }

  /**
   * Builds the encrypted vote data
   * @returns {Promise<EncryptedVoteData>} - The encrypted vote data
   */
  async build() {
    this._validateRequiredFields();
    
    const input = hre.fhevm.createEncryptedInput(
      this._contractAddress, 
      this._voterAddress
    );
    input.add32(this._voteValue);
    const encrypted = await input.encrypt();

    return new EncryptedVoteData(
      encrypted.handles[0],
      encrypted.inputProof,
      this._voteValue,
      this._voterAddress
    );
  }

  /**
   * Validates that all required fields are set
   * @private
   */
  _validateRequiredFields() {
    if (!this._contractAddress) {
      throw new Error("Contract address is required");
    }
    if (!this._voterAddress) {
      throw new Error("Voter address is required");
    }
    if (this._voteValue === null) {
      throw new Error("Vote value is required");
    }
  }
}

/**
 * Immutable data class for encrypted vote information
 */
class EncryptedVoteData {
  constructor(handle, proof, voteValue, voterAddress) {
    this._handle = handle;
    this._proof = proof;
    this._voteValue = voteValue;
    this._voterAddress = voterAddress;
    Object.freeze(this);
  }

  get handle() { return this._handle; }
  get proof() { return this._proof; }
  get voteValue() { return this._voteValue; }
  get voterAddress() { return this._voterAddress; }
}

/**
 * Builder for creating test scenarios
 */
class TestScenarioBuilder {
  constructor() {
    this._voters = [];
    this._votes = [];
    this._expectedSum = null;
    this._description = "";
  }

  /**
   * Adds a voter to the scenario
   * @param {Object} signer - The ethers signer
   * @param {number} voteValue - The vote value (0 or 1)
   * @returns {TestScenarioBuilder} - Fluent interface for chaining
   */
  addVoter(signer, voteValue) {
    this._voters.push(signer);
    this._votes.push(voteValue);
    return this;
  }

  /**
   * Sets the expected sum for validation
   * @param {number} sum - The expected sum
   * @returns {TestScenarioBuilder} - Fluent interface for chaining
   */
  expectSum(sum) {
    this._expectedSum = sum;
    return this;
  }

  /**
   * Sets the scenario description
   * @param {string} description - Human-readable description
   * @returns {TestScenarioBuilder} - Fluent interface for chaining
   */
  describe(description) {
    this._description = description;
    return this;
  }

  /**
   * Builds the test scenario
   * @returns {TestScenario} - The test scenario data
   */
  build() {
    return new TestScenario(
      this._voters,
      this._votes,
      this._expectedSum,
      this._description
    );
  }
}

/**
 * Immutable data class for test scenarios
 */
class TestScenario {
  constructor(voters, votes, expectedSum, description) {
    this._voters = [...voters];
    this._votes = [...votes];
    this._expectedSum = expectedSum;
    this._description = description;
    Object.freeze(this);
  }

  get voters() { return [...this._voters]; }
  get votes() { return [...this._votes]; }
  get expectedSum() { return this._expectedSum; }
  get description() { return this._description; }
}

/**
 * Factory for creating common test scenarios
 */
class TestScenarioFactory {
  /**
   * Creates a basic two-voter scenario
   * @param {Object} voter1 - First voter signer
   * @param {Object} voter2 - Second voter signer
   * @returns {TestScenario} - The test scenario
   */
  static createBasicScenario(voter1, voter2) {
    return new TestScenarioBuilder()
      .addVoter(voter1, 1)
      .addVoter(voter2, 0)
      .expectSum(1)
      .describe("Basic two-voter scenario: YES + NO = 1")
      .build();
  }

  /**
   * Creates a unanimous YES scenario
   * @param {Object[]} voters - Array of voter signers
   * @returns {TestScenario} - The test scenario
   */
  static createUnanimousYesScenario(voters) {
    const builder = new TestScenarioBuilder()
      .expectSum(voters.length)
      .describe(`Unanimous YES scenario: ${voters.length} votes`);

    voters.forEach(voter => builder.addVoter(voter, 1));
    return builder.build();
  }

  /**
   * Creates a unanimous NO scenario
   * @param {Object[]} voters - Array of voter signers
   * @returns {TestScenario} - The test scenario
   */
  static createUnanimousNoScenario(voters) {
    const builder = new TestScenarioBuilder()
      .expectSum(0)
      .describe(`Unanimous NO scenario: ${voters.length} votes`);

    voters.forEach(voter => builder.addVoter(voter, 0));
    return builder.build();
  }

  /**
   * Creates a mixed voting scenario
   * @param {Object[]} voters - Array of voter signers
   * @param {number[]} votes - Array of vote values
   * @returns {TestScenario} - The test scenario
   */
  static createMixedScenario(voters, votes) {
    const expectedSum = votes.reduce((sum, vote) => sum + vote, 0);
    const builder = new TestScenarioBuilder()
      .expectSum(expectedSum)
      .describe(`Mixed scenario: ${votes.filter(v => v === 1).length} YES, ${votes.filter(v => v === 0).length} NO`);

    voters.forEach((voter, index) => {
      builder.addVoter(voter, votes[index]);
    });
    return builder.build();
  }
}

module.exports = {
  EncryptedVoteBuilder,
  EncryptedVoteData,
  TestScenarioBuilder,
  TestScenario,
  TestScenarioFactory
};
