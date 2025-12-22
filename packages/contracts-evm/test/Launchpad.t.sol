// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Legacy V5 Launchpad tests (archived).
/// @dev This file previously tested a 3-contract Launchpad design (Market + LPVault).
///      The repo is Launchpad V6+ (market is its own vault) and Stage 1 of the V7 dual-engine work
///      removes creator refunds + disables direct swap minting. Keeping this file non-test to avoid
///      running obsolete assertions.
contract LaunchpadLegacyTestsArchived {}
