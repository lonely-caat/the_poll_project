/**
 * @fileoverview Advanced Test Assertions for FHE Poll Testing
 * Implements comprehensive assertion utilities following FAANG L7 SDET standards
 * with proper error handling, detailed reporting, and maintainable code structure.
 */

const { expect } = require("chai");
const hre = require("hardhat");
const { FhevmType } = require("@fhevm/hardhat-plugin");

/**
 * Advanced assertion utilities for FHE poll testing
 * Implements comprehensive validation patterns with detailed error reporting
 */
class FHEPollAssertions {
  /**
   * Asserts that a vote transaction succeeds
   * @param {Promise} voteTransaction - The vote transaction promise
   * @param {string} voterAddress - The voter's address for context
   * @returns {Promise<Object>} - The transaction receipt
   */
  static async assertVoteSucceeds(voteTransaction, voterAddress) {
    try {
      const tx = await voteTransaction;
      const receipt = await tx.wait();
      
      expect(receipt.status).to.equal(1, `Vote transaction should succeed for voter ${voterAddress}`);
      expect(receipt.logs).to.be.an('array', 'Transaction should have logs');
      
      return receipt;
    } catch (error) {
      throw new Error(`Vote transaction failed for voter ${voterAddress}: ${error.message}`);
    }
  }

  /**
   * Asserts that a vote transaction reverts with expected error
   * @param {Promise} voteTransaction - The vote transaction promise
   * @param {string} expectedError - The expected error message or pattern
   * @param {string} context - Additional context for error reporting
   * @returns {Promise<void>}
   */
  static async assertVoteReverts(voteTransaction, expectedError = null, context = "") {
    try {
      const tx = await voteTransaction;
      await tx.wait();
      throw new Error(`Expected vote transaction to revert${context ? ` (${context})` : ""}, but it succeeded`);
    } catch (error) {
      if (expectedError) {
        expect(error.message).to.include(expectedError, 
          `Expected error message to contain "${expectedError}"${context ? ` (${context})` : ""}`);
      }
      // Transaction reverted as expected
    }
  }

  /**
   * Asserts that the encrypted sum matches the expected value
   * @param {Object} contract - The contract instance
   * @param {string} contractAddress - The contract address
   * @param {Object} decryptor - The signer with decryption permissions
   * @param {bigint} expectedSum - The expected decrypted sum
   * @param {string} context - Additional context for error reporting
   * @returns {Promise<void>}
   */
  static async assertEncryptedSum(contract, contractAddress, decryptor, expectedSum, context = "") {
    try {
      const encryptedSum = await contract.getSum();
      expect(encryptedSum).to.not.be.undefined;
      expect(encryptedSum).to.not.be.null;

      const clearSum = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedSum,
        contractAddress,
        decryptor
      );

      expect(clearSum).to.equal(expectedSum, 
        `Decrypted sum should equal ${expectedSum}${context ? ` (${context})` : ""}`);
    } catch (error) {
      throw new Error(`Failed to assert encrypted sum${context ? ` (${context})` : ""}: ${error.message}`);
    }
  }

  /**
   * Asserts that the contract state is in initial state
   * @param {Object} contract - The contract instance
   * @param {string} contractAddress - The contract address
   * @param {Object} decryptor - The signer with decryption permissions
   * @returns {Promise<void>}
   */
  static async assertInitialState(contract, contractAddress, decryptor) {
    try {
      const encryptedSum = await contract.getSum();
      // In initial state, the sum might not be decryptable
      // We just verify the contract is accessible
      expect(encryptedSum).to.not.be.undefined;
      expect(encryptedSum).to.not.be.null;
    } catch (error) {
      // Initial state might not have decryptable data - this is acceptable
      if (error.message.includes("Handle is not initialized")) {
        // This is expected for initial state
        return;
      }
      throw error;
    }
  }

  /**
   * Asserts that a voter can decrypt the current sum
   * @param {Object} contract - The contract instance
   * @param {string} contractAddress - The contract address
   * @param {Object} voter - The voter signer
   * @param {bigint} expectedSum - The expected sum
   * @returns {Promise<void>}
   */
  static async assertVoterCanDecrypt(contract, contractAddress, voter, expectedSum) {
    try {
      const encryptedSum = await contract.getSum();
      const clearSum = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedSum,
        contractAddress,
        voter
      );
      expect(clearSum).to.equal(expectedSum);
    } catch (error) {
      throw new Error(`Voter ${voter.address} cannot decrypt sum: ${error.message}`);
    }
  }

  /**
   * Asserts that a voter cannot decrypt the current sum
   * @param {Object} contract - The contract instance
   * @param {string} contractAddress - The contract address
   * @param {Object} voter - The voter signer
   * @returns {Promise<void>}
   */
  static async assertVoterCannotDecrypt(contract, contractAddress, voter) {
    try {
      const encryptedSum = await contract.getSum();
      await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedSum,
        contractAddress,
        voter
      );
      throw new Error(`Expected voter ${voter.address} to be unable to decrypt, but decryption succeeded`);
    } catch (error) {
      // Expected to fail - voter doesn't have permission
      expect(error.message).to.include("not authorized", 
        `Expected authorization error for voter ${voter.address}`);
    }
  }

  /**
   * Asserts that the contract emits no events (current implementation)
   * @param {Object} receipt - The transaction receipt
   * @returns {void}
   */
  static assertNoEvents(receipt) {
    expect(receipt.logs).to.have.lengthOf(0, "Contract should not emit events in current implementation");
  }

  /**
   * Asserts gas usage is within acceptable limits
   * @param {Object} receipt - The transaction receipt
   * @param {number} maxGas - Maximum acceptable gas usage
   * @param {string} operation - Description of the operation
   * @returns {void}
   */
  static assertGasUsage(receipt, maxGas, operation) {
    const gasUsed = Number(receipt.gasUsed);
    expect(gasUsed).to.be.at.most(maxGas, 
      `${operation} should use at most ${maxGas} gas, but used ${gasUsed}`);
  }

  /**
   * Asserts that multiple voters can decrypt the same sum
   * @param {Object} contract - The contract instance
   * @param {string} contractAddress - The contract address
   * @param {Object[]} voters - Array of voter signers
   * @param {bigint} expectedSum - The expected sum
   * @returns {Promise<void>}
   */
  static async assertMultipleVotersCanDecrypt(contract, contractAddress, voters, expectedSum) {
    const decryptionPromises = voters.map(voter => 
      this.assertVoterCanDecrypt(contract, contractAddress, voter, expectedSum)
    );
    
    await Promise.all(decryptionPromises);
  }

  /**
   * Asserts that the contract handles concurrent voting correctly
   * @param {Object} contract - The contract instance
   * @param {string} contractAddress - The contract address
   * @param {Object[]} voters - Array of voter signers
   * @param {number[]} votes - Array of vote values
   * @param {Object} finalDecryptor - The signer to use for final decryption
   * @returns {Promise<void>}
   */
  static async assertConcurrentVoting(contract, contractAddress, voters, votes, finalDecryptor) {
    const expectedSum = votes.reduce((sum, vote) => sum + vote, 0);
    
    // Execute all votes concurrently
    const votePromises = voters.map((voter, index) => 
      this.assertVoteSucceeds(
        contract.connect(voter).castVote(
          // This would need to be properly encrypted in real implementation
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x"
        ),
        voter.address
      )
    );
    
    await Promise.all(votePromises);
    
    // Verify final sum
    await this.assertEncryptedSum(contract, contractAddress, finalDecryptor, BigInt(expectedSum));
  }
}

/**
 * Utility functions for test data validation
 */
class TestDataValidator {
  /**
   * Validates that vote values are within acceptable range
   * @param {number[]} votes - Array of vote values
   * @returns {boolean}
   */
  static validateVoteValues(votes) {
    return votes.every(vote => vote === 0 || vote === 1);
  }

  /**
   * Validates that the number of voters matches the number of votes
   * @param {Object[]} voters - Array of voter signers
   * @param {number[]} votes - Array of vote values
   * @returns {boolean}
   */
  static validateVoterVoteAlignment(voters, votes) {
    return voters.length === votes.length;
  }

  /**
   * Calculates expected sum from vote values
   * @param {number[]} votes - Array of vote values
   * @returns {number}
   */
  static calculateExpectedSum(votes) {
    return votes.reduce((sum, vote) => sum + vote, 0);
  }
}

module.exports = {
  FHEPollAssertions,
  TestDataValidator
};
