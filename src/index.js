const axios = require('axios');

// Get value from CLI: `node script.js 100000`
const totalValue = parseFloat(process.argv[2]);

if (isNaN(totalValue)) {
  console.error('Usage: node script.js <total-value>');
  process.exit(1);
}

const API_URL = 'https://voi-mainnet-mimirapi.nftnavigator.xyz/nft-indexer/v1/tokens?contractId=39924040';

const ELEMENT_WEIGHTS = {
  Earth: 0.5,
  Fire: 1,
  Water: 2,
  Gold: 5,
};

async function fetchNFTData() {
  try {
    const response = await axios.get(API_URL);
    const tokens = response.data.tokens || [];

    console.log(`Fetched ${tokens.length} tokens`);
    console.log(`\nTotal reward pool: ${totalValue} VOI`);

    const holderMap = {};

    for (const token of tokens) {
      const owner = token.owner;
      if (!token.metadata) continue;

      try {
        const metadata = JSON.parse(token.metadata);
        const element = metadata.properties?.Element || 'Unknown';

        if (!holderMap[owner]) {
          holderMap[owner] = {
            total: 0,
            points: 0,
            elements: {},
          };
        }

        const weight = ELEMENT_WEIGHTS[element] || 0;

        holderMap[owner].total += 1;
        holderMap[owner].points += weight;
        holderMap[owner].elements[element] = (holderMap[owner].elements[element] || 0) + 1;

      } catch (e) {
        console.warn(`Failed to parse metadata for tokenId ${token.tokenId}`);
      }
    }

    // Compute total points
    const allPoints = Object.values(holderMap).reduce((sum, h) => sum + h.points, 0);

    // Build payout report
    const report = Object.entries(holderMap).map(([owner, data]) => {
      const payout = allPoints > 0 ? (data.points / allPoints) * totalValue : 0;

      // Placeholder for sending payout
      console.log(`Would send ${payout.toFixed(6)} VOI to ${owner}`);

      return {
        owner,
        total: data.total,
        points: data.points,
        payout: payout.toFixed(6),
        ...data.elements,
      };
    });

    // Sort by payout descending
    report.sort((a, b) => b.payout - a.payout);

    console.log('\n📤 Holder Reward Distribution (Top 10):');
    console.table(report.slice(0, 10));

  } catch (error) {
    console.error('Failed to fetch or process NFT data:', error.message);
  }
}

fetchNFTData();

