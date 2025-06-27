import React, { useState, useEffect, useCallback, ChangeEvent } from "react";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { parseEther, parseUnits, isAddress, zeroAddress, zeroHash } from "viem";
import { getPublicClient } from "@wagmi/core";
import { config } from "@/lib/wagmiConfig";
import { spicy } from "viem/chains";

import { factoryAbi } from "@/abis/factoryAbi";

const erc20Abi = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_from", type: "address" },
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  { payable: true, stateMutability: "payable", type: "fallback" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "owner", type: "address" },
      { indexed: true, name: "spender", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    name: "ERC20InsufficientBalance",
    type: "error",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    name: "ERC20InsufficientAllowance",
    type: "error",
    inputs: [
      { name: "spender", type: "address" },
      { name: "allowance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
];

const FACTORY_ADDRESS = "0x9BcB18e3621321B50ff01b4ddcC463B6444A0E4b";

const formatDateForInput = (date: Date | null | undefined): string => {
  if (!date) return "";
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isValidAddress = (address: string): boolean => {
  return address === "" || isAddress(address);
};

interface FormDataState {
  tokenAddress: string;
  currencyAddress: `0x${string}`;
  presaleImage: File | null;
  presaleRate: string;
  hardCap: string;
  softCap: string;
  minContribution: string;
  maxContribution: string;
  start: string;
  end: string;
  claimDelayMinutes: string;
  whitelistType: string;
  merkleRoot: string;
  nftContractAddress: string;
}

const CreatePresalePage: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [, setApprovalCompleted] = useState(false);
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [formData, setFormData] = useState<FormDataState>({
    tokenAddress: "",
    currencyAddress: zeroAddress,
    presaleImage: null,
    presaleRate: "100",
    hardCap: "",
    softCap: "",
    minContribution: "0.1",
    maxContribution: "1",
    start: formatDateForInput(new Date(Date.now() + 5 * 60 * 1000)),
    end: formatDateForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    claimDelayMinutes: "10",
    whitelistType: "0",
    merkleRoot: "",
    nftContractAddress: "",
  });
  const [tokenDeposit, setTokenDeposit] = useState<string>("0");
  const [creationFee, setCreationFee] = useState<string>("0");
  const [creationFeeTokenAddress, setCreationFeeTokenAddress] = useState<
    string | null
  >(null);
  const [creationFeeTokenSymbol, setCreationFeeTokenSymbol] =
    useState<string>("CHZ");
  const [status, setStatus] = useState<string>("");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { data: receipt, isLoading: isTxPending } =
    useWaitForTransactionReceipt({ hash: txHash });
  const [isTokenApproved, setIsTokenApproved] = useState(false);
  const [isFeeApproved, setIsFeeApproved] = useState(false);

  const { data: creationFeeData } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "creationFee",
  });
  const { data: feeTokenAddress } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "feeToken",
  });

  const { data: tokenDecimalsData } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: isValidAddress(formData.tokenAddress) },
  });
  const { data: tokenSymbolData } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: isValidAddress(formData.tokenAddress) },
  });
  const { data: tokenBalanceData } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: isConnected && isValidAddress(formData.tokenAddress) },
  });

  const { data: tokenAllowanceData } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address, FACTORY_ADDRESS as `0x${string}`],
    query: { enabled: isConnected && isValidAddress(formData.tokenAddress) },
  });
  const { data: feeAllowanceData } = useReadContract({
    address: creationFeeTokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address, FACTORY_ADDRESS as `0x${string}`],
    query: {
      enabled:
        isConnected &&
        !!creationFeeTokenAddress &&
        creationFeeTokenAddress !== zeroAddress,
    },
  });

  useEffect(() => {
    const init = async () => {
      if (!FACTORY_ADDRESS || !isValidAddress(FACTORY_ADDRESS)) {
        setStatus("Configuration Error: Invalid Factory Address.");
        return;
      }
      try {
        if (creationFeeData && feeTokenAddress) {
          setCreationFeeTokenAddress(feeTokenAddress as `0x${string}`);
          if (feeTokenAddress !== zeroAddress) {
            const publicClient = getPublicClient(config);
            const feeTokenSymbol = (await publicClient.readContract({
              address: feeTokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: "symbol",
            })) as string;
            const feeTokenDecimals = (await publicClient.readContract({
              address: feeTokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: "decimals",
            })) as number;
            setCreationFee(
              (Number(creationFeeData) / 10 ** feeTokenDecimals).toString()
            );
            setCreationFeeTokenSymbol(feeTokenSymbol);
          } else {
            setCreationFee((Number(creationFeeData) / 10 ** 18).toString());
            setCreationFeeTokenSymbol("CHZ");
          }
          setStatus("");
        }
      } catch (error: any) {
        setStatus(
          `Error fetching fee details: ${error.message || "Unknown error"}.`
        );
      }
    };
    init();
  }, [creationFeeData, feeTokenAddress]);

  useEffect(() => {
    if (tokenDecimalsData) setTokenDecimals(Number(tokenDecimalsData));
    if (tokenSymbolData) setTokenSymbol(tokenSymbolData as string);
    if (tokenBalanceData && tokenDecimalsData) {
      setTokenBalance(
        (Number(tokenBalanceData) / 10 ** Number(tokenDecimalsData)).toFixed(0)
      );
    }
  }, [tokenDecimalsData, tokenSymbolData, tokenBalanceData]);

  useEffect(() => {
    if (tokenAllowanceData && tokenDeposit !== "0") {
      const requiredAmount = parseUnits(tokenDeposit, tokenDecimals);
      setIsTokenApproved(Number(tokenAllowanceData) >= Number(requiredAmount));
    }
    if (
      feeAllowanceData &&
      creationFeeTokenAddress &&
      creationFeeTokenAddress !== zeroAddress &&
      parseFloat(creationFee) > 0
    ) {
      const publicClient = getPublicClient(config);
      publicClient
        .readContract({
          address: creationFeeTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        })
        .then((feeDecimals) => {
          const requiredFeeAmount = parseUnits(
            creationFee,
            Number(feeDecimals)
          );
          setIsFeeApproved(
            Number(feeAllowanceData) >= Number(requiredFeeAmount)
          );
        })
        .catch(() => setIsFeeApproved(false));
    } else if (
      creationFeeTokenAddress === zeroAddress ||
      parseFloat(creationFee) === 0
    ) {
      setIsFeeApproved(true);
    }
  }, [
    tokenAllowanceData,
    feeAllowanceData,
    tokenDeposit,
    creationFee,
    creationFeeTokenAddress,
    tokenDecimals,
  ]);

  useEffect(() => {
    if (receipt) {
      if (receipt.status === "success") {
        setStatus("Presale created successfully!");
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setStatus("Transaction failed: Reverted.");
      }
      setIsProcessing(false);
    }
  }, [receipt]);

  const connectWallet = () => {
    if (connectors.length > 0) {
      connect({ connector: connectors[0] });
    } else {
      setStatus("No wallet connectors available. Please install MetaMask.");
    }
  };

  const validateAndParseAddress = (
    addr: string,
    fieldName: string
  ): `0x${string}` => {
    if (addr && !isValidAddress(addr)) {
      setStatus(`Invalid ${fieldName} address.`);
      return zeroAddress as `0x${string}`;
    }
    return (addr || zeroAddress) as `0x${string}`;
  };

  const fetchTokenDetails = async (tokenAddress: string) => {
    if (!isValidAddress(tokenAddress)) {
      setTokenDecimals(18);
      setTokenSymbol("");
      setTokenBalance("0");
      if (tokenAddress) setStatus("Invalid token address.");
      return false;
    }
    return true;
  };

  const calculateAndSetTokenDeposit = useCallback(async () => {
    if (!formData.tokenAddress || !isValidAddress(formData.tokenAddress)) {
      setTokenDeposit("0");
      return;
    }

    const allInputsValidForCalc =
      formData.hardCap &&
      parseFloat(formData.hardCap) > 0 &&
      formData.presaleRate &&
      parseFloat(formData.presaleRate) > 0;

    if (!allInputsValidForCalc) {
      setTokenDeposit("0");
      return;
    }

    try {
      const currencyMultiplier = 10 ** 18; // CHZ
      const tokenDecimals = formData.tokenAddress
        ? ((await getPublicClient(config).readContract({
            address: formData.tokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: "decimals",
          })) as number)
        : 18;
      const tokensForPresale =
        (BigInt(Math.floor(parseFloat(formData.hardCap) * 10 ** 18)) *
          BigInt(Math.floor(parseFloat(formData.presaleRate)))) /
        BigInt(currencyMultiplier);
      const totalTokensNeeded = tokensForPresale;
      const formattedTokens = (
        Number(totalTokensNeeded) /
        10 ** tokenDecimals
      ).toFixed(0);
      setTokenDeposit(formattedTokens);
      setStatus(
        `Required token deposit: ${formattedTokens} ${tokenSymbol || "tokens"}.`
      );
    } catch (error: any) {
      setTokenDeposit("0");
      setStatus(
        `Error calculating token deposit: ${error.message || "Check inputs."}`
      );
    }
  }, [formData, tokenSymbol]);

  useEffect(() => {
    calculateAndSetTokenDeposit();
  }, [calculateAndSetTokenDeposit]);

  const handleInputChange = async (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    let newFormData = { ...formData };

    if (type === "checkbox") {
      newFormData = {
        ...formData,
        [name]: (e.target as HTMLInputElement).checked,
      };
    } else if (type === "file") {
      const file = (e.target as HTMLInputElement).files
        ? (e.target as HTMLInputElement).files![0]
        : null;
      newFormData = { ...formData, [name]: file };
      if (file && name === "presaleImage") {
        setStatus(`Selected image: ${file.name}`);
      }
    } else {
      newFormData = { ...formData, [name]: value };
    }
    setFormData(newFormData);
    setStatus("");

    if (name === "tokenAddress") {
      if (isValidAddress(value)) {
        await fetchTokenDetails(value);
      } else if (value !== "") {
        setStatus("Invalid token address format.");
        setTokenDecimals(18);
        setTokenSymbol("");
        setTokenBalance("0");
        setTokenDeposit("0");
      } else {
        setTokenDecimals(18);
        setTokenSymbol("");
        setTokenBalance("0");
        setTokenDeposit("0");
      }
    }
  };

  const checkTokenBalanceAndDetails = async () => {
    if (
      !isConnected ||
      !formData.tokenAddress ||
      !isValidAddress(formData.tokenAddress)
    ) {
      setStatus("Connect wallet and enter a valid token address.");
      return;
    }
    const fetched = await fetchTokenDetails(formData.tokenAddress);
    if (fetched && address && tokenBalanceData && tokenDecimalsData) {
      const formattedBalance = (
        Number(tokenBalanceData) /
        10 ** Number(tokenDecimalsData)
      ).toFixed(0);
      setTokenBalance(formattedBalance);
      setStatus(
        `Token: ${tokenSymbol}, Balance: ${formattedBalance}, Decimals: ${tokenDecimals}`
      );
    }
  };

  const validateTimes = (): string | null => {
    const now = Date.now();
    const startTime = new Date(formData.start).getTime();
    const endTime = new Date(formData.end).getTime();

    if (isNaN(startTime) || isNaN(endTime)) {
      return "Invalid date format for start or end time.";
    }

    const minStartDelay = 5 * 60 * 1000;
    if (startTime <= now + minStartDelay) {
      return `Start time must be at least ${
        minStartDelay / (60 * 1000)
      } minutes in the future.`;
    }

    if (endTime <= startTime) {
      return "End time must be after start time.";
    }

    const minDuration = 1 * 60 * 60 * 1000;
    if (endTime - startTime < minDuration) {
      return "Presale duration must be at least 1 hour.";
    }

    const maxDuration = 90 * 24 * 60 * 60 * 1000;
    if (endTime - startTime > maxDuration) {
      return "Presale duration cannot exceed 90 days.";
    }
    const maxStartAhead = 180 * 24 * 60 * 60 * 1000;
    if (startTime > now + maxStartAhead) {
      return "Start time cannot be more than 180 days in the future.";
    }
    return null;
  };

  const approveToken = async (
    tokenAddr: string,
    amountToApprove: string,
    spenderAddr: string,
    tokenDecimalsToUse: number,
    tokenSymbolToUse: string,
    type: string
  ) => {
    if (
      !isConnected ||
      !tokenAddr ||
      !isValidAddress(tokenAddr) ||
      !spenderAddr ||
      !isValidAddress(spenderAddr)
    ) {
      setStatus(
        `Invalid parameters or wallet not connected for ${type} approval.`
      );
      setIsProcessing(false);
      return false;
    }
    if (parseFloat(amountToApprove) <= 0 && type !== "Max") {
      setStatus(`Approval amount for ${type} must be positive.`);
      setIsProcessing(false);
      return false;
    }

    if (chain?.id !== spicy.id) {
      try {
        await switchChain({ chainId: spicy.id });
        setStatus("Switched to Spicy network. Please try again.");
        setIsProcessing(false);
        return false;
      } catch (switchError: any) {
        setStatus(`Failed to switch network: ${switchError.message}`);
        setIsProcessing(false);
        return false;
      }
    }

    try {
      const amountInWei =
        type === "Max"
          ? BigInt(2 ** 256 - 1)
          : parseUnits(amountToApprove, tokenDecimalsToUse);
      setStatus(
        `Approving ${tokenSymbolToUse || type} (${amountToApprove})...`
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Wallet interaction timed out")),
          30000
        )
      );
      const approvalPromise = writeContractAsync({
        address: tokenAddr as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [spenderAddr as `0x${string}`, amountInWei],
      });

      const hash = await Promise.race([approvalPromise, timeoutPromise]);
      setTxHash(hash as `0x${string}`);
      setStatus(
        `Approval transaction sent: ${hash}. Waiting for confirmation...`
      );
      return true;
    } catch (error: any) {
      if (error.message.includes("User denied")) {
        setStatus(`Approval cancelled by user.`);
      } else if (error.message.includes("ERC20InsufficientBalance")) {
        setStatus(`Insufficient ${tokenSymbolToUse} balance for approval.`);
      } else if (error.message.includes("ERC20InsufficientAllowance")) {
        setStatus(`Insufficient allowance for ${tokenSymbolToUse}.`);
      } else if (error.message.includes("Wallet interaction timed out")) {
        setStatus("Wallet interaction timed out. Please try again.");
      } else {
        setStatus(
          `Error approving ${type}: ${error.message || "Unknown error"}.`
        );
      }
      setIsProcessing(false);
      return false;
    }
  };

  const handleApprove = async () => {
    if (tokenDeposit === "0" || !formData.tokenAddress) {
      setStatus("Enter valid token deposit and address first.");
      return;
    }
    setIsProcessing(true);
    setShowSuccess(false);

    const publicClient = getPublicClient(config);

    let approvalSuccess = false;

    if (!isTokenApproved) {
      approvalSuccess = await approveToken(
        formData.tokenAddress,
        tokenDeposit,
        FACTORY_ADDRESS,
        tokenDecimals,
        tokenSymbol,
        "Presale Token"
      );
    } else {
      approvalSuccess = true;
    }

    if (
      approvalSuccess &&
      creationFeeTokenAddress &&
      creationFeeTokenAddress !== zeroAddress &&
      parseFloat(creationFee) > 0 &&
      !isFeeApproved
    ) {
      try {
        const feeDecimals = (await publicClient.readContract({
          address: creationFeeTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        })) as number;
        approvalSuccess = await approveToken(
          creationFeeTokenAddress,
          creationFee,
          FACTORY_ADDRESS,
          feeDecimals,
          creationFeeTokenSymbol,
          "Fee Token"
        );
      } catch (err: any) {
        setStatus("Could not get fee token decimals for approval.");
        approvalSuccess = false;
        setIsProcessing(false);
      }
    }

    if (approvalSuccess) {
      setApprovalCompleted(true);
      setShowSuccess(true);
      setStatus("Approval successful! You can now create the presale.");
      setTimeout(() => setShowSuccess(false), 3000);
    }
    setIsProcessing(false);
  };

  const createPresale = async () => {
    if (!isConnected) {
      setStatus("Please connect wallet.");
      setIsProcessing(false);
      return;
    }
    setIsProcessing(true);
    setShowSuccess(false);

    const timeValidationError = validateTimes();
    if (timeValidationError) {
      setStatus(timeValidationError);
      setIsProcessing(false);
      return;
    }

    if (
      !isValidAddress(formData.tokenAddress) ||
      formData.tokenAddress === zeroAddress
    ) {
      setStatus("Invalid or missing Token Address.");
      setIsProcessing(false);
      return;
    }
    if (tokenDeposit === "0" || parseFloat(tokenDeposit) <= 0) {
      setStatus("Invalid token deposit. Check parameters.");
      setIsProcessing(false);
      return;
    }

    if (!isTokenApproved || !isFeeApproved) {
      setStatus("Please approve tokens first.");
      setIsProcessing(false);
      return;
    }

    if (chain?.id !== spicy.id) {
      try {
        await switchChain({ chainId: spicy.id });
        setStatus("Switched to Spicy network. Please try again.");
        setIsProcessing(false);
        return;
      } catch (switchError: any) {
        setStatus(`Failed to switch network: ${switchError.message}`);
        setIsProcessing(false);
        return;
      }
    }

    setStatus("Sending transaction to create presale...");

    try {
      const presaleOptions = {
        tokenDeposit: parseUnits(tokenDeposit, tokenDecimals),
        hardCap: parseEther(formData.hardCap),
        softCap: parseEther(formData.softCap),
        min: parseEther(formData.minContribution),
        max: parseEther(formData.maxContribution),
        presaleRate: BigInt(Math.floor(parseFloat(formData.presaleRate))),
        start: BigInt(Math.floor(new Date(formData.start).getTime() / 1000)),
        end: BigInt(Math.floor(new Date(formData.end).getTime() / 1000)),
        currency: zeroAddress as `0x${string}`,
        whitelistType: BigInt(parseInt(formData.whitelistType)),
        merkleRoot: (formData.whitelistType === "1" && formData.merkleRoot
          ? formData.merkleRoot
          : zeroHash) as `0x${string}`,
        nftContractAddress: (formData.whitelistType === "2" &&
        formData.nftContractAddress
          ? validateAndParseAddress(formData.nftContractAddress, "NFT Contract")
          : zeroAddress) as `0x${string}`,
      };

      let txOptions: { gas: bigint; value?: bigint } = { gas: BigInt(5000000) };
      if (!creationFeeTokenAddress || creationFeeTokenAddress === zeroAddress) {
        if (parseFloat(creationFee) > 0) {
          txOptions.value = parseEther(creationFee);
        }
      }

      const publicClient = getPublicClient(config);
      try {
        const gasEstimate = await publicClient.estimateContractGas({
          address: FACTORY_ADDRESS as `0x${string}`,
          abi: factoryAbi,
          functionName: "createPresale",
          args: [presaleOptions, formData.tokenAddress as `0x${string}`],
          account: address!,
          value: txOptions.value,
        });
        txOptions.gas = (gasEstimate * BigInt(120)) / BigInt(100);
      } catch (gasError: any) {
        console.error("Gas estimation error details:", gasError);
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Wallet interaction timed out")),
          30000
        )
      );
      const createPromise = writeContractAsync({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: factoryAbi,
        functionName: "createPresale",
        args: [presaleOptions, formData.tokenAddress as `0x${string}`],
        gas: txOptions.gas,
        value: txOptions.value,
      });

      const hash = await Promise.race([createPromise, timeoutPromise]);
      setTxHash(hash as `0x${string}`);
      setStatus(`Transaction sent. Waiting for confirmation...`);
    } catch (error: any) {
      if (error.message.includes("User denied")) {
        setStatus("Presale creation cancelled by user.");
      } else if (error.message.includes("ERC20InsufficientBalance")) {
        setStatus(`Insufficient ${tokenSymbol} balance for presale.`);
      } else if (error.message.includes("ERC20InsufficientAllowance")) {
        setStatus(`Insufficient allowance for ${tokenSymbol}.`);
      } else if (error.message.includes("InvalidState")) {
        setStatus("Presale is not in a valid state to be created.");
      } else if (error.message.includes("NotInPurchasePeriod")) {
        setStatus("Presale start time has already passed.");
      } else if (error.message.includes("ZeroAmount")) {
        setStatus("No tokens deposited for presale.");
      } else if (error.message.includes("InsufficientTokenDeposit")) {
        setStatus("Deposited tokens are less than required.");
      } else if (error.message.includes("InvalidInitialization")) {
        setStatus("Invalid contract initialization parameters.");
      } else if (error.message.includes("InvalidHouseConfiguration")) {
        setStatus("Invalid house fee configuration.");
      } else if (error.message.includes("InvalidCapSettings")) {
        setStatus("Hard cap or soft cap settings are invalid.");
      } else if (error.message.includes("InvalidContributionLimits")) {
        setStatus("Min or max contribution limits are invalid.");
      } else if (error.message.includes("InvalidRates")) {
        setStatus("Presale rate is invalid.");
      } else if (error.message.includes("InvalidTimestamps")) {
        setStatus("Start or end times are invalid.");
      } else if (error.message.includes("InvalidMerkleRoot")) {
        setStatus("Merkle root is required for whitelist type.");
      } else if (error.message.includes("InvalidNftContractAddress")) {
        setStatus("NFT contract address is required for whitelist type.");
      } else if (error.message.includes("Wallet interaction timed out")) {
        setStatus("Wallet interaction timed out. Please try again.");
      } else {
        setStatus(
          `Error creating presale: ${error.message || "Unknown error"}.`
        );
      }
      setIsProcessing(false);
    }
  };

  interface FormInputProps {
    label: string;
    name: keyof FormDataState | string;
    type?: string;
    placeholder?: string;
    value?: string | number | boolean | File | null;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    children?: React.ReactNode;
    info?: string;
    error?: string;
    required?: boolean;
    checked?: boolean;
    [key: string]: any;
  }

  const FormInput: React.FC<FormInputProps> = ({
    label,
    name,
    type = "text",
    placeholder,
    value,
    onChange,
    children,
    info,
    error,
    required,
    checked,
    ...props
  }) => (
    <div className="relative mb-6 group">
      <label
        htmlFor={name as string}
        className="block text-base font-semibold text-[#BFD4BF] mb-2 transition-all duration-300 group-hover:text-[#D4E8D4]"
      >
        {label} {required && <span className="text-red-500">*</span>}
        {info && (
          <span className="text-sm text-[#BFD4BF]/70 ml-2">({info})</span>
        )}
      </label>
      {type === "checkbox" ? (
        <input
          type={type}
          id={name as string}
          name={name as string}
          checked={checked}
          onChange={onChange}
          className="h-5 w-5 text-[#BFD4BF] border-[#BFD4BF]/50 rounded focus:ring-[#BFD4BF]/50 focus:ring-2 cursor-pointer transition-all duration-300 hover:bg-[#BFD4BF]/10"
          {...props}
        />
      ) : type === "select" ? (
        <select
          id={name as string}
          name={name as string}
          value={value as string | number}
          onChange={onChange}
          className="w-full p-3 bg-[#1C2526] border border-[#BFD4BF]/20 rounded-xl shadow-sm focus:ring-2 focus:ring-[#BFD4BF]/50 focus:border-[#BFD4BF]/50 text-[#BFD4BF] text-base transition-all duration-300 hover:shadow-[#BFD4BF]/10 hover:border-[#BFD4BF]/30 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCA1NiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNOCAxMS41TDEyLjUgNy41SDMuNUw4IDExLjVaIiBmaWxsPSIjQkZENEJGIi8+PC9zdmc+')] bg-no-repeat bg-[right_0.75rem_center] bg-[length:12px_12px]"
          {...props}
        >
          {children}
        </select>
      ) : type === "file" ? (
        <div className="relative">
          <input
            type={type}
            id={name as string}
            name={name as string}
            onChange={onChange}
            className="w-full p-3 bg-[#1C2526] border border-[#BFD4BF]/20 rounded-xl shadow-sm text-[#BFD4BF] text-base file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#BFD4BF]/20 file:text-[#BFD4BF] file:font-semibold file:hover:bg-[#BFD4BF]/30 file:transition-all file:duration-300 cursor-pointer focus:ring-2 focus:ring-[#BFD4BF]/50 focus:border-[#BFD4BF]/50 transition-all duration-300 hover:shadow-[#BFD4BF]/10 hover:border-[#BFD4BF]/30"
            {...props}
          />
          {name === "presaleImage" && typeof value === "object" && value && (
            <span className="text-sm text-[#BFD4BF]/80 ml-2 mt-1 block">
              Selected: {(value as File).name}
            </span>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            type={type}
            id={name as string}
            name={name as string}
            value={type !== "file" ? (value as string | number) : undefined}
            placeholder={placeholder}
            onChange={onChange}
            className="w-full p-3 bg-[#1C2526] border border-[#BFD4BF]/20 rounded-xl shadow-sm focus:ring-2 focus:ring-[#BFD4BF]/50 focus:border-[#BFD4BF]/50 text-[#BFD4BF] text-base placeholder-[#BFD4BF]/50 transition-all duration-300 hover:shadow-[#BFD4BF]/10 hover:border-[#BFD4BF]/30"
            {...props}
          />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#BFD4BF]/10 to-[#BFD4BF]/5 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" />
        </div>
      )}
      {error && (
        <p className="text-sm text-red-500 mt-1.5 font-medium">{error}</p>
      )}
    </div>
  );

  const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
    <h2 className="text-xl font-bold text-[#BFD4BF] mt-8 mb-4 pt-4 border-t border-[#BFD4BF]/20 relative">
      {title}
      <div className="absolute bottom-0 left-0 w-4 h-1 bg-[#BFD4BF] rounded-full" />
    </h2>
  );

  return (
    <div className="min-h-screen bg-emerald-100 flex items-center justify-center p-4 md:p-6 relative">
      <div className="relative bg-[#1C2526]/95 backdrop-blur-xl p-8 rounded-lg shadow-2xl shadow-[#BFD4BF]/5 w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#BFD4BF]">
          Create Your Token Presale
        </h1>

        {!isConnected ? (
          <button
            className="w-full bg-[#BFD4BF] text-[#14213E] py-3 px-6 rounded-lg font-semibold text-lg hover:bg-[#D4E8D4] focus:outline-none focus:ring-2 focus:ring-[#BFD4BF]/50 transition-all duration-300 shadow-md hover:shadow-[#BFD4BF]/30"
            onClick={connectWallet}
          >
            Connect Wallet
          </button>
        ) : (
          <>
            <div className="space-y-6">
              <SectionTitle title="Token & Currency Information" />
              <FormInput
                label="Token Address"
                name="tokenAddress"
                value={formData.tokenAddress}
                onChange={handleInputChange}
                placeholder="0x..."
                required
              />
              <div className="mb-4 p-2 bg-[#1C2526] rounded-lg border-t border-[#BFD4BF]/20">
                <p className="text-sm font-medium text-[#BFD4BF]">
                  Currency: CHZ
                </p>
              </div>

              <SectionTitle title="Sale Settings" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  label="Presale Rate"
                  name="presaleRate"
                  type="text"
                  value={formData.presaleRate}
                  onChange={handleInputChange}
                  placeholder="Tokens per CHZ"
                  required
                  info="Tokens per CHZ"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  label="Hard Cap"
                  name="hardCap"
                  type="text"
                  value={formData.hardCap}
                  onChange={handleInputChange}
                  placeholder="e.g., 100"
                  required
                  info="In CHZ"
                />
                <FormInput
                  label="Soft Cap"
                  name="softCap"
                  type="text"
                  value={formData.softCap}
                  onChange={handleInputChange}
                  placeholder="e.g., 50"
                  required
                  info="In CHZ"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  label="Min Contribution"
                  name="minContribution"
                  type="text"
                  value={formData.minContribution}
                  onChange={handleInputChange}
                  placeholder="e.g., 0.1"
                  required
                  info="Per user, in CHZ"
                />
                <FormInput
                  label="Max Contribution"
                  name="maxContribution"
                  type="text"
                  value={formData.maxContribution}
                  onChange={handleInputChange}
                  placeholder="e.g., 1"
                  required
                  info="Per user, in CHZ"
                />
              </div>

              <SectionTitle title="Schedule" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  label="Start Time"
                  name="start"
                  type="datetime-local"
                  value={formData.start}
                  onChange={handleInputChange}
                  required
                />
                <FormInput
                  label="End Time"
                  name="end"
                  type="datetime-local"
                  value={formData.end}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <FormInput
                label="Claim Delay"
                name="claimDelayMinutes"
                type="text"
                value={formData.claimDelayMinutes}
                onChange={handleInputChange}
                placeholder="Minutes after presale"
                info="Informational"
              />

              <SectionTitle title="Whitelist" />
              <FormInput
                label="Whitelist Type"
                name="whitelistType"
                type="select"
                value={formData.whitelistType}
                onChange={handleInputChange}
              >
                <option value="0">Public</option>
                <option value="1">Merkle Tree</option>
                <option value="2">NFT Holders</option>
              </FormInput>
              {formData.whitelistType === "1" && (
                <FormInput
                  label="Merkle Root"
                  name="merkleRoot"
                  value={formData.merkleRoot}
                  onChange={handleInputChange}
                  placeholder="0x..."
                />
              )}
              {formData.whitelistType === "2" && (
                <FormInput
                  label="NFT Contract"
                  name="nftContractAddress"
                  value={formData.nftContractAddress}
                  onChange={handleInputChange}
                  placeholder="0x..."
                />
              )}

              <div className="mt-6 pt-4 border-t border-[#BFD4BF]/20">
                <p className="text-base text-[#BFD4BF] mb-1">
                  Token to Deposit:{" "}
                  <span className="font-semibold">
                    {tokenDeposit} {tokenSymbol}
                  </span>
                </p>
                <p className="text-base text-[#BFD4BF] mb-1">
                  Your Balance:{" "}
                  <span className="font-semibold">
                    {tokenBalance} {tokenSymbol}
                  </span>
                </p>
                <p className="text-base text-[#BFD4BF]">
                  Creation Fee:{" "}
                  <span className="font-semibold">
                    {creationFee} {creationFeeTokenSymbol}
                  </span>
                </p>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  className="w-full bg-[#BFD4BF] text-[#14213E] py-3 px-6 rounded-lg font-semibold text-lg hover:bg-[#D4E8D4] focus:outline-none transition-all duration-300 shadow-md hover:shadow-[#BFD4BF]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  onClick={
                    isTokenApproved && isFeeApproved
                      ? createPresale
                      : handleApprove
                  }
                  disabled={isTxPending || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 mr-2 text-[#14213E]"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        ></path>
                      </svg>
                      Processing...
                    </>
                  ) : isTokenApproved && isFeeApproved ? (
                    "Create Presale"
                  ) : (
                    "Approve Tokens"
                  )}
                </button>
                <button
                  type="button"
                  className="p-2 text-[#BFD4BF] hover:text-[#D4E8D4] transition-all duration-300"
                  onClick={checkTokenBalanceAndDetails}
                  disabled={isTxPending}
                  title="Refresh Token Details"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {showSuccess && (
              <div className="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg max-w-sm w-full bg-white/90 text-base flex items-center justify-between">
                <span className="text-green-600">{status}</span>
                <button
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                  onClick={() => setShowSuccess(false)}
                >
                  Dismiss
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CreatePresalePage;
