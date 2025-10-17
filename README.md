# Confidential Poll Smart Contract

This repository contains a minimal confidential voting smart contract built with the
Zama **fhEVM** library and **Hardhat**.  The contract allows participants to cast
encrypted votes (represented as `0` for "no" or `1` for "yes") while preserving
vote secrecy.  All votes are aggregated on–chain using fully homomorphic
encryption; the contract never sees the plaintext votes.  At any point, a
properly authorized party can decrypt the aggregate tally off–chain.

## Project Structure

- **`contracts/FHEPoll.sol`** – the Solidity source for the confidential poll.  It
  illustrates how to use encrypted integer types (`euint32`) and the
  associated FHE operations (`FHE.add`, `FHE.fromExternal`, etc.) to
  implement a private accumulator.  Extensive inline documentation explains
  each step.
- **`hardhat.config.ts`** – a minimal Hardhat configuration that activates
  the fhEVM plugin and sets the Solidity version.  It can be extended to
  configure networks, gas reporting, etc.
- **`package.json`** – lists the required dependencies, including
  `@fhevm/solidity` and `@fhevm/hardhat-plugin`.  Running `npm install` will
  set up the environment (internet connectivity is required).

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Compile the contract:

   ```bash
   npx hardhat compile
   ```

3. To deploy and interact with the contract, write a Hardhat script or test
   using the provided `FHEPoll` contract.  Refer to the [Zama fhEVM
   documentation](https://docs.zama.ai) for examples of generating encrypted
   inputs and zero‑knowledge proofs off–chain.

## Security Notes

- This example does **not** enforce that votes are strictly `0` or `1`.  A
  malicious voter could submit other integers, causing the tally to become
  invalid.  In a production system, you should generate proofs that the
  encrypted input lies within the expected range.
- The contract omits overflow checks for brevity.  Use appropriate range
  restrictions or switch to wider integer types in real applications.
- Ensure you call `FHE.allowThis()` and `FHE.allow()` whenever updating
  encrypted state, as documented in the fhEVM guides.