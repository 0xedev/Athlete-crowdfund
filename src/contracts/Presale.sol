// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IPresale} from "./interfaces/IPresale.sol";

contract Presale is ReentrancyGuard, Ownable, IPresale {
    using SafeERC20 for IERC20;

    enum PresaleState {
        Pending,
        Active,
        Canceled,
        Finalized
    }

    enum WhitelistType {
        None,
        Merkle,
        NFT
    }

    struct PresaleOptions {
        uint256 tokenDeposit;
        uint256 hardCap;
        uint256 softCap;
        uint256 min;
        uint256 max;
        uint256 presaleRate;
        uint256 start;
        uint256 end;
        address currency;
        WhitelistType whitelistType;
        bytes32 merkleRoot;
        address nftContractAddress;
    }

    uint256 public totalRefundable;
    uint256 public constant BASIS_POINTS = 1e4;
    bool public paused;
    bool public immutable whitelistEnabled;
    uint256 public ownerBalance;
    uint256 public claimDeadline;

    uint256 public immutable housePercentage;
    address public immutable houseAddress;
    address public immutable presaleFactory;

    PresaleOptions public options;
    PresaleState public state;
    mapping(address => uint256) public contributions;
    mapping(address => bool) private isContributor;
    address[] public contributors;

    ERC20 public immutable token;
    uint256 public tokenBalance;
    uint256 public tokensClaimable;
    uint256 public totalRaised;

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

  

    

    constructor(
        address _token,
        PresaleOptions memory _options,
        address _creator,
        uint256 _housePercentage,
        address _houseAddress,
        address _presaleFactoryAddress
    ) Ownable(_creator) {
        if (_token == address(0)) revert InvalidInitialization();
        if (_housePercentage > 500) revert InvalidHouseConfiguration();
        if (_houseAddress == address(0) && _housePercentage > 0) revert InvalidHouseConfiguration();

        if (_options.hardCap == 0 || _options.softCap == 0 || _options.softCap > _options.hardCap) {
            revert InvalidCapSettings();
        }
        if (_options.max == 0 || _options.min == 0 || _options.min > _options.max || _options.max > _options.hardCap) {
            revert InvalidContributionLimits();
        }
        if (_options.presaleRate == 0) revert InvalidRates();
        if (_options.start < block.timestamp || _options.end <= _options.start) revert InvalidTimestamps();
        if (_options.whitelistType == WhitelistType.Merkle && _options.merkleRoot == bytes32(0)) {
            revert InvalidMerkleRoot();
        }
        if (_options.whitelistType == WhitelistType.NFT && _options.nftContractAddress == address(0)) {
            revert InvalidNftContractAddress();
        }

        token = ERC20(_token);
        options = _options;
        presaleFactory = _presaleFactoryAddress;
        housePercentage = _housePercentage;
        houseAddress = _houseAddress;
        state = PresaleState.Pending;
        whitelistEnabled = (_options.whitelistType != WhitelistType.None);

        emit PresaleCreated(_creator, address(this), _token, _options.start, _options.end);
    }

    function finalize() external nonReentrant onlyOwner whenNotPaused returns (bool) {
        if (state != PresaleState.Active) revert InvalidState(uint8(state));
        if (block.timestamp <= options.end) revert PresaleNotEnded();
        if (totalRaised < options.softCap) revert SoftCapNotReached();

        state = PresaleState.Finalized;
        ownerBalance = totalRaised - ((totalRaised * housePercentage) / BASIS_POINTS);
        claimDeadline = block.timestamp + 180 days;

        _distributeHouseFunds();

        emit Finalized(msg.sender, totalRaised, block.timestamp);
        return true;
    }

    function cancel() external nonReentrant onlyOwner whenNotPaused returns (bool) {
        if (state != PresaleState.Active || block.timestamp <= options.end || totalRaised >= options.softCap) {
            revert InvalidState(uint8(state));
        }

        state = PresaleState.Canceled;

        if (tokenBalance > 0) {
            uint256 amountToReturn = tokenBalance;
            tokenBalance = 0;
            IERC20(token).safeTransfer(msg.sender, amountToReturn);
        }

        emit Cancel(msg.sender, block.timestamp);
        return true;
    }

    function withdraw() external nonReentrant onlyOwner {
        if (state != PresaleState.Finalized) revert InvalidState(uint8(state));
        uint256 amount = ownerBalance;
        if (amount == 0) revert NoFundsToWithdraw();
        ownerBalance = 0;
        _safeTransferCurrency(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function extendClaimDeadline(uint256 _newDeadline) external onlyOwner {
        if (state != PresaleState.Finalized) revert InvalidState(uint8(state));
        if (_newDeadline <= claimDeadline) revert InvalidDeadline();
        claimDeadline = _newDeadline;
        emit ClaimDeadlineExtended(_newDeadline);
    }

    function rescueTokens(address _erc20Token, address _to, uint256 _amount) external onlyOwner {
        if (_to == address(0)) revert InvalidAddress();
        if (state != PresaleState.Finalized && state != PresaleState.Canceled) {
            revert CannotRescueBeforeFinalizationOrCancellation();
        }
        if (
            state == PresaleState.Finalized && address(_erc20Token) == address(token)
                && block.timestamp <= claimDeadline
        ) {
            revert CannotRescuePresaleTokens();
        }
        IERC20(_erc20Token).safeTransfer(_to, _amount);
        emit TokensRescued(_erc20Token, _to, _amount);
    }

    function pause() external onlyOwner {
        if (paused) revert AlreadyPaused();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) revert NotPaused();
        paused = false;
        emit Unpaused(msg.sender);
    }

    function contribute(bytes32[] calldata _merkleProof) external payable nonReentrant whenNotPaused {
        _contribute(msg.sender, msg.value, _merkleProof);
    }

    receive() external payable nonReentrant whenNotPaused {
        bytes32[] memory emptyProof;
        _contribute(msg.sender, msg.value, emptyProof);
    }

    function contributeStablecoin(uint256 _amount, bytes32[] calldata _merkleProof)
        external
        nonReentrant
        whenNotPaused
    {
        if (options.currency == address(0)) revert StablecoinNotAccepted();
        if (_amount == 0) revert ZeroAmount();

        IERC20(options.currency).safeTransferFrom(msg.sender, address(this), _amount);
        _contribute(msg.sender, _amount, _merkleProof);
    }

    function claim() external nonReentrant whenNotPaused returns (uint256) {
        if (state != PresaleState.Finalized) revert InvalidState(uint8(state));
        if (block.timestamp > claimDeadline) revert ClaimPeriodExpired();

        uint256 totalTokens = userTokens(msg.sender);
        if (totalTokens == 0) revert NoTokensToClaim();

        contributions[msg.sender] = 0;
        if (tokenBalance < totalTokens) revert InsufficientTokenBalance();
        tokenBalance -= totalTokens;

        IERC20(token).safeTransfer(msg.sender, totalTokens);
        emit TokenClaim(msg.sender, totalTokens, block.timestamp);
        return totalTokens;
    }

    function refund() external nonReentrant  returns (uint256) {
        if (
            !(
                state == PresaleState.Canceled
                    || (state == PresaleState.Active && block.timestamp > options.end && totalRaised < options.softCap)
            )
        ) {
            revert NotRefundable();
        }
        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoFundsToRefund();

        contributions[msg.sender] = 0;
        if (totalRefundable >= amount) {
            totalRefundable -= amount;
        } else {
            totalRefundable = 0;
        }

        _safeTransferCurrency(msg.sender, amount);
        emit Refund(msg.sender, amount, block.timestamp);
        return amount;
    }

    function _contribute(address _contributor, uint256 _amount, bytes32[] memory _merkleProof) private {
        if (state != PresaleState.Active) revert InvalidState(uint8(state));
        if (block.timestamp < options.start || block.timestamp > options.end) {
            revert NotInPurchasePeriod();
        }
        if (_contributor == address(0)) revert InvalidContributorAddress();

        if (options.whitelistType == WhitelistType.Merkle) {
            if (
                !MerkleProof.verify(_merkleProof, options.merkleRoot, keccak256(abi.encodePacked(_contributor)))
            ) {
                revert NotWhitelisted();
            }
        } else if (options.whitelistType == WhitelistType.NFT) {
            try IERC721(options.nftContractAddress).balanceOf(_contributor) returns (uint256 balance) {
                if (balance == 0) {
                    revert NotNftHolder();
                }
            } catch {
                revert NftCheckFailed();
            }
        }

        _validateCurrencyAndAmount(_contributor, _amount);
        uint256 contributionAmount = (options.currency == address(0)) ? msg.value : _amount;

        totalRaised += contributionAmount;
        totalRefundable += contributionAmount;
        if (!isContributor[_contributor]) {
            isContributor[_contributor] = true;
            contributors.push(_contributor);
        }
        contributions[_contributor] += contributionAmount;

        emit Purchase(_contributor, contributionAmount);
        emit Contribution(_contributor, contributionAmount, options.currency == address(0));
    }

    function _distributeHouseFunds() private {
        uint256 houseAmount = (totalRaised * housePercentage) / BASIS_POINTS;
        if (houseAmount > 0) {
            _safeTransferCurrency(houseAddress, houseAmount);
            emit HouseFundsDistributed(houseAddress, houseAmount);
        }
    }

    function _validateCurrencyAndAmount(address _contributor, uint256 _amount) private view {
        if (options.currency == address(0)) {
            if (msg.value == 0) revert ZeroAmount();
        } else {
            if (msg.value > 0) revert ETHNotAccepted();
            if (_amount == 0) revert ZeroAmount();
        }
        _validateContribution(_contributor, _amount);
    }

    function _validateContribution(address _contributor, uint256 _stablecoinAmountIfAny) private view {
        uint256 amount = (options.currency == address(0)) ? msg.value : _stablecoinAmountIfAny;
        if (totalRaised + amount > options.hardCap) revert HardCapExceeded();

        if (amount < options.min) revert BelowMinimumContribution();
        if (contributions[_contributor] + amount > options.max) {
            revert ExceedsMaximumContribution();
        }
    }

    function _safeTransferCurrency(address _to, uint256 _amount) private {
        if (_amount == 0) return;
        if (options.currency == address(0)) {
            payable(_to).transfer(_amount);
        } else {
            IERC20(options.currency).safeTransfer(_to, _amount);
        }
    }

    function _getCurrencyMultiplier() private view returns (uint256) {
        if (options.currency == address(0)) {
            return 1 ether;
        }
        try ERC20(options.currency).decimals() returns (uint8 decimals) {
            return 10 ** decimals;
        } catch {
            revert InvalidCurrencyDecimals();
        }
    }

    function userTokens(address _contributor) public view returns (uint256) {
        uint256 contribution = contributions[_contributor];
        if (contribution == 0) return 0;
        return (contribution * options.presaleRate * 10 ** token.decimals()) / _getCurrencyMultiplier();
    }

    function getContributorCount() external view returns (uint256) {
        return contributors.length;
    }

    function getContributors() external view returns (address[] memory) {
        return contributors;
    }

    function getTotalContributed() external view returns (uint256) {
        return totalRaised;
    }

    function getContribution(address _contributor) external view returns (uint256) {
        return contributions[_contributor];
    }

    function initializeDeposit() external nonReentrant  whenNotPaused returns (uint256)  {
         if (msg.sender != presaleFactory) revert NotFactory();
        if (state != PresaleState.Pending) revert InvalidState(uint8(state));
        if (block.timestamp >= options.start) revert NotInPurchasePeriod();

        uint256 depositedAmount = IERC20(token).balanceOf(address(this));
        if (depositedAmount == 0) revert ZeroAmount();
        tokensClaimable = (options.hardCap * options.presaleRate * 10 ** token.decimals()) / _getCurrencyMultiplier();

        if (depositedAmount < tokensClaimable) {
            revert InsufficientTokenDeposit(depositedAmount, tokensClaimable);
        }

        tokenBalance = depositedAmount;
        state = PresaleState.Active;

        emit Deposit(msg.sender, depositedAmount, block.timestamp);
        return depositedAmount;
    }
    

    function deposit() external override returns (uint256) {
        
    }

    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        if (state != PresaleState.Pending) revert InvalidState(uint8(state));
        options.merkleRoot = _merkleRoot;
    }

  

    function getPresaleOptions() external view returns (PresaleOptions memory) {
        return options;
    }

    function getOptions() external view override returns (Presale.PresaleOptions memory) {
        return options;
    }
}