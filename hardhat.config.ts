import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-ethers";
import type { HardhatUserConfig } from "hardhat/config";

/**
 * Basic Hardhat configuration for compiling a confidential poll contract.
 *
 * This configuration imports the fhEVM plugin so that the Solidity compiler
 * understands the encrypted types provided by `@fhevm/solidity`. It also
 * includes the default `ethers` plugin for interacting with the compiled
 * artifacts in tests and scripts. Only the Solidity version is specified to
 * keep the config minimal; further customization (networks, gas reporting,
 * TypeChain) can be added as required for deployment or testing.
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
  },
};

export default config;