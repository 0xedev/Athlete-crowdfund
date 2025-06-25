// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Presale} from "../Presale.sol";

interface IPresale {
    // --- Errors ---
    error NotFactory();
    error InvalidState(uint8 currentState);
    error SoftCapNotReached();
    error NotInPurchasePeriod();
    error NotRefundable();
    error InvalidInitialization();
    error InvalidCapSettings();
    error InvalidContributionLimits();
    error InvalidRates();
    error InvalidTimestamps();
    error InvalidHouseConfiguration();
    error NoFundsToWithdraw();
    error PresaleNotEnded();
    error InsufficientTokenDeposit(uint256 amount, uint256 totalTokensNeeded);
    error ZeroAmount();
    error InvalidCurrencyDecimals();
    error ContractPaused();
    error ETHNotAccepted();
    error StablecoinNotAccepted();
    error ClaimPeriodExpired();
    error NoTokensToClaim();
    error InsufficientTokenBalance();
    error NoFundsToRefund();
    error InvalidContributorAddress();
    error HardCapExceeded();
    error BelowMinimumContribution();
    error ExceedsMaximumContribution();
    error NotWhitelisted();
    error InvalidAddress();
    error CannotRescueBeforeFinalizationOrCancellation();
    error CannotRescuePresaleTokens();
    error AlreadyPaused();
    error NotPaused();
    error InvalidDeadline();
    error InvalidMerkleRoot();
    error NotNftHolder();
    error NftCheckFailed();
    error InvalidNftContractAddress();

    // --- Events ---
    event Deposit(address indexed sender, uint256 amount, uint256 timestamp);
    event Purchase(address indexed buyer, uint256 amount);
    event Finalized(address indexed owner, uint256 amountRaised, uint256 timestamp);
    event Refund(address indexed contributor, uint256 amount, uint256 timestamp);
    event TokenClaim(address indexed claimer, uint256 amount, uint256 timestamp);
    event Cancel(address indexed owner, uint256 timestamp);
    event PresaleCreated(address indexed creator, address indexed presale, address indexed token, uint256 start, uint256 end);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);
    event Contribution(address indexed contributor, uint256 amount, bool isETH);
    event HouseFundsDistributed(address indexed house, uint256 amount);
    event ClaimDeadlineExtended(uint256 newDeadline);

    // --- Functions ---
    function deposit() external returns (uint256);
    function finalize() external returns (bool);
    function cancel() external returns (bool);
    function claim() external returns (uint256);
    function refund() external returns (uint256);
    function withdraw() external;
    function pause() external;
    function unpause() external;
    function userTokens(address contributor) external view returns (uint256);
    function getContributorCount() external view returns (uint256);
    function getContributors() external view returns (address[] memory);
    function getTotalContributed() external view returns (uint256);
    function getContribution(address contributor) external view returns (uint256);
    function rescueTokens(address _erc20Token, address _to, uint256 _amount) external;
    function extendClaimDeadline(uint256 _newDeadline) external;
    function contributeStablecoin(uint256 _amount, bytes32[] calldata _merkleProof) external;
    function getOptions() external view returns (Presale.PresaleOptions memory);
}