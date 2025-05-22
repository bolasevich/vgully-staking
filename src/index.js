const axios = require('axios');
const algosdk = require('algosdk');
const MNEMONIC = 'seed phrase here'; // Never commit this in production!
const senderAccount = algosdk.mnemonicToSecretKey(MNEMONIC);
// Voi Mainnet Algorand API (using AlgoNode as an example)
const algodClient = new algosdk.Algodv2('', 'https://mainnet-api.voi.nodely.dev', '');

// CLI usage: node script.js 100000 --nodryrun
const totalValue = parseFloat(process.argv[2]);
const isDryRun = !process.argv.includes('--nodryrun');

if (isNaN(totalValue)) {
  console.error('Usage: node script.js <total-value> [--nodryrun]');
  process.exit(1);
}

const API_URL = 'https://voi-mainnet-mimirapi.nftnavigator.xyz/nft-indexer/v1/tokens?contractId=39924040';

const ELEMENT_WEIGHTS = {
  Earth: 0.5,
  Fire: 1,
  Water: 2,
  Gold: 5,
};

async function sendPayment(toAddress, amount) {
  try {
    const params = await algodClient.getTransactionParams().do();

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAccount.addr,
      to: toAddress,
      amount: algosdk.algosToMicroalgos(amount), // convert VOI to microVOI
      suggestedParams: params,
      note: new TextEncoder().encode(
        `Drop ${amount} VOI for vGully holder rewards`
      ),
    });

    const signedTxn = txn.signTxn(senderAccount.sk);
    const { txId } = await algodClient.sendRawTransaction(signedTxn).do();

    console.log(`[TRANSFER] Sent ${amount.toFixed(6)} VOI to ${toAddress} | TXID: ${txId}`);
  } catch (error) {
    console.error(`[ERROR] Failed to send ${amount} VOI to ${toAddress}:`, error.message);
  }
}

async function fetchNFTData() {
  try {
    const response = await axios.get(API_URL);
    const tokens = response.data.tokens || [];

    console.log(`Fetched ${tokens.length} tokens`);
    console.log(`\nTotal reward pool: ${totalValue} VOI`);
    console.log(`Dry Run Mode: ${isDryRun ? 'ON' : 'OFF'}\n`);

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

    const allPoints = Object.values(holderMap).reduce((sum, h) => sum + h.points, 0);

    const report = Object.entries(holderMap).map(([owner, data]) => {
      const payout = allPoints > 0 ? (data.points / allPoints) * totalValue : 0;

      if (isDryRun) {
        console.log(`[DRYRUN] Would send ${payout.toFixed(6)} VOI to ${owner}`);
      } else {
        sendPayment(owner, payout);
      }

      return {
        owner,
        total: data.total,
        points: data.points,
        payout: payout.toFixed(6),
        ...data.elements,
      };
    });

    report.sort((a, b) => b.payout - a.payout);

    console.log('\n📤 Holder Reward Distribution (Top 10):');
    console.table(report.slice(0, 10));

  } catch (error) {
    console.error('Failed to fetch or process NFT data:', error.message);
  }
}

fetchNFTData();

