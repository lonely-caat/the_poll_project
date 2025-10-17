# Test Strategy for FHEPoll

This document outlines the rationale and structure behind the automated tests for
the **FHEPoll** contract.  It highlights why the application was chosen,
identifies its primary risks, and explains how the test suite mitigates those
risks through different levels of testing.

## 1. Application Choice

The `FHEPoll` contract implements a simple confidential voting mechanism
using Zama’s fhEVM library.  Each caller submits an encrypted vote (0 for “no”,
1 for “yes”) together with a zero‑knowledge proof, and the contract
homomorphically aggregates these encrypted values.  The final encrypted
tally can be decrypted off‑chain by any participant with the appropriate
permissions.  This application was chosen because it exercises core fhEVM
features—encrypted inputs, homomorphic addition, and access control—yet
remains small enough to test comprehensively.  Simplicity reduces the chance
of inadvertently introducing vulnerabilities unrelated to FHEVM itself.

## 2. Risks and Challenges

Despite its simplicity, the application presents several notable risks:

* **Correctness of homomorphic aggregation.**  Votes must be tallied exactly
  once.  Any mis‑ordered operations or incorrect handling of the encrypted
  types could produce wrong results.

* **Proof validity.**  Each encrypted input is accompanied by a zero‑knowledge
  proof bound to the signer and contract.  If proofs are not validated
  correctly, malicious users could inject arbitrary ciphertexts or replay
  someone else’s encrypted vote.

* **Access control.**  Decryption permissions are explicitly granted inside the
  contract.  Failing to grant or revoke the right entities could either
  prevent rightful voters from reading the result or leak the tally to
  unauthorised parties.

* **Edge conditions.**  Although the current implementation does not include a
  closing time, an important failure path is handling mismatched encryption
  metadata (e.g., when the provided proof does not correspond to the caller).

## 3. Testing Levels and Structure

The test suite is divided into two complementary levels:

### 3.1 Integration Tests

Integration tests interact directly with the deployed contract via Hardhat
and exercise isolated units of functionality.  In `FHEPoll.integration.js`:

* **Happy path verification.**  Multiple signers submit encrypted votes via
  the `fhevm` API.  After all transactions are mined, we read the
  encrypted sum from the contract, decrypt it with an authorised signer,
  and assert the clear integer equals the expected total.  This confirms
  that the homomorphic addition and permission logic behave correctly on
  chain.

* **Failure case.**  We intentionally create an encrypted vote bound to one
  signer and attempt to cast it using another.  Because the proof no
  longer matches the caller, the contract should revert.  To avoid
  depending on Hardhat‑specific chai matchers, the test catches the
  exception manually and asserts that a revert occurred.

These tests are fast, deterministic, and run against a local Hardhat
EVM instance.  They provide high confidence in the contract’s core logic
without requiring any front‑end.

### 3.2 End‑to‑End Tests

End‑to‑end testing simulates an entire user flow from deployment through
multiple voters interacting with the contract.  In `FHEPoll.e2e.js`:

* The test deploys a fresh `FHEPoll` contract and defines a helper
  function to encapsulate the encryption and transaction logic for each
  vote.

* Three participants (Alice, Bob, and Carol) cast votes.  The test then
  fetches the encrypted tally, decrypts it using an authorised signer,
  and verifies that the clear value matches the expected sum.

Although similar to the happy path integration test, this scenario
represents a complete user journey across multiple signers and explicitly
verifies that aggregated state persists between calls.  Should the
application grow to include a front end or additional contract logic (e.g.,
closing the poll, emitting events), further end‑to‑end tests could be
added using Playwright or a dedicated test runner.

## 4. Rationale for Tooling

We chose **Hardhat with Mocha/Chai** for both integration and end‑to‑end
tests because:

* **Consistency.**  The same environment used to write and compile
  contracts is also used to test them, reducing tooling overhead.

* **Native fhEVM support.**  The `@fhevm/hardhat-plugin` exposes helper
  methods (`createEncryptedInput`, `userDecryptEuint`, etc.) directly on
  the Hardhat runtime environment, simplifying encryption and decryption.

* **Speed.**  Hardhat’s in‑memory EVM is fast enough to run iterative
  tests without incurring network latency.  Should we need to run tests
  against Sepolia, Hardhat’s network configuration can be extended.

We intentionally avoided browser‑based frameworks like Playwright since
there is no user interface to test.  Instead, our tests focus on on‑chain
behaviour where the critical logic resides.