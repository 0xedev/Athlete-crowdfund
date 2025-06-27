import { http, createConfig, injected } from "wagmi";
import { base, sepolia, chiliz, spicy } from "wagmi/chains";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";

export const config = createConfig({
  chains: [base, sepolia, chiliz, spicy],
  connectors: [farcasterFrame(), injected()],
  transports: {
    [base.id]: http(
      import.meta.env.VITE_BASE_MAINNET_RPC_URL || "https://mainnet.base.org"
    ),
    [sepolia.id]: http(
      import.meta.env.VITE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
    [chiliz.id]: http(
      import.meta.env.VITE_CHILIZ_RPC_URL || "https://rpc.chiliz.com"
    ),
    [spicy.id]: http(
      import.meta.env.VITE_SPICY_RPC_URL || "https://rpc.spicy.network"
    ),
  },
  multiInjectedProviderDiscovery: true, // Enable EIP-6963
  ssr: false, // Set to true if using SSR/SSG
});
