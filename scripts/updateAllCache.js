const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');

function getCurrentNetworkName(networkID) {
  switch (networkID) {
    case 1:
      return 'Ethereum';
    case 56:
      return 'BinanceSmartChain';
    case 100:
      return 'GnosisChain';
    case 137:
      return 'Polygon';
    case 42161:
      return 'Arbitrum';
    case 43114:
      return 'Avalanche';
    case 5:
      return 'Goerli';
    case 42:
      return 'Kovan';
    case 10:
      return 'Optimism';
    default:
      return 'testRPC';
  }
}

function syncDeposits(currency, amount, networkID) {
  return childProcess.spawnSync('node', ['cli.js', 'checkCacheValidity', currency, amount, networkID]);
}

function syncWithdrawals(currency, amount, networkID) {
  return childProcess.spawnSync('node', ['cli.js', 'syncEvents', 'withdrawal', currency, amount, networkID]);
}

function checkSyncResult(resultData, networkName, currency, amount, eventType) {
  const resultOutput = resultData.output.toString();

  if (resultData.error || resultOutput.includes('Error:')) {
    console.log(resultOutput);
    console.error(`Error while updating cache for ${currency.toUpperCase()} ${amount} ${eventType}s on ${networkName}`);
  } else {
    console.log(`Successfully updated cache for ${currency.toUpperCase()} ${amount} ${eventType}s on ${networkName}`);
  }
}

function main() {
  const fromScrath = false;
  for (const [networkIDInfo, network] of Object.entries(config.deployments)) {
    const networkID = Number(networkIDInfo.match(/\d+/)[0]);
    const networkName = getCurrentNetworkName(networkID);

    for (const [currency, _data] of Object.entries(network.tokens)) {
      for (const amount of Object.keys(_data.instanceAddress)) {
        if(networkID === 10 && amount == 100) continue; // skip 100 ETH optimism, there is no deposits
        console.log(`\nStart updating cache for ${currency.toUpperCase()} ${amount} deposits on ${networkName}`);
        const depositsFile = path.join('cache', networkName.toLowerCase(), `deposits_${currency.toLowerCase()}_${amount}.json`);
        const withdrawalFile = path.join('cache', networkName.toLowerCase(), `withdrawals_${currency.toLowerCase()}_${amount}.json`);
        if(fromScrath) {
          fs.rmSync(depositsFile, {force: true});
          fs.rmSync(withdrawalFile, {force: true});
        }
        let depositSyncResult = syncDeposits(currency, amount, networkID);

        // If deposit events tree has invalid root, need to reload it all from deployment block
        if (depositSyncResult.output.includes('invalid root')) {
          console.log(
            `Events tree for ${currency.toUpperCase()} ${amount} ${eventType}s on ${networkName} has invalid root. Start full reloading.`
          );
          fs.rmSync(depositsFile, {force: true});
          depositSyncResult = syncDeposits(currency, amount, defaultRpc);
        }
        checkSyncResult(depositSyncResult, networkName, currency, amount, 'deposit');

        console.log(`\nStart updating cache for ${currency.toUpperCase()} ${amount} withdrawals on ${networkName}`);
        const withdrawalSyncResult = syncWithdrawals(currency, amount, networkID);
        checkSyncResult(withdrawalSyncResult, networkName, currency, amount, 'withdrawal');
      }
    }
  }

  console.log('\nAll event trees cache updated!\n');
}

main();
