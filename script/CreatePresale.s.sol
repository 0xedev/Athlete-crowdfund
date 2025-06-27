// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PresaleFactory} from "../src/contracts/PresaleFactory.sol";
import {Presale} from "../src/contracts/Presale.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CreatePresale is Script {
    using SafeERC20 for IERC20;

    // --- Configuration - Load from environment variables ---
    address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
    address presaleTokenAddress = vm.envAddress("PRESALE_TOKEN_ADDRESS");
    address currencyTokenAddress = vm.envAddress("CURRENCY_TOKEN_ADDRESS");
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    uint256 hardCap = vm.envUint("HARD_CAP");
    uint256 softCap = vm.envUint("SOFT_CAP");
    uint256 minContribution = vm.envUint("MIN_CONTRIBUTION");
    uint256 maxContribution = vm.envUint("MAX_CONTRIBUTION");
    uint256 presaleRate = vm.envUint("PRESALE_RATE");
    uint256 startOffset = vm.envOr("START_TIME_OFFSET", uint256(600));
    uint256 duration = vm.envOr("DURATION", uint256(600));
    uint8 whitelistType = uint8(vm.envOr("WHITELIST_TYPE", uint256(0)));
    bytes32 merkleRoot = vm.envOr("MERKLE_ROOT", bytes32(0));
    address nftContractAddress = vm.envOr("NFT_CONTRACT_ADDRESS", address(0));

    function run() external returns (address presaleAddress) {
        // --- Input Validation ---
        require(factoryAddress != address(0), "FACTORY_ADDRESS not set");
        require(presaleTokenAddress != address(0), "PRESALE_TOKEN_ADDRESS not set");
        require(hardCap > 0 && softCap > 0 && softCap <= hardCap, "Invalid caps");
        require(
            minContribution > 0 && maxContribution > 0 && minContribution <= maxContribution
                && maxContribution <= hardCap,
            "Invalid contribution limits"
        );
        require(presaleRate > 0, "Invalid presale rate");
        require(whitelistType <= 2, "Invalid WHITELIST_TYPE (0, 1, or 2)");
        if (whitelistType == 1) {
            require(merkleRoot != bytes32(0), "MERKLE_ROOT required for WHITELIST_TYPE=1");
        } else if (whitelistType == 2) {
            require(nftContractAddress != address(0), "NFT_CONTRACT_ADDRESS required for WHITELIST_TYPE=2");
        }

        // --- Instantiate Contracts ---
        PresaleFactory factory = PresaleFactory(payable(factoryAddress));
        IERC20 presaleToken = IERC20(presaleTokenAddress);

        // --- Prepare Presale Options ---
        uint256 startTime = block.timestamp + startOffset;
        uint256 endTime = startTime + duration;

        Presale.PresaleOptions memory options = Presale.PresaleOptions({
            tokenDeposit: 0, // Will be set below
            hardCap: hardCap,
            softCap: softCap,
            min: minContribution,
            max: maxContribution,
            presaleRate: presaleRate,
            start: startTime,
            end: endTime,
            currency: currencyTokenAddress,
            whitelistType: Presale.WhitelistType(whitelistType),
            merkleRoot: merkleRoot,
            nftContractAddress: nftContractAddress
        });

        // Calculate required token deposit
        // For a basic presale, this is usually: hardCap * presaleRate * 10**token.decimals() / currencyDecimals
        uint8 tokenDecimals = presaleToken.decimals();
        uint8 currencyDecimals = 18;
        if (currencyTokenAddress != address(0)) {
            try IERC20(currencyTokenAddress).decimals() returns (uint8 dec) {
                currencyDecimals = dec;
            } catch {}
        }
        uint256 tokensNeeded = (hardCap * presaleRate * (10 ** tokenDecimals)) / (10 ** currencyDecimals);
        options.tokenDeposit = tokensNeeded;

        console.log("Required Presale Token Deposit:", tokensNeeded);

        // --- Approvals & Fee Handling ---
        vm.startBroadcast(deployerPrivateKey);

        // 1. Approve Presale Tokens
        console.log("Approving factory to spend presale tokens...");
        presaleToken.approve(factoryAddress, tokensNeeded);
        console.log("Presale token approval successful.");

        // 2. Handle Creation Fee
        uint256 creationFee = factory.creationFee();
        address feeTokenAddress = factory.feeToken();
        uint256 ethFeeToSend = 0;

        if (creationFee > 0) {
            if (feeTokenAddress == address(0)) {
                // ETH Fee
                ethFeeToSend = creationFee;
                console.log("Paying ETH creation fee:", ethFeeToSend);
            } else {
                // ERC20 Fee
                console.log("Approving factory to spend fee token:", feeTokenAddress);
                IERC20 feeToken = IERC20(feeTokenAddress);
                feeToken.approve(factoryAddress, creationFee);
                console.log("Fee token approval successful.");
            }
        } else {
            console.log("No creation fee required.");
        }

        // --- Create Presale ---
        console.log("Creating presale...");
        presaleAddress =
            factory.createPresale{value: ethFeeToSend}(options, presaleTokenAddress);

        vm.stopBroadcast();

        console.log("Presale contract created successfully at:", presaleAddress);
        return presaleAddress;
    }
}
