const axios = require('axios');

const namehash = require('eth-ens-namehash');

const BigNumber = require('bignumber.js');

const apikey = '6a217817dd87d33db10beed79b044a91';

const api = 'https://gateway.thegraph.com/api/' + apikey + '/subgraphs/id/DgKwfAbLfynpiq7fDJy59LDnVnia4Y5nYeRDBYi9qezc';

const Web3 = require('web3');

const web3 = new Web3('https://rpc.mevblocker.io');

const aggregatorContract = '0xE8F47A78A6D52D317D0D2FFFac56739fE14D1b49';

const AggregatorABI = require('./abis/Aggregator.abi');

const aggregator = new web3.eth.Contract(AggregatorABI, aggregatorContract);

const MIN_STAKE_BALANCE = '0X1B1AE4D6E2EF500000'; // 500 TORN

const networkConfig = require('./config.js');

const subdomains = Object.values(networkConfig.deployments).map(({ ensSubdomainKey }) => ensSubdomainKey);

async function fetchRelayers() {
  return new Promise(async (resolve, reject) => {
    axios.post(api, { 'query': '{ relayers(first: 1000) {\n    id\n    address\n    ensName\n    ensHash\n  }\n}' }
    ).then(res => {
      if (res.data.errors) {
        console.log(res.data);
        return;
      }
      if (res.data.data.relayers.length > 0) {
        resolve(res.data.data.relayers);
      }
    });
  });
}

function filterRelayer(acc, curr, ensSubdomainKey, relayer) {
  const subdomainIndex = subdomains.indexOf(ensSubdomainKey);
  const mainnetSubdomain = curr.records[0];
  const hostname = curr.records[subdomainIndex];
  const isHostWithProtocol = hostname.includes('http');

  const isOwner = relayer.address.toLowerCase() === curr.owner.toLowerCase();
  const hasMinBalance = new BigNumber(curr.balance).gte(MIN_STAKE_BALANCE);

  if (
    hostname &&
    isOwner &&
    mainnetSubdomain &&
    curr.isRegistered &&
    hasMinBalance &&
    !isHostWithProtocol
  ) {
    acc.push({
      hostname,
      ensName: relayer.ensName,
      stakeBalance: curr.balance,
      relayerAddress: relayer.address.toLowerCase()
    });
  }
  return acc;
}

async function getValidRelayers(relayers, ensSubdomainKey) {
  const relayerNameHashes = relayers.map((r) => namehash.hash(r.ensName));
  const relayersData = await aggregator.methods.relayersData(relayerNameHashes, subdomains).call();
  const validRelayers = relayersData.reduce(
    (acc, curr, index) => filterRelayer(acc, curr, ensSubdomainKey, relayers[index]),
    []
  );
  return validRelayers;
}

async function getRelayers(ensSubdomainKey) {
  let relayers = await fetchRelayers();
  const validRelayers = await getValidRelayers(relayers, ensSubdomainKey);
  return validRelayers;
}

async function load() {

  console.log('Please enter the relay number of the chain you want to obtain:');
  console.log('1. Eth, 2. Bsc, 3. Gnosis, 4. Polygon, 5. Arb, 6. Avax, 7. Op');

  process.stdin.on('data', async (data) => {
    const input = data.toString().trim(); // 将输入转换为字符串并去除多余空格
    if (/^[1-7]$/.test(input)) {
      let ensSubdomainKey = Object.values(networkConfig.deployments)[input - 1].ensSubdomainKey;

      console.log('Start requesting data');

      const registeredRelayers = await getRelayers(ensSubdomainKey);
      const axiosInstance = axios.create({
        timeout: 3000
      });
      let statuses = [];
      for (const registeredRelayer of registeredRelayers) {
        try {
          console.log(`https://${registeredRelayer.hostname}/status`);
          const res = await axiosInstance.get(`https://${registeredRelayer.hostname}/status`);
          const statusData = res.data;
          if (statusData.rewardAccount && statusData.health.status == 'true') {
            statuses.push({
              ...registeredRelayer,
              statusData
            });
          }
        } catch (e) {
          console.error(`Failed to fetch status for ${registeredRelayer.hostname}:`);
        }

      }
      statuses.forEach(item => {
        console.log({
          'hostname': 'https://' + item.hostname + '/',
          'ensName': item.ensName,
          'stakeBalance': Number(web3.utils.fromWei(item.stakeBalance, 'ether')).toFixed(2)+" TORN",
          'tornadoServiceFee': item.statusData.tornadoServiceFee
        });
      });

    } else {
      console.log('Invalid input! Please enter a single number between 1-7');
    }
  });

}

load();
