Art & Athletics Crowdfunding Platform
Overview
A decentralized platform on the Chilliz blockchain for artists and athletes to crowdfund creative and athletic projects securely and transparently. Supporters discover and back unique projects, while creators launch campaigns with ease.
Features

For Supporters:
Discover projects by artists and athletes
Secure contributions via blockchain
Engage with creators and track project updates

For Creators:
Simple campaign setup with customizable funding goals
Global reach to connect with supporters
Secure and transparent fund management

Security:
Audited smart contracts
Fully decentralized on Base
Instant, secure transactions

Getting Started
Prerequisites

Node.js (v16+)
MetaMask or compatible wallet
Base network configured in wallet

Installation

Clone the repository:git clone https://github.com/your-repo/art-athletics-crowdfunding.git

Install dependencies:cd art-athletics-crowdfunding
npm install

Start the development server:npm run dev

Usage

Connect Wallet: Use MetaMask to connect to the Base network.
Explore Projects: Navigate to /projects to view active campaigns.
Create Campaign: Go to /create to set up your project (artists/athletes only).
Input token address, funding goals, contribution limits, and schedule.
Approve tokens and pay creation fee (if applicable).
Submit to deploy your campaign.

Support Projects: Browse projects, contribute ETH, and track your contributions.

Smart Contracts

PresaleFactory.sol: Deploys new presale contracts for campaigns.
Presale.sol: Manages individual project campaigns, contributions, and payouts.
Deployed on Base at 0x9BcB18e3621321B50ff01b4ddcC463B6444A0E4b.

Tech Stack

Frontend: React, TypeScript, Tailwind CSS, Wagmi (for Web3 integration)
Backend: Solidity smart contracts on Base blockchain
Tools: Vite, foundry (for contract development), wagmi/viem

Contributing

Fork the repository.
Create a feature branch (git checkout -b feature/YourFeature).
Commit changes (git commit -m 'Add YourFeature').
Push to the branch (git push origin feature/YourFeature).
Open a Pull Request.

License
MIT License. See LICENSE for details.
