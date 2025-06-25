// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Presale} from "./Presale.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PresaleFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public creationFee;
    address public feeToken;
    uint256 public housePercentage;
    address public houseAddress;
    uint256 public constant BASIS_POINTS = 10_000;

    address[] public createdPresales;

    event PresaleCreated(address indexed creator, address indexed presaleContract, address indexed token, uint256 start, uint256 end);
    event FeeConfigurationChanged(uint256 newCreationFee, address newFeeToken);
    event HouseConfigurationChanged(uint256 newHousePercentage, address newHouseAddress);

    error FeePaymentFailed();
    error InvalidFeeConfiguration();
    error InvalidHouseConfiguration();
    error ZeroAddress();
    error IndexOutOfBounds();

    constructor(
        uint256 _creationFee,
        address _feeToken,
        uint256 _housePercentage,
        address _houseAddress
    ) Ownable(msg.sender) {
        if (_housePercentage > 500) revert InvalidHouseConfiguration();
        if (_houseAddress == address(0) && _housePercentage > 0) revert InvalidHouseConfiguration();

        creationFee = _creationFee;
        feeToken = _feeToken;
        housePercentage = _housePercentage;
        houseAddress = _houseAddress;
    }

    function createPresale(
        Presale.PresaleOptions memory _options,
        address _token
    ) nonReentrant external payable returns (address presaleAddress) {
        if (creationFee > 0) {
            if (feeToken == address(0)) {
                if (msg.value < creationFee) revert FeePaymentFailed();
                if (msg.value > creationFee) {
                    payable(msg.sender).transfer(msg.value - creationFee);
                }
            } else {
                if (msg.value > 0) revert InvalidFeeConfiguration();
                IERC20(feeToken).safeTransferFrom(msg.sender, owner(), creationFee);
            }
        } else {
            if (msg.value > 0) revert InvalidFeeConfiguration();
        }

        Presale newPresale = new Presale(
            _token,
            _options,
            msg.sender,
            housePercentage,
            houseAddress,
            address(this)
        );

        presaleAddress = address(newPresale);
        IERC20(_token).safeTransferFrom(msg.sender, presaleAddress, _options.tokenDeposit);
        newPresale.initializeDeposit();

        createdPresales.push(presaleAddress);
        emit PresaleCreated(msg.sender, presaleAddress, _token, _options.start, _options.end);

        // Refund any excess ETH after all state changes (checks-effects-interactions)
        if (creationFee > 0 && feeToken == address(0) && msg.value > creationFee) {
            payable(msg.sender).transfer(msg.value - creationFee);
        }

        return presaleAddress;
    }

    function setFeeConfiguration(uint256 _newCreationFee, address _newFeeToken) external onlyOwner {
        if (_newFeeToken != address(0)) {
            uint32 size;
            assembly {
                size := extcodesize(_newFeeToken)
            }
            if (size == 0) revert ZeroAddress();
        }

        creationFee = _newCreationFee;
        feeToken = _newFeeToken;
        emit FeeConfigurationChanged(_newCreationFee, _newFeeToken);
    }

    function setHouseConfiguration(uint256 _newHousePercentage, address _newHouseAddress) external onlyOwner {
        if (_newHousePercentage > 500) revert InvalidHouseConfiguration();
        if (_newHouseAddress == address(0) && _newHousePercentage > 0) revert InvalidHouseConfiguration();

        housePercentage = _newHousePercentage;
        houseAddress = _newHouseAddress;
        emit HouseConfigurationChanged(_newHousePercentage, _newHouseAddress);
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        (bool success,) = owner().call{value: balance}("");
        require(success, "ETH fee withdrawal failed");
    }

    function getCreationFee() external view returns (uint256) {
        return creationFee;
    }

    function getHousePercentage() external view returns (uint256) {
        return housePercentage;
    }

    function getHouseAddress() external view returns (address) {
        return houseAddress;
    }

    function getPresaleCount() external view returns (uint256) {
        return createdPresales.length;
    }

    function getPresaleAt(uint256 index) external view returns (address) {
        if (index >= createdPresales.length) revert IndexOutOfBounds();
        return createdPresales[index];
    }

    function getAllPresales() external view returns (address[] memory) {
        return createdPresales;
    }
}