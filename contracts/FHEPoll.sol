// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Confidential Poll Contract
/// @author Your Name
/// @notice This contract implements a minimal confidential voting mechanism using
/// Fully Homomorphic Encryption (FHE) types from the Zama fhEVM library. Voters
/// submit an encrypted integer (0 or 1) along with a zero‑knowledge proof. The
/// contract homomorphically aggregates these encrypted votes without ever
/// learning individual inputs. The resulting encrypted sum can later be
/// decrypted off‑chain by authorized parties.
contract FHEPoll is SepoliaConfig {
    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @dev Stores the homomorphically accumulated tally of all votes. Because
    /// this value is encrypted, it cannot be inspected directly on chain. Only
    /// those with proper decryption permissions can recover the plain sum.
    euint32 private _sum;

    // -------------------------------------------------------------------------
    // External API
    // -------------------------------------------------------------------------

    /// @notice Returns the current encrypted sum of votes.
    /// @dev The returned `euint32` can only be decrypted by accounts that have
    /// been granted permission via `FHE.allow()`.
    /// @return The encrypted vote sum.
    function getSum() external view returns (euint32) {
        return _sum;
    }

    /// @notice Casts an encrypted vote.
    ///
    /// Clients are expected to encrypt their vote off‑chain (as 0 or 1) and
    /// generate a zero‑knowledge proof that binds the ciphertext to the
    /// caller and this contract. The encrypted value and proof are then
    /// submitted to this function. The contract homomorphically adds the vote
    /// to the running tally while preserving input confidentiality. After
    /// updating the tally, the function grants decryption permissions to both
    /// the contract and the caller so that they can retrieve the updated
    /// encrypted sum off‑chain.
    ///
    /// @param voteEuint The encrypted vote (0 for “no”, 1 for “yes”).
    /// @param voteProof The zero‑knowledge proof associated with `voteEuint`.
    function castVote(
        externalEuint32 voteEuint,
        bytes calldata voteProof
    ) external {
        // ---------------------------------------------------------------------
        // Convert external encrypted input into an internal FHE type. This
        // verifies the proof and ensures that the ciphertext was encrypted by
        // the caller for this contract. Without this conversion, the FHE
        // functions cannot operate on the value.
        // ---------------------------------------------------------------------
        euint32 vote = FHE.fromExternal(voteEuint, voteProof);

        // ---------------------------------------------------------------------
        // Homomorphically add the vote to the internal sum. Because `_sum` and
        // `vote` are both encrypted types, FHE.add() performs the addition
        // without revealing any intermediate values. The resulting ciphertext
        // replaces the previous sum.
        // ---------------------------------------------------------------------
        _sum = FHE.add(_sum, vote);

        // ---------------------------------------------------------------------
        // Grant permission to this contract to use the updated `_sum` in
        // subsequent operations. Without this ACL entry, the contract itself
        // cannot process the ciphertext further.
        // ---------------------------------------------------------------------
        FHE.allowThis(_sum);

        // ---------------------------------------------------------------------
        // Grant permission to the caller (`msg.sender`) to decrypt the updated
        // sum off‑chain. If this permission is not set, the caller will not be
        // able to retrieve the clear value using their FHEVM client.
        // ---------------------------------------------------------------------
        FHE.allow(_sum, msg.sender);
    }
}