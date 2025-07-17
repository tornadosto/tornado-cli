#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const assert = require('assert');
const snarkjs = require('@tornado/snarkjs');
const crypto = require('crypto');
const circomlib = require('@tornado/circomlib');
const bigInt = snarkjs.bigInt;
const MerkleTree = require('@tornado/fixed-merkle-tree');
const Web3 = require('web3');
const web3Utils = require("web3-utils")
const buildGroth16 = require('@tornado/websnark/src/groth16');
const websnarkUtils = require('@tornado/websnark/src/utils');
const { toWei, fromWei, toBN, BN } = require('web3-utils');
const BigNumber = require('bignumber.js');
const program = require('commander');
const { TornadoFeeOracleV4, TornadoFeeOracleV5 } = require('@tornado/tornado-oracles');
const { SocksProxyAgent } = require('socks-proxy-agent');
const is_ip_private = require('private-ip');
const readline = require('readline');

const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });

const config = require('./config');
const erc20Abi = require('./abis/ERC20.abi.json');
const tornadoProxyAbi = require('./abis/TornadoProxy.abi.json');
const tornadoInstanceAbi = require('./abis/Instance.abi.json');
const relayerRegistryAbi = require("./abis/RelayerRegistry.abi.json");
const relayerAggregatorAbi = require('./abis/Aggregator.abi');
const tornadoGovernanceAbi = require("./abis/Governance.abi.json");
const stakingRewardsAbi = require("./abis/StakingRewards.abi.json");

const relayerAggregatorAddress = config.deployments[`netId1`].relayerAggregator;
const relayerRegistryAddress = config.deployments[`netId1`].relayerRegistry;
const relayerRegistryDeployedBlockNumber = config.deployments["netId1"].relayerRegistryDeployedBlockNumber;
const relayerSubdomains = Object.values(config.deployments).map(({ ensSubdomainKey }) => ensSubdomainKey);
const tornTokenAddress = "0x77777FeDdddFfC19Ff86DB637967013e6C6A116C";
const governanceAddress = "0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce";
const stakingRewardsAddress = "0x5B3f656C80E8ddb9ec01Dd9018815576E9238c29";

/** @typedef {import ("web3-eth-contract").Contract} Web3Contract */
/** @typedef {import ("web3-eth").Eth} Web3Eth */
/** @typedef {('deposit' | 'withdrawal' | 'relayer')} EventType */

/**
 * @typedef RequestOptions
 * @type {Object}
 * @property {number} timeout Timeout in milliseconds
 * @property {SocksProxyAgent} [httpsAgent] Proxy agent instance, if user selected Tor proxy
 * @property {Object} [headers] Headers for request, for exmple, User-Agent, if needed
 */

/**
 * @typedef ProgramGlobals
 * @type {Object}
 * @property {string} [privateKey] User-provided private key for Ethereum account
 * @property {Web3Eth} [web3Instance] Instance of Web3 Eth to interact with blockchain networks
 * @property {Web3Eth} [relayerWeb3Instance] Instance of Web3 Eth to interact with Ethereum Mainnet
 * @property {boolean} useOnlyRpc If true, use only RPC without third-party requests (IP detection, subgraph API)
 * @property {boolean} shouldPromptConfirmation Ask user for confirmation in interactive mode for crucial actions (withdraw note, send money)
 * @property {boolean} shouldSubmitTx If false, don't broadcast signed transaction to the node
 * @property {number} [torPort] Port to send all requests through tor
 * @property {RequestOptions} requestOptions Axios options for network requests (timeout, proxy)
 * @property {string} [multiCallAddress] Address of Multicall contract for selected chain
 * @property {string} [tornadoProxyAddress] Address of Tornado Proxy contract for selected chain
 * @property {string} [tornadoInstanceAddress] Tornado Cash instance contract address for selected pool (chain/currency/value)
 * @property {string} [instanceTokenAddress] Token address for Tornado Cash pool instance for selected token
 * @property {number} [instanceDeployedBlockNumber] Block number in which instance contract was deployed in blockchain
 * @property {string} [signerAddress] Address of signer account (user account, generated from provided private key)
 * @property {TornadoFeeOracleV4 | TornadoFeeOracleV5} [feeOracle] Oracle instance for fetching gas price and calculate network fees (gas) for Tornado transactions
 * @property {Web3Contract} [tornadoInstanceContract] Tornado cash instance contract for selected pool (chain/currency/value)
 * @property {Web3Contract} [tornadoProxyContract] Tornado cash proxy contract for selected chain
 * @property {Web3Contract} [tornadoTokenInstanceContract] Tornado Cash instance contract for selected token pool (for ERC20 token mixing pools, e.g. DAI)
 * @property {Web3Contract} [governanceContract] Tornado Cash Governance contract instance to access staking/voting functionality
 * @property {Web3Contract} [tornTokenContract] TORN token contract instance to approve/send tokens
 * @property {Web3Contract} [stakingRewardsContract] Staking rewards contract to distribute TORN tokens earned by Tornado protocol between TORN stakers
 * @property {string} netName Network (chain) human-readable name
 * @property {string} netSymbol Network main token symbol (ETH for Ethereum mainnet and so on)
 * @property {string} netId Network (chain) ID
 */

/** @type {ProgramGlobals} */
const globals =
{
  privateKey: undefined,
  web3Instance: undefined,
  relayerWeb3Instance: undefined,
  useOnlyRpc: false,
  shouldPromptConfirmation: true,
  shouldSubmitTx: true,
  torPort: undefined,
  requestOptions: { timeout: 10000 },
  multiCallAddress: undefined,
  tornadoProxyAddress: undefined,
  tornadoInstanceAddress: undefined,
  instanceTokenAddress: undefined,
  instanceDeployedBlockNumber: undefined,
  signerAddress: undefined,
  feeOracle: undefined,
  tornadoInstanceContract: undefined,
  tornadoProxyContract: undefined,
  governanceContract: undefined,
  tornTokenContract: undefined,
  stakingRewardsContract: undefined,
  netName: "Ethereum",
  netSymbol: "ETH",
  netId: 1
}

/** Generate random number of specified byte length */
const rbigint = (nbytes) => snarkjs.bigInt.leBuff2int(crypto.randomBytes(nbytes));

/** Compute pedersen hash */
const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0];

/** BigNumber to hex string of specified length */
function toHex(number, length = 32) {
  const str = number instanceof Buffer ? number.toString('hex') : bigInt(number).toString(16);
  return '0x' + str.padStart(length * 2, '0');
}

/** Remove Decimal without rounding with BigNumber */
function rmDecimalBN(bigNum, decimals = 6) {
  return new BigNumber(bigNum)
    .times(BigNumber(10).pow(decimals))
    .integerValue(BigNumber.ROUND_DOWN)
    .div(BigNumber(10).pow(decimals))
    .toNumber();
}

/** Use MultiCall Contract */
async function useMultiCall(queryArray) {
  const multiCallABI = require('./abis/Multicall.abi.json');
  const multiCallContract = new globals.web3Instance.Contract(multiCallABI, globals.multiCallAddress);
  const { returnData } = await multiCallContract.methods.aggregate(queryArray).call();
  return returnData;
}

/** Display ETH account balance */
async function printETHBalance({ address, name }) {
  const { netSymbol, web3Instance } = globals;
  const checkBalance = new BigNumber(await web3Instance.getBalance(address)).div(BigNumber(10).pow(18));
  console.log(`${name} balance is`, rmDecimalBN(checkBalance), `${netSymbol}`);
}

/** Display ERC20 account balance */
async function printERC20Balance({ address, name, tokenAddress }) {
  const { web3Instance, multiCallAddress } = globals;
  let tokenDecimals, tokenBalance, tokenName, tokenSymbol;
  const erc20Contract = tokenAddress ? new web3Instance.Contract(erc20Abi, tokenAddress) : globals.tornadoTokenInstanceContract;
  if (!multiCallAddress) {
    const tokenCall = await useMultiCall([
      [tokenAddress, erc20Contract.methods.balanceOf(address).encodeABI()],
      [tokenAddress, erc20Contract.methods.decimals().encodeABI()],
      [tokenAddress, erc20Contract.methods.name().encodeABI()],
      [tokenAddress, erc20Contract.methods.symbol().encodeABI()]
    ]);
    tokenDecimals = parseInt(tokenCall[1]);
    tokenBalance = new BigNumber(tokenCall[0]).div(BigNumber(10).pow(tokenDecimals));
    tokenName = web3Instance.abi.decodeParameter('string', tokenCall[2]);
    tokenSymbol = web3Instance.abi.decodeParameter('string', tokenCall[3]);
  } else {
    tokenDecimals = await erc20Contract.methods.decimals().call();
    tokenBalance = new BigNumber(await erc20Contract.methods.balanceOf(address).call()).div(BigNumber(10).pow(tokenDecimals));
    tokenName = await erc20Contract.methods.name().call();
    tokenSymbol = await erc20Contract.methods.symbol().call();
  }
  console.log(`${name}`, tokenName, `Balance is`, rmDecimalBN(tokenBalance), tokenSymbol);
}

/**
 * @typedef TreeData
 * @type {Object}
 * @property {string[]} leaves Commitment hashes converted to decimals
 * @property {MerkleTree} tree Builded merkle tree
 * @property {string} root Merkle tree root
 */

/**
 * Compute merkle tree and its root from array of cached deposit events
 * @param {Array} depositEvents Array of deposit event objects
 * @returns {TreeData}

 */
function computeDepositEventsTree(depositEvents) {
  const leaves = depositEvents
    .sort((a, b) => a.leafIndex - b.leafIndex) // Sort events in chronological order
    .map((e) => toBN(e.commitment).toString(10)); // Leaf = commitment pedersen hash of deposit

  console.log('Computing deposit events merkle tree and its root');
  const merkleTreeHeight = process.env.MERKLE_TREE_HEIGHT || 20;
  const tree = new MerkleTree(merkleTreeHeight, leaves);

  return { leaves, tree, root: tree.root() };
}

/**
 * Check validity of events merkle tree root via tornado contract
 * @async
 * @param {Array} depositEvents
 * @returns {Promise<boolean>} True, if root is valid, else false
 * @throws {Error}
 */
async function isRootValid(depositEvents) {
  const { root } = computeDepositEventsTree(depositEvents);
  const isRootValid = await globals.tornadoInstanceContract.methods.isKnownRoot(toHex(root)).call();

  return isRootValid;
}

async function submitTransaction(signedTX) {
  console.log('Submitting transaction to the remote node');
  await globals.web3Instance
    .sendSignedTransaction(signedTX)
    .on('transactionHash', function (txHash) {
      console.log(`View transaction on block explorer https://${getExplorerLink()}/tx/${txHash}`);
    })
    .on('error', function (e) {
      console.error('on transactionHash error', e.message);
    });
}

async function generateTransaction(to, encodedData, value = 0, txType = 'other') {
  const { signerAddress, privateKey, netSymbol, netId, web3Instance, shouldPromptConfirmation } = globals;
  const nonce = await web3Instance.getTransactionCount(signerAddress);

  value = toBN(value);

  let incompletedTx = {
    to,
    value: value.toString(),
    data: encodedData
  };
  if (txType === 'send') incompletedTx['from'] = signerAddress;
  const { gasPrice, gasLimit } = await globals.feeOracle.getGasParams({ tx: incompletedTx, txType });
  const gasCosts = toBN(gasPrice).mul(toBN(gasLimit));
  const totalCosts = value.add(gasCosts);

  /** Transaction details */
  console.log('Gas price: ', web3Utils.hexToNumber(gasPrice));
  console.log('Gas limit: ', gasLimit);
  console.log('Transaction fee: ', rmDecimalBN(fromWei(gasCosts), 12), `${netSymbol}`);
  console.log('Transaction cost: ', rmDecimalBN(fromWei(totalCosts), 12), `${netSymbol}`);
  /** ----------------------------------------- **/

  function txoptions() {
    // Generate EIP-1559 transaction
    if (netId == 1) {
      return {
        to: to,
        value: value,
        nonce: nonce,
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: web3Utils.toHex(web3Utils.toWei('3', 'gwei')),
        gas: gasLimit,
        data: encodedData
      };
    } else if (netId == 5 || netId == 137 || netId == 43114) {
      return {
        to: to,
        value: value,
        nonce: nonce,
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: gasPrice,
        gas: gasLimit,
        data: encodedData
      };
    } else {
      return {
        to: to,
        value: value,
        nonce: nonce,
        gasPrice: gasPrice,
        gas: gasLimit,
        data: encodedData
      };
    }
  }

  if (shouldPromptConfirmation) await promptConfirmation();

  const tx = txoptions();
  const signed = await web3Instance.accounts.signTransaction(tx, privateKey);

  if (globals.shouldSubmitTx) {
    await submitTransaction(signed.rawTransaction);
  } else {
    console.log('\n=============Raw TX=================', '\n');
    console.log(
      `Please submit this raw tx to https://${getExplorerLink()}/pushTx, or otherwise broadcast with node cli.js broadcast command.`,
      `\n`
    );
    console.log(signed.rawTransaction, `\n`);
    console.log('=====================================', '\n');
  }
}

/**
 * Create deposit object from secret and nullifier
 */
function createDeposit({ nullifier, secret }) {
  let deposit = { nullifier, secret };
  deposit.preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)]);
  deposit.commitment = pedersenHash(deposit.preimage);
  deposit.commitmentHex = toHex(deposit.commitment);
  deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31));
  deposit.nullifierHex = toHex(deposit.nullifierHash);
  return deposit;
}

async function backupNote({ currency, amount, netId, note, noteString }) {
  try {
    fs.writeFileSync(`./backup-tornado-${currency}-${amount}-${netId}-${note.slice(0, 10)}.txt`, noteString, 'utf8');
    console.log('Backed up deposit note as', `./backup-tornado-${currency}-${amount}-${netId}-${note.slice(0, 10)}.txt`);
  } catch (e) {
    throw new Error('Writing backup note failed:', e);
  }
}

async function backupInvoice({ currency, amount, netId, commitmentNote, invoiceString }) {
  try {
    fs.writeFileSync(
      `./backup-tornadoInvoice-${currency}-${amount}-${netId}-${commitmentNote.slice(0, 10)}.txt`,
      invoiceString,
      'utf8'
    );
    console.log(
      'Backed up invoice as',
      `./backup-tornadoInvoice-${currency}-${amount}-${netId}-${commitmentNote.slice(0, 10)}.txt`
    );
  } catch (e) {
    throw new Error('Writing backup invoice failed:', e);
  }
}

/**
 * create a deposit invoice.
 * @param currency Сurrency
 * @param amount Deposit amount
 */
async function createInvoice({ currency, amount, chainId }) {
  const deposit = createDeposit({
    nullifier: rbigint(31),
    secret: rbigint(31)
  });
  const note = toHex(deposit.preimage, 62);
  const noteString = `tornado-${currency}-${amount}-${chainId}-${note}`;
  console.log(`Your note: ${noteString}`);

  const commitmentNote = toHex(deposit.commitment);
  const invoiceString = `tornadoInvoice-${currency}-${amount}-${chainId}-${commitmentNote}`;
  console.log(`Your invoice for deposit: ${invoiceString}`);

  await backupNote({ currency, amount, netId: chainId, note, noteString });
  await backupInvoice({ currency, amount, netId: chainId, commitmentNote, invoiceString });

  return noteString, invoiceString;
}

/**
 * Make a deposit
 * @param currency Сurrency
 * @param amount Deposit amount
 */
async function deposit({ currency, amount, commitmentNote }) {
  currency = currency.toLowerCase();

  const { signerAddress, tornadoProxyAddress, tornadoInstanceAddress, tornadoProxyContract, instanceTokenAddress, tornadoTokenInstanceContract, netSymbol, netId } = globals;
  assert(signerAddress != null, 'Error! Private key not found. Please provide PRIVATE_KEY in .env file or as command argument, if you deposit');
  let commitment, noteString;
  if (!commitmentNote) {
    console.log('Creating new random deposit note');
    const deposit = createDeposit({
      nullifier: rbigint(31),
      secret: rbigint(31)
    });
    const note = toHex(deposit.preimage, 62);
    noteString = `tornado-${currency}-${amount}-${netId}-${note}`;
    console.log(`Your note: ${noteString}`);
    await backupNote({ currency, amount, netId, note, noteString });
    commitment = toHex(deposit.commitment);
  } else {
    console.log('Using supplied invoice for deposit');
    commitment = toHex(commitmentNote);
  }
  if (currency === netSymbol.toLowerCase()) {
    await printETHBalance({ address: tornadoInstanceAddress, name: 'Tornado contract' });
    await printETHBalance({ address: signerAddress, name: 'Sender account' });
    const value = fromDecimals({ amount, decimals: 18 });
    console.log('Submitting deposit transaction');
    await generateTransaction(tornadoProxyAddress, tornadoProxyContract.methods.deposit(tornadoInstanceAddress, commitment, []).encodeABI(), value);
    await printETHBalance({ address: tornadoInstanceAddress, name: 'Tornado contract' });
    await printETHBalance({ address: signerAddress, name: 'Sender account' });
  } else {
    // a token
    await printERC20Balance({ address: tornadoInstanceAddress, name: 'Tornado contract' });
    await printERC20Balance({ address: signerAddress, name: 'Sender account' });
    const decimals = config.deployments[`netId${netId}`]['tokens'][currency].decimals;
    const tokenAmount = fromDecimals({ amount, decimals });

    const allowance = await tornadoTokenInstanceContract.methods.allowance(signerAddress, tornadoProxyAddress).call({ from: signerAddress });
    console.log('Current allowance is', fromWei(allowance));
    if (toBN(allowance).lt(toBN(tokenAmount))) {
      console.log('Approving tokens for deposit');
      await generateTransaction(tornTokenAddress, tornadoTokenInstanceContract.methods.approve(tornadoProxyAddress, tokenAmount).call(), 0, 'send')
    }

    console.log('Submitting deposit transaction');
    await generateTransaction(tornadoProxyAddress, tornadoProxyContract.methods.deposit(tornadoInstanceAddress, commitment, []).encodeABI());
    await printERC20Balance({ address: tornadoInstanceAddress, name: 'Tornado contract' });
    await printERC20Balance({ address: signerAddress, name: 'Sender account' });
  }

  if (!commitmentNote) {
    return noteString;
  }
}

/**
 * @typedef {Object} MerkleProof Use pregenerated merkle proof
 * @property {string} root Merkle tree root
 * @property {Array<number|string>} pathElements Number of hashes and hashes
 * @property {Array<number>} pathIndices Indicies
 */

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the tornado, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param {Object} deposit Deposit object
 * @param {string} currency Currency ticker, like 'ETH' or 'BNB'
 * @param {number} amount Tornado instance amount, like 0.1 (ETH or BNB) or 10
 * @return {Promise<MerkleProof>} Calculated valid merkle tree (proof)
 */
async function generateMerkleProof(deposit, currency, amount) {
  const { web3Instance, multiCallAddress, tornadoInstanceContract } = globals;

  // Get all deposit events from smart contract and assemble merkle tree from them
  const cachedEvents = await fetchEvents({ type: 'deposit', currency, amount });
  const { tree, leaves, root } = computeDepositEventsTree(cachedEvents);

  // Validate that merkle tree is valid, deposit data is correct and note not spent.
  const leafIndex = leaves.findIndex((commitment) => toBN(deposit.commitmentHex).toString(10) === commitment);
  let isValidRoot, isSpent;
  if (!multiCallAddress) {
    const callContract = await useMultiCall([
      [tornadoInstanceContract._address, tornadoInstanceContract.methods.isKnownRoot(toHex(root)).encodeABI()],
      [tornadoInstanceContract._address, tornadoInstanceContract.methods.isSpent(toHex(deposit.nullifierHash)).encodeABI()]
    ]);
    isValidRoot = web3Instance.abi.decodeParameter('bool', callContract[0]);
    isSpent = web3Instance.abi.decodeParameter('bool', callContract[1]);
  } else {
    isValidRoot = await tornadoInstanceContract.methods.isKnownRoot(toHex(root)).call();
    isSpent = await tornadoInstanceContract.methods.isSpent(toHex(deposit.nullifierHash)).call();
  }
  assert(isValidRoot === true, 'Merkle tree is corrupted');
  assert(isSpent === false, 'The note is already spent');
  assert(leafIndex >= 0, 'The deposit is not found in the tree');

  // Compute merkle proof of our commitment
  const { pathElements, pathIndices } = tree.path(leafIndex);
  return { root, pathElements, pathIndices };
}

/**
 * @typedef {Object} ProofData
 * @property {string} proof - ZK-SNARK proof
 * @property {Array<string>} args - Withdrawal transaction proofed arguments
 */

/**
 * Generate SNARK proof for withdrawal
 * @param {Object} args Arguments
 * @param {Object} args.deposit Deposit object
 * @param {string} args.recipient Funds recipient
 * @param {string | 0 } args.relayer Relayer address
 * @param {number} args.fee Relayer fee
 * @param {string} args.refund Receive ether for exchanged tokens
 * @param {MerkleProof} [args.merkleProof] Valid merkle tree proof
 * @returns {Promise<ProofData>} Proof data
 */
async function generateProof({ deposit, currency, amount, recipient, relayerAddress = 0, fee = 0, refund = 0, merkleProof }) {
  // Compute merkle proof of our commitment
  if (merkleProof === undefined)
    merkleProof = await generateMerkleProof(deposit, currency, amount);
  const { root, pathElements, pathIndices } = merkleProof;

  // Prepare circuit input
  const input =
  {
    // Public snark inputs
    root: root,
    nullifierHash: deposit.nullifierHash,
    recipient: bigInt(recipient),
    relayer: bigInt(relayerAddress),
    fee: bigInt(fee),
    refund: bigInt(refund),

    // Private snark inputs
    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements: pathElements,
    pathIndices: pathIndices
  };

  console.log('Generating SNARK proof');
  console.time('Proof time');
  // groth16 initialises a lot of Promises that will never be resolved, that's why we need to use process.exit to terminate the CLI
  const groth16 = await buildGroth16();
  const circuit = require('./circuits/tornado.json');
  const provingKey = fs.readFileSync('./circuits/tornadoProvingKey.bin').buffer;
  const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, provingKey);
  const { proof } = websnarkUtils.toSolidityInput(proofData);
  console.timeEnd('Proof time');

  const args = [
    toHex(input.root),
    toHex(input.nullifierHash),
    toHex(input.recipient, 20),
    toHex(input.relayer, 20),
    toHex(input.fee),
    toHex(input.refund)
  ];

  return { proof, args };
}

/**
 * Do an ETH withdrawal
 * @param noteString Note to withdraw
 * @param recipient Recipient address
 */
async function withdraw({ deposit, currency, amount, recipient, relayerURL, refund, privateKey }) {
  const { web3Instance, signerAddress, tornadoProxyAddress, requestOptions, feeOracle, tornadoInstanceAddress, tornadoProxyContract, netSymbol, netId, shouldPromptConfirmation } = globals;
  if (currency === netSymbol.toLowerCase() && refund && refund !== '0') {
    throw new Error('The ETH purchase is supposed to be 0 for ETH withdrawals');
  }

  if (!isNaN(Number(refund)))
    refund = toWei(refund, 'ether');
  else
    refund = toBN(await feeOracle.fetchRefundInETH(currency.toLowerCase()));

  if (!web3Utils.isAddress(recipient)) {
    throw new Error('Recipient address is not valid');
  }

  const depositInfo = await loadDepositData({ amount, currency, deposit });
  const allDeposits = loadCachedEvents({ type: "deposit", currency, amount });
  if ((depositInfo.leafIndex > allDeposits[allDeposits.length - 1].leafIndex - 10)
    && allDeposits.length > 10) {
    console.log("\nWARNING: you're trying to withdraw your deposit too early, there are not enough subsequent deposits to ensure good anonymity level. Read: https://docs.tornado.ws/general/guides/opsec.html");
    if (shouldPromptConfirmation)
      await promptConfirmation("Continue withdrawal with risks to anonymity? [Y/n]: ")
  }
  const withdrawInfo = await loadWithdrawalData({ amount, currency, deposit });
  if (withdrawInfo) {
    console.error("\nError: note has already been withdrawn. Use `compliance` command to check deposit and withdrawal info.\n");
    process.exit(1);
  }

  if (global.chainId !== 1 && (privateKey || globals.privateKey)) {
    // using private key

    // check if the address of recepient matches with the account of provided private key from environment to prevent accidental use of deposit address for withdrawal transaction.
    assert
      (
        recipient.toLowerCase() == signerAddress.toLowerCase(),
        'Withdrawal recepient mismatches with the account of provided private key from environment file'
      );
    const checkBalance = await web3Instance.getBalance(signerAddress);
    assert
      (
        checkBalance !== 0,
        'You have 0 balance, make sure to fund account by withdrawing from tornado using relayer first'
      );

    const { proof, args } = await generateProof({ deposit, currency, amount, recipient, refund });

    console.log('Submitting withdraw transaction');
    await generateTransaction
      (
        tornadoProxyAddress,
        tornadoProxyContract.methods.withdraw(tornadoInstanceAddress, proof, ...args).encodeABI(),
        toBN(args[5]),
        'user_withdrawal'
      );
  }
  else {
    let relayerInfo;
    if (relayerURL) {
      try {
        relayerURL = new URL(relayerURL).origin;
        res = await axios.get(relayerURL + '/status', requestOptions);
        relayerInfo = res.data;
      } catch (err) {
        console.error(err);
        throw new Error('Cannot get relayer status');
      }
    }
    else {
      const availableRelayers = await getRelayers(netId);
      if (availableRelayers.length === 0) throw new Error("Cannot automatically pick a relayer to withdraw your note. Provide relayer manually with `--relayer` cmd option or use private key withdrawal")
      relayerInfo = pickWeightedRandomRelayer(availableRelayers);
      relayerURL = "https://" + relayerInfo.hostname
      console.log(`Selected relayer: ${relayerURL}`)
    }



    const { rewardAccount, netId: relayerNetId, ethPrices, tornadoServiceFee } = relayerInfo;
    assert(relayerNetId === (await web3Instance.net.getId()) || relayerNetId === '*', 'This relay is for different network');
    console.log('Relay address:', rewardAccount);

    const decimals = config.deployments[`netId${netId}`]['tokens'][currency].decimals;

    const merkleWithdrawalProof = await generateMerkleProof(deposit, currency, amount);

    async function calculateDataForRelayer(totalRelayerFee = 0) {
      const { proof, args } = await generateProof({
        deposit,
        currency,
        amount,
        recipient,
        relayerAddress: rewardAccount,
        fee: toBN(totalRelayerFee),
        refund,
        merkleProof: merkleWithdrawalProof
      });
      return { proof, args };
    }

    const relayerFee = feeOracle.calculateRelayerFeeInWei(tornadoServiceFee, amount, decimals);
    const { proof: dummyProof, args: dummyArgs } = await calculateDataForRelayer(relayerFee);

    const withdrawalTxCalldata = tornadoProxyContract.methods.withdraw(tornadoProxyAddress, dummyProof, ...dummyArgs);
    const incompleteWithdrawalTx = {
      to: tornadoProxyAddress,
      data: withdrawalTxCalldata,
      value: toBN(dummyArgs[5]) || 0
    };

    const totalWithdrawalFeeViaRelayer = await feeOracle.calculateWithdrawalFeeViaRelayer({
      tx: incompleteWithdrawalTx,
      txType: 'user_withdrawal',
      relayerFeePercent: tornadoServiceFee,
      currency,
      amount,
      decimals,
      refund,
      tokenPriceInEth: ethPrices?.[currency]
    });

    const { proof, args } = await calculateDataForRelayer(totalWithdrawalFeeViaRelayer);

    console.log('Sending withdraw transaction through relay');

    /** Relayer fee details **/
    console.log('Relayer fee: ', rmDecimalBN(fromWei(toBN(relayerFee)), 12), `${currency.toUpperCase()}`);
    console.log('Total fees: ', rmDecimalBN(fromWei(toBN(totalWithdrawalFeeViaRelayer)), 12), `${currency.toUpperCase()}`);
    const toReceive = toBN(fromDecimals({ amount, decimals })).sub(toBN(totalWithdrawalFeeViaRelayer));
    console.log(
      'Amount to receive: ',
      rmDecimalBN(fromWei(toReceive), 12),
      `${currency.toUpperCase()}`,
      toBN(refund).gt(toBN(0)) ? ` + ${rmDecimalBN(fromWei(refund), 12)} ${netSymbol}` : ''
    );
    /** -------------------- **/

    if (globals.shouldPromptConfirmation) await promptConfirmation();

    try {
      const response = await axios.post(
        relayerURL + '/v1/tornadoWithdraw',
        {
          contract: tornadoInstanceAddress,
          proof,
          args
        },
        requestOptions
      );

      const { id } = response.data;

      const result = await getStatus(id, relayerURL, requestOptions);
      console.log('STATUS', result);
    } catch (e) {
      console.error(e.message);
    }
  }

  if (currency === netSymbol.toLowerCase()) {
    await printETHBalance({ address: recipient, name: 'Recipient' });
  }
  else {
    await printERC20Balance({ address: recipient, name: 'Recipient' });
  }
  console.log('Done withdrawal from Tornado Cash');
}

/**
 * Do an ETH / ERC20 send
 * @param address Recepient address
 * @param amount Amount to send
 * @param tokenAddress ERC20 token address
 */
async function send({ address, amount, tokenAddress }) {
  const { web3Instance, signerAddress, feeOracle, multiCallAddress, netSymbol, netId } = globals;

  // using private key
  assert(signerAddress != null, 'Error! Private key not found. Please provide PRIVATE_KEY in .env file if you send');
  if (tokenAddress) {
    const erc20Contract = new web3Instance.Contract(erc20Abi, tokenAddress);
    let tokenBalance, tokenDecimals, tokenSymbol;
    if (multiCallAddress) {
      const callToken = await useMultiCall([
        [tokenAddress, erc20Contract.methods.balanceOf(signerAddress).encodeABI()],
        [tokenAddress, erc20Contract.methods.decimals().encodeABI()],
        [tokenAddress, erc20Contract.methods.symbol().encodeABI()]
      ]);
      tokenBalance = new BigNumber(callToken[0]);
      tokenDecimals = parseInt(callToken[1]);
      tokenSymbol = web3Instance.abi.decodeParameter('string', callToken[2]);
    } else {
      tokenBalance = new BigNumber(await erc20Contract.methods.balanceOf(signerAddress).call());
      tokenDecimals = await erc20Contract.methods.decimals().call();
      tokenSymbol = await erc20Contract.methods.symbol().call();
    }
    const toSend = new BigNumber(amount).times(BigNumber(10).pow(tokenDecimals));
    if (tokenBalance.lt(toSend)) {
      console.error(
        'You have',
        rmDecimalBN(tokenBalance.div(BigNumber(10).pow(tokenDecimals))),
        tokenSymbol,
        ", you can't send more than you have"
      );
      process.exit(1);
    }
    const encodeTransfer = erc20Contract.methods.transfer(address, toSend).encodeABI();
    await generateTransaction(tokenAddress, encodeTransfer, 0, 'send');
    console.log('Sent', amount, tokenSymbol, 'to', address);
  } else {
    const balance = new BigNumber(await web3Instance.getBalance(signerAddress));
    assert(balance.toNumber() !== 0, "You have 0 balance, can't send transaction");
    let toSend = new BigNumber(0);
    if (amount) {
      toSend = new BigNumber(amount).times(BigNumber(10).pow(18));
      if (balance.lt(toSend)) {
        console.error(
          'You have',
          rmDecimalBN(balance.div(BigNumber(10).pow(18))),
          netSymbol + ", you can't send more than you have."
        );
        process.exit(1);
      }
    } else {
      console.log('Amount not defined, sending all available amounts');
      const gasPrice = new BigNumber(await feeOracle.getGasPrice('other'));
      const gasLimit = new BigNumber(21000);
      if (netId == 1) {
        const priorityFee = new BigNumber(await gasPrices(3));
        toSend = balance.minus(gasLimit.times(gasPrice.plus(priorityFee)));
      } else {
        toSend = balance.minus(gasLimit.times(gasPrice));
      }
    }
    await generateTransaction(address, null, toSend);
    console.log('Sent', rmDecimalBN(toSend.div(BigNumber(10).pow(18))), netSymbol, 'to', address);
  }
}

function getStatus(id, relayerURL, options) {
  return new Promise((resolve) => {
    async function getRelayerStatus() {
      const responseStatus = await axios.get(relayerURL + '/v1/jobs/' + id, options);

      if (responseStatus.status === 200) {
        const { txHash, status, confirmations, failedReason } = responseStatus.data;

        console.log(`Current job status ${status}, confirmations: ${confirmations}`);

        if (status === 'FAILED') {
          throw new Error(status + ' failed reason:' + failedReason);
        }

        if (status === 'CONFIRMED') {
          const receipt = await waitForTxReceipt({ txHash });
          console.log(
            `Transaction submitted through the relay. View transaction on block explorer https://${getExplorerLink()}/tx/${txHash}`
          );
          console.log('Transaction mined in block', receipt.blockNumber);
          resolve(status);
        }
      }

      setTimeout(() => {
        getRelayerStatus(id, relayerURL);
      }, 3000);
    }

    getRelayerStatus();
  });
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function fromDecimals({ amount, decimals }) {
  amount = amount.toString();
  let ether = amount.toString();
  const base = new BN('10').pow(new BN(decimals));
  const baseLength = base.toString(10).length - 1 || 1;

  const negative = ether.substring(0, 1) === '-';
  if (negative) {
    ether = ether.substring(1);
  }

  if (ether === '.') {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei, invalid value');
  }

  // Split it into a whole and fractional part
  const comps = ether.split('.');
  if (comps.length > 2) {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei,  too many decimal points');
  }

  let whole = comps[0];
  let fraction = comps[1];

  if (!whole) {
    whole = '0';
  }
  if (!fraction) {
    fraction = '0';
  }
  if (fraction.length > baseLength) {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei, too many decimal places');
  }

  while (fraction.length < baseLength) {
    fraction += '0';
  }

  whole = new BN(whole);
  fraction = new BN(fraction);
  let wei = whole.mul(base).add(fraction);

  if (negative) {
    wei = wei.mul(negative);
  }

  return new BN(wei.toString(10), 10);
}

function toDecimals(value, decimals, fixed) {
  const zero = new BN(0);
  const negative1 = new BN(-1);
  decimals = decimals || 18;
  fixed = fixed || 7;

  value = new BN(value);
  const negative = value.lt(zero);
  const base = new BN('10').pow(new BN(decimals));
  const baseLength = base.toString(10).length - 1 || 1;

  if (negative) {
    value = value.mul(negative1);
  }

  let fraction = value.mod(base).toString(10);
  while (fraction.length < baseLength) {
    fraction = `0${fraction}`;
  }
  fraction = fraction.match(/^([0-9]*[1-9]|0)(0*)/)[1];

  const whole = value.div(base).toString(10);
  value = `${whole}${fraction === '0' ? '' : `.${fraction}`}`;

  if (negative) {
    value = `-${value}`;
  }

  if (fixed) {
    value = value.slice(0, fixed);
  }

  return value;
}

// List fetched from https://github.com/ethereum-lists/chains/blob/master/_data/chains
function getExplorerLink() {
  switch (globals.netId) {
    case 61:
      return 'etc.blockscout.com';
    case 11155111:
      return 'sepolia.etherscan.io';
    case 56:
      return 'bscscan.com';
    case 100:
      return 'blockscout.com/poa/xdai';
    case 137:
      return 'polygonscan.com';
    case 42161:
      return 'arbiscan.io';
    case 43114:
      return 'snowtrace.io';
    case 5:
      return 'goerli.etherscan.io';
    case 42:
      return 'kovan.etherscan.io';
    case 10:
      return 'optimistic.etherscan.io';
    default:
      return 'etherscan.io';
  }
}

// List fetched from https://github.com/trustwallet/assets/tree/master/blockchains
function getCurrentNetworkName() {
  switch (globals.netId) {
    case 61:
      return 'EthereumClassic';
    case 11155111:
      return 'Sepolia';
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
    case 42:
      return 'Kovan';
    case 10:
      return 'Optimism';
    default:
      return 'Ethereum';
  }
}

/**
 * Get native currency symbol for selected chain
 * @param {number | string} chainId 
 * @returns {string} 
 */
function getCurrentNetworkSymbol(chainId) {
  switch (Number(chainId)) {
    case 61:
      return 'ETC';
    case 56:
      return 'BNB';
    case 100:
      return 'xDAI';
    case 137:
      return 'MATIC';
    case 43114:
      return 'AVAX';
    default:
      return 'ETH';
  }
}

/**
 * Waits for transaction to be mined
 * @param txHash Hash of transaction
 * @param attempts
 * @param delay
 */
async function waitForTxReceipt({ txHash, attempts = 60, delay = 1000 }) {
  let retryAttempt = 0;
  while (retryAttempt < attempts) {
    const result = await globals.web3Instance.getTransactionReceipt(txHash);
    if (!result?.blockNumber) {
      retryAttempt++;
      await sleep(delay);
      continue;
    }
    return result;
  }

  throw new Error(`Cannot get transaction receipt in ${attempts} retry attempts`);
}

/**
 * Select one of default RPCs that works correctly
 * @param {number | string} chainId
 * @param {EventType} eventType Possible type of events in Tornado: deposit, withdrawal or fetch relayers
 * @param {boolean} [isSubgraphAvailable=false] If subgraph for required user action is already available, we can lower requirements for RPC (for example, 
 * if we can fetch all deposit events from subgraph, we shouldn't require archive node)
 * @returns {Promise<string>} Full RPC link
 */
async function selectDefaultRpc(chainId, eventType, isSubgraphAvailable = false) {
  const candidates = config.deployments[`netId${chainId}`].defaultRpcs;

  for (const candidate of candidates) {
    const localWeb3 = await createWeb3Instance(candidate);

    try {
      if (!(await localWeb3.net.isListening())) throw new Error('Cannot connect to websocket provider');

      if (eventType === "relayer") {
        const relayerRegistryContract = new localWeb3.Contract(relayerRegistryAbi, relayerRegistryAddress);
        const registeredRelayers = loadCachedEvents({ type: "relayer" });

        if (registeredRelayers.length > 0) {
          const relayerAggregatorContract = new localWeb3.Contract(relayerAggregatorAbi, relayerAggregatorAddress);
          const relayerNameHashes = registeredRelayers.map(r => r.ensHash);
          // Here it checks RPC returndata size limit: when getRelayer function aggregates onchain data for all relayers, returndata size will be big
          await relayerAggregatorContract.methods.relayersData(relayerNameHashes, relayerSubdomains).call();
        }

        const lastBlock = await localWeb3.getBlockNumber();
        const lastCachedBlock = registeredRelayers.length > 0 ? registeredRelayers[registeredRelayers.length - 1].blockNumber : relayerRegistryDeployedBlockNumber;
        const fromBlock = isSubgraphAvailable ? lastBlock - 1000 : lastCachedBlock;
        const toBlock = isSubgraphAvailable ? lastBlock : lastCachedBlock + 1000;
        await relayerRegistryContract.getPastEvents("RelayerRegistered", { fromBlock, toBlock });
      }
      else if (eventType === "withdrawal") {
        const oldTransactionHash = config.deployments[`netId${chainId}`].firstDeploymentTransaction;
        const testReceipt = await localWeb3.getTransactionReceipt(oldTransactionHash);

        const netSymbol = getCurrentNetworkSymbol(chainId).toLowerCase();
        const [tornadoInstanceAmount, tornadoInstanceAddress] = Object.entries(config.deployments[`netId${chainId}`]['tokens'][netSymbol].instanceAddress)[0];;
        const instanceDeployedBlockNumber = config.deployments[`netId${chainId}`]['tokens'][netSymbol].deployedBlockNumber[tornadoInstanceAmount];
        const tornadoInstanceContract = new localWeb3.Contract(tornadoInstanceAbi, tornadoInstanceAddress);

        if (!testReceipt) throw new Error("RPC cannot get receipt of old transaction");
        const lastBlock = await localWeb3.getBlockNumber();
        const fromBlock = isSubgraphAvailable ? lastBlock - 1000 : instanceDeployedBlockNumber;
        const toBlock = isSubgraphAvailable ? lastBlock : instanceDeployedBlockNumber + 1000;
        await tornadoInstanceContract.getPastEvents("Deposit", { fromBlock, toBlock });
      }
      else await localWeb3.getBlockNumber();

      console.log("Selected RPC: " + candidate);
      return candidate;
    } catch (e) {
      console.log(e)
    }
  }

  throw new Error("All default RPC cannot be used, provide a working one");
}

/**
 * Select one of default subgraphs that works correctly
 * @param {number | string } chainId
 * @param {EventType} eventType Possible type of events in Tornado: deposit, withdrawal or fetch relayers
 * @returns {Promise<string>} Full subgraph link
 */
async function selectDefaultGraph(chainId, eventType) {
  let candidates = config.deployments[`netId${chainId}`].subgraphs;
  if (eventType === "relayer") {
    if (chainId != 1) throw new Error("Relayer subgraph is available only for mainnet");
    candidates = config.deployments[`netId${chainId}`].relayerSubgraphs;
    query = '{ relayers(first: 10) { address, ensName, ensHash, blockRegistration } }'
  }
  else if (eventType === "deposit") query = `{ deposits(first: 1, orderBy: timestamp) { blockNumber, index } }`;
  else query = `{ withdrawals(first: 1, orderBy: timestamp) { timestamp } }`

  for (const candidate of candidates) {
    try {
      const response = await axios.post(candidate, { query }, globals.requestOptions);
      const result = response.data.data[`${eventType}s`];
      if (!result) throw new Error("Invalid response from subgraph");
      console.log(`Selected subgraph for ${eventType}s - ${candidate}`);
      return candidate;
    } catch (e) {
      console.log(e)
    }
  }

  console.log(`There is no available subgraph for ${eventType}s`);
  return;
}

/**
 * Get available relayers data for selected chain
 * @param {string | number} chainId 
 * @returns {Promise<Array<Object>>} List of available relayers
 */
async function getRelayers(chainId) {
  console.log("Fetching relayers...");

  const MIN_STAKE_LISTED_BALANCE = '0X1B1AE4D6E2EF500000'; // 500 TORN
  const aggregator = new globals.relayerWeb3Instance.Contract(relayerAggregatorAbi, relayerAggregatorAddress);
  const ensSubdomainKey = config.deployments[`netId${chainId}`].ensSubdomainKey;

  function filterRelayers(acc, curr, ensSubdomainKey, relayer) {
    const subdomainIndex = relayerSubdomains.indexOf(ensSubdomainKey);
    const mainnetSubdomain = curr.records[0];
    const hostname = curr.records[subdomainIndex];
    const isHostWithProtocol = hostname.includes('http');

    const isOwner = relayer.address.toLowerCase() === curr.owner.toLowerCase();
    const hasMinBalance = new BigNumber(curr.balance).gte(MIN_STAKE_LISTED_BALANCE);

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
    const relayerNameHashes = relayers.map((r) => r.ensHash);
    const relayersData = await aggregator.methods.relayersData(relayerNameHashes, relayerSubdomains).call();
    const validRelayers = relayersData.reduce(
      (acc, curr, index) => filterRelayers(acc, curr, ensSubdomainKey, relayers[index]),
      []
    );
    return validRelayers;
  }

  async function getAvailableRelayersData(relayers) {
    let statuses = [];
    for (const relayer of relayers) {
      try {
        const res = await axios.get(`https://${relayer.hostname}/status`, globals.requestOptions);
        const statusData = res.data;
        if (statusData.rewardAccount && statusData.health.status == 'true') {
          statuses.push({
            ...relayer,
            ...statusData
          });
        }
      } catch (e) {
        // console.error(`Failed to fetch status for ${relayer.hostname}:`);
      }
    }

    return statuses;
  }

  const registeredRelayers = await fetchEvents({ type: "relayer" });
  // Some relayers can be unregistered and then registrered again
  const deduplicatedRelayers = registeredRelayers.filter((relayer, index, relayers) => index === relayers.findIndex(r => relayer.ensName === r.ensName));
  const validRelayers = await getValidRelayers(deduplicatedRelayers, ensSubdomainKey);
  const availableRelayersData = await getAvailableRelayersData(validRelayers);

  console.log(`Found ${availableRelayersData.length} available relayers`)

  return availableRelayersData;
}

/**
 * Select random relayer from provided list using formula from Tornado Cash docs: https://docs.tornado.ws/general/guides/relayer.html
 * @param {Array<Object>} relayers List of relayers
 * @returns {Object} One selected relayer
 */
function pickWeightedRandomRelayer(relayers) {
  function calculateScore({ stakeBalance, tornadoServiceFee }, minFee = 0.33, maxFee = 0.53) {
    if (tornadoServiceFee < minFee) {
      tornadoServiceFee = minFee
    } else if (tornadoServiceFee >= maxFee) {
      return new BigNumber(0)
    }
    const serviceFeeCoefficient = (tornadoServiceFee - minFee) ** 2
    const feeDiffCoefficient = 1 / (maxFee - minFee) ** 2
    const coefficientsMultiplier = 1 - feeDiffCoefficient * serviceFeeCoefficient

    return new BigNumber(stakeBalance).multipliedBy(coefficientsMultiplier)
  }

  function getWeightRandom(weightsScores, random) {
    for (let i = 0; i < weightsScores.length; i++) {
      if (random.isLessThan(weightsScores[i])) {
        return i
      }
      random = random.minus(weightsScores[i])
    }
    return Math.floor(Math.random() * weightsScores.length)
  }


  let minFee, maxFee

  if (globals.netId != 1) {
    minFee = 0.01
    maxFee = 0.3
  }

  const weightsScores = relayers.map((el) => calculateScore(el, minFee, maxFee))
  const totalWeight = weightsScores.reduce((acc, curr) => {
    return (acc = acc.plus(curr))
  }, new BigNumber('0'))

  const random = totalWeight.multipliedBy(Math.random())
  const weightRandomIndex = getWeightRandom(weightsScores, random)

  return relayers[weightRandomIndex]
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Send post request several times until successful response (200-300 https statuses) until the allowed number of attempts is used up
 * @param {string} url Post requets url
 * @param {Object} data Post request data
 * @param {RequestOptions} requestOptions Post request connection options (timeout, proxy)
 * @param {number} retryAttempts Retry attempts count, it limits the maximum number of requests
 * @param {number} waitingTimeIncrease In milliseconds. The waiting time is increased before each new attempt, (this value) * (current retry attempt number) 
 * @returns {Promise<any>} Axios reonse
 */
async function retryPostRequest(url, data, requestOptions, retryAttempts, waitingTimeIncrease = 2000) {
  let retryAttempt = 0;
  while (1) {
    await sleep(waitingTimeIncrease * retryAttempt);
    try {
      return await axios.post(url, data, requestOptions);
    } catch (e) {
      if (retryAttempt === retryAttempts) throw e;
      retryAttempt++;
    }
  }
}

/**
 * Get file path for cached events flile
 * @param {EventType} eventType Event type
 * @param {string} currency Tornado instance currency symbol
 * @param {number | string} amount Tornado instance currency amount
 * @returns {string} Path to cache file
 */
function getEventsFilePath(eventType, currency, amount) {
  return eventType === "relayer" ? "./cache/relayer/register.json" : `./cache/${globals.netName.toLowerCase()}/${eventType}s_${currency.toLowerCase()}_${amount}.json`;
}

/**
 * Load events from cache file
 * @param {Object} args
 * @param {EventType} args.type Event type
 * @param {string} args.currency Tornado instance currency symbol
 * @param {string | number} amount Tornado instance currency amount
 * @returns {Array} Cached events
 */
function loadCachedEvents({ type, currency, amount }) {
  try {
    const events = JSON.parse(fs.readFileSync(getEventsFilePath(type, currency, amount)));

    if (!events || events.length === 0) throw new Error("Invalid cached events file")
    return events;
  } catch (err) {
    console.log(`Error fetching cached ${type} events from file`);
    return [];
  }
}

/**
 * Update cache for events of selected type (currency and amount also, if applicable) to actual blockchain state
 * @param {Object} args 
 * @param {EventType} args.type Events type
 * @param {string} [args.currency] Currency to select Tornado pool instance from which it should fetch events (for deposits and withdrawals)
 * @param {number} [args.amount] Amount to select Tornado pool instance from which it should fetch events (for deposits and withdrawals)
 * @returns {Promise<Array<Object>>} All events (cached and newly fetched)
 */
async function fetchEvents({ type, currency, amount }) {
  if (currency) currency = currency.toLowerCase();
  if (type === 'withdraw') {
    type = 'withdrawal';
  }

  const { netName, netId, instanceDeployedBlockNumber, useOnlyRpc, tornadoInstanceContract } = globals;
  const web3Instance = type === 'relayer' ? globals.relayerWeb3Instance : globals.web3Instance;
  const subgraph = useOnlyRpc ? null : await selectDefaultGraph(type === 'relayer' ? 1 : netId, type);

  const cachedEvents = loadCachedEvents({ type, currency, amount });
  const startBlock = cachedEvents.length ? cachedEvents[cachedEvents.length - 1].blockNumber + 1 : (type === "relayer" ? relayerRegistryDeployedBlockNumber : instanceDeployedBlockNumber);

  if (type !== "relayer") {
    console.log('Loaded cached', amount, currency.toUpperCase(), type, 'events for', startBlock, 'block');
    console.log('Fetching', amount, currency.toUpperCase(), type, 'events for', netName, 'network');
  }

  /**
   * Updates local events cache file for one Tornado cash instance, for example, deposit events for 1 ETH pool
   * @param {Array<Object>} fetchedEvents Array of new events fetched from RPC or Graph
   */
  async function updateCache(fetchedEvents) {
    if (type === 'deposit') fetchedEvents.sort((firstLeaf, secondLeaf) => firstLeaf.leafIndex - secondLeaf.leafIndex);
    if (type === 'relayer') fetchedEvents.sort((first, second) => first.blockRegistration - second.blockRegistration);

    try {
      const cachedEvents = loadCachedEvents({ type, currency, amount });
      const events = cachedEvents.concat(fetchedEvents);
      fs.writeFileSync(getEventsFilePath(type, currency, amount), JSON.stringify(events, null, 2), { flag: 'w+', encoding: 'utf-8' });
    } catch (error) {
      console.log(error)
      throw new Error('Writing cache file failed:', error);
    }
  }

  async function syncEvents() {
    try {
      const targetBlock = await web3Instance.getBlockNumber();
      const chunks = 1000;
      const contract = type === "relayer" ? new web3Instance.Contract(relayerRegistryAbi, relayerRegistryAddress) : tornadoInstanceContract;
      const eventNameInContract = type === "relayer" ? "RelayerRegistered" : capitalizeFirstLetter(type);
      console.log('Querying latest events from RPC');

      for (let i = startBlock; i < targetBlock; i += chunks) {
        let mapFunction;
        if (type === "relayer")
          mapFunction = ({ blockNumber, returnValues: { relayer, relayerAddress, ensName } }) => ({ blockNumber, ensHash: relayer, ensName, address: relayerAddress });
        else if (type === "deposit")
          mapFunction = ({ blockNumber, transactionHash, returnValues: { commitment, leafIndex, timestamp } }) =>
            ({ blockNumber, transactionHash, commitment, leafIndex: Number(leafIndex), timestamp: Number(timestamp) });
        else mapFunction = ({ blockNumber, transactionHash, returnValues: { nullifierHash, to, fee } }) => ({ blockNumber, transactionHash, nullifierHash, to, fee });

        const finalBlock = Math.min(i + chunks - 1, targetBlock);
        try {
          const fetchedEvents = await contract.getPastEvents(eventNameInContract, { fromBlock: i, toBlock: finalBlock });
          console.log('Fetched', type === "relayer" ? type : `${amount} ${currency.toUpperCase()} ${type}`, 'events to block:', finalBlock);
          if (fetchedEvents.length === 0) continue;
          await updateCache(fetchedEvents.map(mapFunction));
        } catch (err) {
          console.error(`Failed fetching ${type} events from node on block ${i}: `, err)
          process.exit(1);
        }
      }
    } catch (error) {
      console.log(error);
      throw new Error('Error while updating cache');
    }
  }

  async function syncGraphEvents() {

    /**
     * Query events from graph (1000 events for a time maximum)
     * @param {number} blockNumber Block number in blockchain, from which it will fetch events
     * @param {('' | 'gt')} filter If "_gt", it fetches 1000 events with blockNumber greater then provided, if empty, it fetches events only with provided blockNumber
     * @returns {Promise<Array>}
     */
    async function queryFromGraph(blockNumber, filter = "_gt") {
      try {
        const variables = type === 'relayer' ? { blockRegistration: blockNumber } : {
          currency: currency.toString().toLowerCase(),
          amount: amount.toString().toLowerCase(),
          blockNumber
        };

        let query, mapFunction;
        if (type === 'relayer') {
          query = `
            query($blockRegistration: Int){
              relayers(orderBy: blockRegistration, first: 1000, where: {blockRegistration${filter}: $blockRegistration}) {
                address, ensName, ensHash, blockRegistration
              }
            }`;
          mapFunction = ({ blockRegistration, address, ensName, ensHash }) => ({ address, ensHash, ensName, blockNumber: Number(blockRegistration) });
        }
        else if (type === 'deposit') {
          query = `
            query($currency: String, $amount: String, $blockNumber: Int){
              deposits(orderBy: blockNumber, first: 1000, where: {currency: $currency, amount: $amount, blockNumber${filter}: $blockNumber}) {
                blockNumber, transactionHash, commitment, index
              }
            }`;
          mapFunction = ({ blockNumber, transactionHash, commitment, index }) => ({ blockNumber: Number(blockNumber), transactionHash, commitment, leafIndex: Number(index) });
        }
        else if (type === "withdrawal") {
          query = `
            query($currency: String, $amount: String, $blockNumber: Int){
              withdrawals(orderBy: blockNumber, first: 1000, where: {currency: $currency, amount: $amount, blockNumber${filter}: $blockNumber}) {
                blockNumber, transactionHash, nullifier, to, fee
              }
            }`;
          mapFunction = ({ blockNumber, transactionHash, nullifier, to, fee }) => ({ blockNumber: Number(blockNumber), transactionHash, nullifierHash: nullifier, to, fee });
        }

        const querySubgraph = await retryPostRequest(subgraph, { query, variables }, globals.requestOptions, 3);
        const queryResult = querySubgraph.data.data[`${type}s`];
        return queryResult.map(mapFunction);
      } catch (error) {
        console.error(error);
      }
    }

    async function fetchGraphEvents() {
      console.log('Querying latest events from subgraph');
      const latestBlock = await web3Instance.getBlockNumber();
      try {
        for (let i = startBlock; i < latestBlock;) {
          let result = await queryFromGraph(i);
          if (Object.keys(result).length === 0) break;
          const resultBlockNumber = result[result.length - 1].blockNumber;
          while (result.length > 0 && result[result.length - 1].blockNumber === resultBlockNumber) result.pop();
          result = result.concat(await queryFromGraph(resultBlockNumber, ""));
          await updateCache(result);
          i = resultBlockNumber;
          console.log('Fetched', type === 'relayer' ? type : `${amount} ${currency.toUpperCase()} ${type}`, 'events to block:', Number(resultBlockNumber));
        }
      } catch {
        console.log('Fallback to web3 events');
        await syncEvents();
      }
    }
    await fetchGraphEvents();
  }
  if (subgraph && !useOnlyRpc) {
    await syncGraphEvents();
  } else {
    await syncEvents();
  }

  const updatedEvents = loadCachedEvents({ type, currency, amount })
  const updatedBlock = updatedEvents[updatedEvents.length - 1].blockNumber;
  console.log('Cache updated for Tornado', type === 'relayer' ? type : `${amount} ${currency.toUpperCase()} instance to block`, updatedBlock, 'successfully');
  console.log(`Total ${type}s:`, updatedEvents.length - 1);
  return updatedEvents;
}

/**
 * Parses Tornado Cash note
 * @param {string} noteString the note
 */
function parseNote(noteString) {
  const noteRegex = /tornado-(?<currency>\w+)-(?<amount>[\d.]+)-(?<netId>\d+)-0x(?<note>[0-9a-fA-F]{124})/g;
  const match = noteRegex.exec(noteString);
  if (!match) {
    throw new Error('The note has invalid format');
  }

  const buf = Buffer.from(match.groups.note, 'hex');
  const nullifier = bigInt.leBuff2int(buf.slice(0, 31));
  const secret = bigInt.leBuff2int(buf.slice(31, 62));
  const deposit = createDeposit({ nullifier, secret });
  const netId = Number(match.groups.netId);

  return {
    currency: match.groups.currency,
    amount: match.groups.amount,
    netId,
    deposit
  };
}

/**
 * Parses Tornado Cash deposit invoice
 * @param invoiceString the note
 */
function parseInvoice(invoiceString) {
  const noteRegex = /tornadoInvoice-(?<currency>\w+)-(?<amount>[\d.]+)-(?<netId>\d+)-0x(?<commitmentNote>[0-9a-fA-F]{64})/g;
  const match = noteRegex.exec(invoiceString);
  if (!match) {
    throw new Error('The invoice has invalid format');
  }

  const netId = Number(match.groups.netId);
  const buf = Buffer.from(match.groups.commitmentNote, 'hex');
  const commitmentNote = toHex(buf.slice(0, 32));

  return {
    currency: match.groups.currency,
    amount: match.groups.amount,
    netId,
    commitmentNote
  };
}

async function loadDepositData({ amount, currency, deposit }) {
  const { web3Instance, tornadoInstanceContract } = globals;
  const cachedEvents = await fetchEvents({ type: 'deposit', currency, amount });
  const depositEvent = cachedEvents.find(event => event.commitment === deposit.commitmentHex);
  if (!depositEvent) throw new Error('There is no related deposit, the note is invalid');

  const { timestamp } = await web3Instance.getBlock(depositEvent.blockNumber);
  const txHash = depositEvent.transactionHash;
  const isSpent = await tornadoInstanceContract.methods.isSpent(deposit.nullifierHex).call();
  const receipt = await web3Instance.getTransactionReceipt(txHash);

  return {
    timestamp,
    txHash,
    isSpent,
    leafIndex: depositEvent.leafIndex,
    from: receipt.from,
    commitment: deposit.commitmentHex
  };
}
async function loadWithdrawalData({ amount, currency, deposit }) {
  const { netId, web3Instance } = globals;

  try {
    const cachedEvents = await fetchEvents({ type: 'withdrawal', currency, amount });

    const withdrawEvent = cachedEvents.filter((event) => {
      return event.nullifierHash === deposit.nullifierHex;
    })[0];

    if (!withdrawEvent) return null;

    const fee = withdrawEvent.fee;
    const decimals = config.deployments[`netId${netId}`]['tokens'][currency].decimals;
    const withdrawalAmount = toBN(fromDecimals({ amount, decimals })).sub(toBN(fee));
    const { timestamp } = await web3Instance.getBlock(withdrawEvent.blockNumber);
    return {
      amount: toDecimals(withdrawalAmount, decimals, 9),
      txHash: withdrawEvent.transactionHash,
      to: withdrawEvent.to,
      timestamp,
      nullifier: deposit.nullifierHex,
      fee: toDecimals(fee, decimals, 9)
    };
  } catch (e) {
    console.error('loadWithdrawalData', e);
  }
}

async function promptConfirmation(query) {
  query = query || 'Confirm the transaction [Y/n] ';
  const confirmation = await new Promise((resolve) => prompt.question(query, resolve));

  if (confirmation.toUpperCase() !== 'Y' && confirmation.toLowerCase() !== "yes") {
    console.error('User rejected this action');
    process.exit(1);
  }
}

/**
 * Stake TORN tokens in Governance contract to earn rewards from withdrawals and perticate in Governance with voting
 * @param {number | string} amount Amount of tokens. Can be fractional, for example stake 100.8432 TORN
 */
async function stakeTorn(amount) {
  const { tornTokenContract, governanceContract, signerAddress } = globals;
  const tokenAmount = fromDecimals({ amount, decimals: 18 });
  const allowance = await tornTokenContract.methods.allowance(signerAddress, governanceAddress).call();
  console.log('Current TORN allowance is', fromWei(allowance));
  if (toBN(allowance).lt(toBN(tokenAmount))) {
    console.log('Approving tokens for stake');
    await generateTransaction(tornTokenAddress, tornTokenContract.methods.approve(governanceAddress, tokenAmount).encodeABI(), 0, 'send');
  }
  console.log("Sending stake transaction...");
  await generateTransaction(governanceAddress, governanceContract.methods.lockWithApproval(tokenAmount).encodeABI(), 0, 'send');

  const stakedAmount = await governanceContract.methods.lockedBalance(signerAddress).call();
  console.log("Staked successfull: your current stake balance is", fromWei(stakedAmount), "TORN");
}

/**
 * Withdraw TORN tokens from Governance staking (without rewards)
 * @param {number | string} amount Amount of TORn tokens to withdraw, can be fractional
 */
async function unstakeTorn(amount) {
  const { governanceContract, signerAddress } = globals;
  const tokenAmount = fromDecimals({ amount, decimals: 18 });
  const stakedAmount = await governanceContract.methods.lockedBalance(signerAddress).call();
  if (toBN(stakedAmount).lt(toBN(tokenAmount))) throw new Error(`Not enough tokens in stake. You have ${fromWei(stakedAmount)} tokens, but you're trying to withdraw ${amount}.`);

  console.log("Sending unstake transaction...");
  await generateTransaction(governanceAddress, governanceContract.methods.unlock(tokenAmount).encodeABI(), 0, 'send');
}

/**
 * Delegate voting power in Tornado Cash governance to another address: delegatee can vote and create proposals on your behalf
 * @param {string} address Delegatee address
 */
async function delegate(address) {
  if (!web3Utils.isAddress(address)) throw new Error("Cannot delegate: invalid delegatee address provided");

  await generateTransaction(governanceAddress, globals.governanceContract.methods.delegate(address).encodeABI(), 0, 'send');
}

/**
 * Remove Tornado Cash governance delegation. After doing it, nobody can vote or create proposals on your behalf
 */
async function undelegate() {
  const { governanceContract, signerAddress } = globals;
  const currentDelegatee = await governanceContract.methods.delegatedTo(signerAddress).call();
  if (currentDelegatee.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    console.log("No actual delegatee: already undelegated");
    return;
  }

  await generateTransaction(governanceAddress, governanceContract.methods.undelegate().encodeABI(), 0, 'send');
}

/**
 * Loads actual data from contract and prints information about Tornado Cash staking for specified address: stake amount, unclaimed staking rewards and voting power delegation
 * @param {string} address 
 */
async function printStakeInfo(address) {
  if (!web3Utils.isAddress(address)) throw new Error("Cannot check stake info: invalid address provided");

  const { governanceContract, stakingRewardsContract } = globals;

  const stakedAmount = await governanceContract.methods.lockedBalance(address).call();
  const rewardsAmount = await stakingRewardsContract.methods.checkReward(address).call();
  const delegatee = await governanceContract.methods.delegatedTo(address).call();

  console.log('\n====================Staking info====================');
  console.log('Account :', address);
  console.log('Staked balance :', `${fromWei(stakedAmount)} TORN`);
  console.log('Unclaimed rewards :', `${fromWei(rewardsAmount)} TORN`);
  console.log('Delegation status :', delegatee.toLowerCase() === "0x0000000000000000000000000000000000000000" ? "not delegated" : `voting power delegated to ${delegatee}`);
  console.log('====================================================', '\n');
}

/**
 * Vote in governance from signer address with all staked tokens for or against specified proposal by ID
 * @param {string | number} proposalId Proposal ID
 * @param {string} decision For or against proposal ("yes" is for, "no" is against, true is for, false is against)
 */
async function vote(proposalId, decision){
  const { governanceContract, signerAddress } = globals;

  const signerStakedBalance = await governanceContract.methods.lockedBalance(signerAddress).call();
  if (signerStakedBalance.lte(0)) throw new Error("You have no staked balance, therefore you cannot vote.");

  let support;
  if (decision === "yes" || decision === "for") support = true;
  else if (decision === "no" || decision === "against") support = false;
  else throw new Error("Invalid user decision: cannot vote for or against proposal");


  await generateTransaction(governanceAddress, governanceContract.methods.castVote(Number(proposalId), support).encodeABI(), 0, 'send');
}

/**
 * Initiate transaction to claim staking rewards from Tornado Cash staking
 */
async function claimStakingRewards(){
  await generateTransaction(stakingRewardsAddress, globals.stakingRewardsContract.methods.getReward().encodeABI(), 0, 'send');
}

/**
 * Create web3 eth instance with provider using RPC link
 * @param {string} rpc Full RPC link
 * @returns {Promise<Web3Eth>} Initialized Web3 instance object
 */
async function createWeb3Instance(rpc) {
  const { torPort } = globals;

  let web3;
  if (torPort && rpc.startsWith('https')) {
    web3Options = { agent: { https: new SocksProxyAgent('socks5h://127.0.0.1:' + torPort) }, timeout: 20000 };
    web3 = new Web3(new Web3.providers.HttpProvider(rpc, web3Options), null, { transactionConfirmationBlocks: 1 });
  } else if (torPort && rpc.startsWith('http')) {
    web3Options = { agent: { http: new SocksProxyAgent('socks5h://127.0.0.1:' + torPort) }, timeout: 20000 };
    web3 = new Web3(new Web3.providers.HttpProvider(rpc, web3Options), null, { transactionConfirmationBlocks: 1 });
  } else if (rpc.includes('ipc')) {
    console.log('Using ipc connection');
    web3 = new Web3(new Web3.providers.IpcProvider(rpc, {}), null, { transactionConfirmationBlocks: 1 });
  } else if (rpc.startsWith('ws') || rpc.startsWith('wss')) {
    console.log('Using websocket connection (Note: Tor is not supported for Websocket providers)');
    web3Options = {
      clientConfig: { keepalive: true, keepaliveInterval: -1 },
      reconnect: { auto: true, delay: 1000, maxAttempts: 10, onTimeout: false }
    };
    web3 = new Web3(new Web3.providers.WebsocketProvider(rpc, web3Options), null, { transactionConfirmationBlocks: 1 });
  } else {
    console.log(`Connecting to remote node ${rpc}`);
    web3 = new Web3(new Web3.providers.HttpProvider(rpc, { timeout: 10000, keepAlive: true }), null, { transactionConfirmationBlocks: 1 });
  }

  return web3.eth;
}

/**
 * Initialize TORN contracts and then call initNetwork
 * @param {Object} args Arguments to pass to initNetwork function
 */
async function initTorn(args) {
  initPreferences(args);
  await initNetwork({ ...args, chainId: 1, onlyRpc: true });
  const { web3Instance } = globals;

  globals.governanceContract = new web3Instance.Contract(tornadoGovernanceAbi, governanceAddress);
  globals.tornTokenContract = new web3Instance.Contract(erc20Abi, tornTokenAddress);
  globals.stakingRewardsContract = new web3Instance.Contract(stakingRewardsAbi, stakingRewardsAddress);
}

/**
 * Init web3 network from user parameters for all program
 * @param {Object} args Arguments
 * @param {string} [args.rpc] Full link to RPC node
 * @param {number} [args.chainId] Chain ID (1 - ETH, 56 - BSC etc)
 * @param {string} [args.privateKey] Private key from user account (64 symbols or 66 if starts from 0x)
 * @param {string | number} [args.torPort] Port for Tor proxy, if user want to use it
 * @param {boolean} [args.onlyRpc] Use only RPC without other network requests
 * @param {EventType} [args.eventType] Applicable event type for user actions
 * @param {string} [relayer] User-provided relayer link
 */
async function initNetwork({ rpc, chainId, privateKey, torPort, onlyRpc, eventType, relayer }) {

  if (torPort) {
    globals.torPort = torPort;
    globals.requestOptions = {
      ...globals.requestOptions,
      httpsAgent: new SocksProxyAgent('socks5h://127.0.0.1:' + torPort),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0' }
    };
  }

  if (chainId && !rpc) {
    const subgraphUrl = onlyRpc ? null : await selectDefaultGraph(chainId, eventType)
    rpc = await selectDefaultRpc(chainId, eventType, !!subgraphUrl)
  }

  globals.web3Instance = await createWeb3Instance(rpc)
  globals.netId = await globals.web3Instance.getChainId()
  globals.netName = getCurrentNetworkName();
  globals.netSymbol = getCurrentNetworkSymbol(globals.netId);

  globals.feeOracle = Number(globals.netId) === 1 ? new TornadoFeeOracleV4(globals.netId, rpc) : new TornadoFeeOracleV5(globals.netId, rpc);

  // Create web3 instance to fetch relayer on mainnet, if user want to get relayers list or withdraw, but he didn't provide relayer link
  if (!relayer && !privateKey && (eventType === 'relayer' || eventType === 'withdrawal')) {
    if (globals.netId === 1) globals.relayerWeb3Instance = globals.web3Instance;
    else {
      const subgraphUrl = onlyRpc ? null : await selectDefaultGraph(1, 'relayer');
      const relayerRPC = await selectDefaultRpc(1, 'relayer', subgraphUrl);
      globals.relayerWeb3Instance = await createWeb3Instance(relayerRPC);
    }
  }

  const rpcHost = new URL(rpc).hostname;
  const isIpPrivate = is_ip_private(rpcHost);

  if (isIpPrivate || rpc.includes('localhost') || onlyRpc) {
    console.log('Only RPC mode');
    globals.useOnlyRpc = true;
  }

  if (!globals.useOnlyRpc) {
    try {
      const htmlIPInfo = await axios.get('https://check.torproject.org', globals.requestOptions);
      const ip = htmlIPInfo.data.split('Your IP address appears to be:  <strong>').pop().split('</')[0];
      console.log('Your remote IP address is', ip);
    } catch (error) {
      console.error('Could not fetch remote IP from check.torproject.org, use VPN if the problem repeats.');
    }
  }

  const privKey = privateKey || process.env.PRIVATE_KEY;
  if (privKey) globals.privateKey = privKey.startsWith("0x") ? privKey.substring(2) : privKey;

  if (globals.privateKey) {
    const account = globals.web3Instance.accounts.privateKeyToAccount('0x' + globals.privateKey);
    globals.web3Instance.accounts.wallet.add('0x' + globals.privateKey);
    globals.web3Instance.defaultAccount = account.address;
    globals.signerAddress = account.address;
  }
}

/**
 * Set user preferences in global program options object
 * @param {Object} userPreferences
 * @param {boolean} [userPreferences.nonconfirmation] Don't ask for confirmation for crucial actions
 * @param {boolean} [userPreferences.localMode] Don't submit signed transactions to blockchain (remote nodes)
 */
function initPreferences({ nonconfirmation, localMode }) {
  if (nonconfirmation) {
    console.log("Non-confirmation mode detected: program won't ask confirmation for crucial actions")
    globals.shouldPromptConfirmation = false;
  }
  if (localMode) {
    console.log("Local mode detected: program won't submit signed TX to remote node");
    globals.shouldSubmitTx = false;
  }
}

/**
 * Init web3, all Tornado contracts, and snark
 */
async function init({ rpc, chainId, currency = 'dai', amount = '100', privateKey, torPort, onlyRpc, nonconfirmation, localMode, eventType, relayer }) {
  currency = currency.toLowerCase()

  initPreferences({ nonconfirmation, localMode });
  await initNetwork({ rpc, chainId, privateKey, torPort, onlyRpc, eventType, relayer });

  const { netId, web3Instance } = globals;
  // console.log(netId, chainId);
  if (chainId && Number(chainId) !== netId) {
    throw new Error('This note is for a different network. Specify the --rpc option explicitly');
  }

  try {
    globals.tornadoProxyAddress = config.deployments[`netId${netId}`].proxy;
    globals.multiCallAddress = config.deployments[`netId${netId}`].multicall;
    globals.tornadoInstanceAddress = config.deployments[`netId${netId}`]['tokens'][currency].instanceAddress[amount];
    globals.instanceDeployedBlockNumber = config.deployments[`netId${netId}`]['tokens'][currency].deployedBlockNumber[amount];

    if (!globals.tornadoProxyAddress) {
      throw new Error("No Tornado Proxy for selected chain, did you provide correct chain id?");
    }
    globals.instanceTokenAddress =
      currency !== globals.netSymbol.toLowerCase() ? config.deployments[`netId${netId}`]['tokens'][currency].tokenAddress : null;
  } catch (e) {
    console.error('There is no such tornado instance, check the currency and amount you provide', e);
    process.exit(1);
  }
  globals.tornadoProxyContract = new web3Instance.Contract(tornadoProxyAbi, globals.tornadoProxyAddress);
  globals.tornadoInstanceContract = new web3Instance.Contract(tornadoInstanceAbi, globals.tornadoInstanceAddress);
  globals.tornadoTokenInstanceContract = currency !== globals.netSymbol.toLowerCase() ? new web3Instance.Contract(erc20Abi, globals.instanceTokenAddress) : null;
}

async function main() {
  program
    .option('-r, --rpc <URL>', 'The RPC that CLI should interact with')
    .option('-R, --relayer <URL>', 'Withdraw via relayer')
    .option('-T, --tor-port <PORT>', 'Optional tor port')
    .option('-p, --private-key <KEY>', "Wallet private key - If you didn't add it to .env file and it is needed for operation")
    .option('-N --noconfirmation', 'No confirmation mode - Does not query confirmation ')
    .option('-L, --local-mode', 'Local node mode - Does not submit signed transaction to the node')
    .option('-o, --only-rpc', 'Only rpc mode - Does not enable subgraph api nor remote ip detection');
  program
    .command('deposit <currency> <amount> [chain_id]')
    .description(
      'Submit a deposit of specified currency and amount from default eth account and return the resulting note. The currency is one of (ETH|DAI|cDAI|USDC|cUSDC|USDT). The amount depends on currency, see config.js file or visit https://tornadocash.eth.link.'
    )
    .action(async (currency, amount, chainId) => {
      await init({ ...program, currency, amount, eventType: 'deposit', chainId });
      await deposit({ currency, amount });
    });
  program
    .command('withdraw <note> <recipient> [ETH_purchase]')
    .description(
      'Withdraw a note to a recipient account using relayer or specified private key. You can exchange some of your deposit`s tokens to ETH during the withdrawal by specifing ETH_purchase (e.g. 0.01) to pay for gas in future transactions. Also see the --relayer option.'
    )
    .action(async (noteString, recipient, refund) => {
      const { currency, amount, netId, deposit } = parseNote(noteString);

      await init({ ...program, chainId: netId, currency, amount, eventType: 'withdrawal' });

      await withdraw({
        deposit,
        currency,
        amount,
        recipient,
        refund,
        privateKey: program.privateKey,
        relayerURL: program.relayer
      });
    });
  program
    .command('compliance <note>')
    .description(
      'Shows the deposit and withdrawal of the provided note. This might be necessary to show the origin of assets held in your withdrawal address.'
    )
    .action(async (noteString) => {

      const { currency, amount, netId, deposit } = parseNote(noteString);

      await init({ ...program, chainId: netId, currency, amount, eventType: 'withdrawal', relayer: "dummy" });

      const depositInfo = await loadDepositData({ amount, currency, deposit });
      const withdrawInfo = await loadWithdrawalData({ amount, currency, deposit });

      const depositDate = new Date(depositInfo.timestamp * 1000);
      console.log('\n=============Deposit=================');
      console.log('Deposit     :', amount, currency.toUpperCase());
      console.log('Date        :', depositDate.toLocaleDateString(), depositDate.toLocaleTimeString());
      console.log('From        :', `https://${getExplorerLink()}/address/${depositInfo.from}`);
      console.log('Transaction :', `https://${getExplorerLink()}/tx/${depositInfo.txHash}`);
      console.log('Commitment  :', depositInfo.commitment);
      console.log('Spent       :', depositInfo.isSpent);
      console.log('=====================================', '\n');

      if (!depositInfo.isSpent) {
        console.log('The note was not spent!');
        return;
      }

      const withdrawalDate = new Date(withdrawInfo.timestamp * 1000);
      console.log('\n=============Withdrawal==============');
      console.log('Withdrawal  :', withdrawInfo.amount, currency);
      console.log('Relayer Fee :', withdrawInfo.fee, currency);
      console.log('Date        :', withdrawalDate.toLocaleDateString(), withdrawalDate.toLocaleTimeString());
      console.log('To          :', `https://${getExplorerLink()}/address/${withdrawInfo.to}`);
      console.log('Transaction :', `https://${getExplorerLink()}/tx/${withdrawInfo.txHash}`);
      console.log('Nullifier   :', withdrawInfo.nullifier);
      console.log('=====================================', '\n');
    });
  program
    .command("stake <amount>")
    .description("Stake TORN tokens in Governance contract to earn rewards and vote. Requires private key")
    .action(async (amount) => {
      await initTorn(program);
      await stakeTorn(Number(amount));
    })
  program
    .command("unstake <amount>")
    .description("Unstake TORN tokens (withdraw from Governance staking). Requires private key")
    .action(async (amount) => {
      await initTorn(program);
      await unstakeTorn(amount);
    })
  program
    .command("checkStake <address>")
    .description("Check Tornado Cash staking information about provided address: stake amount, unclaimed staking rewards and voting power delegation")
    .action(async (address) => {
      await initTorn(program);
      await printStakeInfo(address);
    });
  program
    .command("claim")
    .description("Claim staking rewards. Requires private key")
    .action(async () => {
      await initTorn(program);
      await claimStakingRewards();
    })
  program
    .command("vote <decision> <proposal_id>")
    .description("Vote for or against Tornado Cash governance proposal with all staked tokens. Decision can be `yes/for` or `no/against`. To change your vote, just use this function again with different decision")
    .action(async (decision, proposalId) => {
      await initTorn(program);
      await vote(proposalId, decision.toLowerCase())
    })
  program
    .command("delegate <address>")
    .description("Delegate voting power to another address. Requires private key")
    .action(async (address) => {
      await initTorn(program);
      await delegate(address);
    });
  program
    .command("undelegate")
    .description("Remove current delegatee (nobody can vote or create proposals on your behalf after it). Requires private key")
    .action(async () => {
      await initTorn(program);
      await undelegate();
    });
  program
    .command('createNote <currency> <amount> <chainId>')
    .description(
      'Create deposit note and invoice, allows generating private key like deposit notes from secure, offline environment. The currency is one of (ETH|DAI|cDAI|USDC|cUSDC|USDT). The amount depends on currency, see config.js file or visit https://tornadocash.eth.link.'
    )
    .action(async (currency, amount, chainId) => {
      currency = currency.toLowerCase();
      await createInvoice({ currency, amount, chainId });
    });
  program
    .command('depositInvoice <invoice>')
    .description('Submit a deposit of invoice from default eth account and return the resulting note.')
    .action(async (invoice) => {

      const { currency, amount, netId, commitmentNote } = parseInvoice(invoice);
      await init({
        ...program,
        currency,
        amount,
        chainId: netId,
        eventType: 'deposit'
      });
      console.log('Creating', currency.toUpperCase(), amount, 'deposit for', globals.netName, 'Tornado Cash Instance');
      await deposit({ currency, amount, commitmentNote });
    });
  program
    .command("listRelayers <chain_id>")
    .description("Check available relayers on selected chain. If you wantue non-default RPC, you should provide ONLY mainnet RPC urls")
    .action(async (chainId) => {
      await initNetwork({ ...program, chainId: 1, eventType: 'relayer' })
      const availableRelayers = await getRelayers(chainId);
      console.log("There are " + availableRelayers.length + " available relayers")

      for (const relayer of availableRelayers) {
        console.log({
          'hostname': 'https://' + relayer.hostname + '/',
          'ensName': relayer.ensName,
          'stakeBalance': Number(web3Utils.fromWei(relayer.stakeBalance, 'ether')).toFixed(2) + " TORN",
          'tornadoServiceFee': relayer.tornadoServiceFee + "%"
        });
      }
    });
  program
    .command('balance <address> [token_address]')
    .description('Check ETH and ERC20 balance')
    .action(async (address, tokenAddress) => {
      await initNetwork(program);

      if (!address && signerAddress) {
        console.log('Using address', signerAddress, 'from private key');
        address = signerAddress;
      }
      await printETHBalance({ address, name: 'Account' });
      if (tokenAddress) {
        await printERC20Balance({ address, name: 'Account', tokenAddress });
      }
    });
  program
    .command('send <address> [amount] [token_address]')
    .description('Send ETH or ERC to address')
    .action(async (address, amount, tokenAddress) => {
      initPreferences(program);
      await initNetwork(program);

      await send({ address, amount, tokenAddress });
    });
  program
    .command('broadcast <signedTX>')
    .description('Submit signed TX to the remote node')
    .action(async (signedTX) => {
      await initNetwork(program);
      await submitTransaction(signedTX);
    });
  program
    .command('syncEvents <type> <currency> <amount> [chain_id]')
    .description('Sync the local cache file of deposit / withdrawal events for specific currency.')
    .action(async (type, currency, amount, chainId) => {
      console.log('Starting event sync command');

      await init({ ...program, currency, amount, chainId });
      if (type === "withdraw") type === "withdrawal";

      const cachedEvents = await fetchEvents({ type, currency, amount });
      console.log(
        'Synced event for',
        type,
        amount,
        currency.toUpperCase(),
        globals.netName,
        'Tornado instance to block',
        cachedEvents[cachedEvents.length - 1].blockNumber
      );
    });
  program
    .command('checkCacheValidity <currency> <amount> [chain_id]')
    .description('Check cache file of deposit events for specific currency for validity of the root.')
    .action(async (currency, amount, chainId) => {
      const type = 'deposit';

      await init({ ...program, currency, amount, chainId, eventType: type });
      const depositCachedEvents = await fetchEvents({ type, currency, amount });
      const isValidRoot = await isRootValid(depositCachedEvents);

      console.log(
        '\nDeposit events tree for',
        amount,
        currency.toUpperCase(),
        'on',
        globals.netName,
        'chain',
        isValidRoot ? 'has valid root' : 'is invalid, unknown root. You need to reset cache to zero array or to latest git state'
      );
    });
  program.command('parseNote <note>').action(async (noteString) => {
    const parse = parseNote(noteString);

    netId = parse.netId;

    console.log('\n=============Note=================');
    console.log('Network:', getCurrentNetworkName());
    console.log('Denomination:', parse.amount, parse.currency.toUpperCase());
    console.log('Commitment: ', parse.deposit.commitmentHex);
    console.log('Nullifier Hash: ', parse.deposit.nullifierHex);
    console.log('=====================================', '\n');
  });
  try {
    await program.parseAsync(process.argv);
    process.exit(0);
  } catch (e) {
    console.log('Error:', e);
    process.exit(1);
  }
}

main();