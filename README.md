# DeFi Fundamentals

Hey there! This is a little dashboard I put together to track what's actually happening in Decentralized Finance right now. Instead of just looking at token prices, I wanted to build something that looks at the *fundamentals*—specifically, how much value is locked in these protocols (TVL) and how much revenue they are actually generating. 

Think of it as a mini Bloomberg Terminal for DeFi, but without the $24,000 yearly subscription fee. 

## What's inside?

- **The Big Picture:** Right at the top, you'll see the total TVL across the entire DeFi space, along with a quick breakdown of how that money is spread across the top 8 chains (Ethereum, Solana, Arbitrum, etc.).
- **Who's Making Money?** There's a ranked table showing the top 10 protocols based on how much revenue they pulled in over the last 7 days. I also added their 30-day revenue and a quick trend direction so you can see if they are growing or shrinking.
- **Capital Efficiency:** This is my favorite part. It calculates a "Revenue Efficiency" metric for the top protocols. Basically, it takes their annualized revenue and divides it by their TVL to show who is actually putting their locked capital to work efficiently.

## How it works under the hood

The whole thing is built as a single-page React application using Vite and styled with Tailwind CSS (going for that sleek, dark-mode terminal vibe). The charts are handled by Recharts.

The best part? It doesn't need a heavy backend or database. Everything fetches live directly from the awesome [DeFiLlama public API](https://defillama.com/docs/api). Every time you load the page, it grabs the latest snapshot.

## Want to run it yourself?

It's super easy to spin up on your own machine. 

1. Install the dependencies:
   npm install

2. Start the local dev server:
   npm run dev

3. Open up `http://localhost:5173` in your browser and you're good to go!
