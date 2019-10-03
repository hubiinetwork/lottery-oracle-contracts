/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const {Wallet} = require('ethers');
const debug = require('debug')('utils');

const unlockByAccount = new Map();
const unlockTimeInSeconds = typeof process.env.ETH_UNLOCK_SECONDS === 'undefined' ?
  7200 :
  Number.parseInt(process.env.ETH_UNLOCK_SECONDS);

exports.isTestNetwork = (network) => {
  return network.includes('develop') || network.includes('test') || network.includes('ganache');
};

exports.isInfuraNetwork = (network) => {
  return network.includes('infura');
};

const getNetworkCredentials = (network) => {
  switch (network) {
  case 'mainnet':
    return {account: process.env.ETH_MAINNET_ACCOUNT, secret: process.env.ETH_MAINNET_SECRET};
  case 'ropsten':
    return {account: process.env.ETH_TESTNET_ACCOUNT, secret: process.env.ETH_TESTNET_SECRET};
  default:
    throw new Error(`No credentials defined for ${network}`);
  }
};

const unlockAccount = async (web3, account, password) => {
  if (!unlockByAccount.get(account)) {
    unlockByAccount.set(account, true);

    debug(`Unlocking account ${account}`);
    await web3.eth.personal.unlockAccount(account, password, unlockTimeInSeconds);

    await exports.timeout(3000);

  } else
    debug(`Account ${account} found unlocked`);

  const lockAccount = async () => {
    if (unlockByAccount.get(account)) {
      unlockByAccount.set(account, false);

      debug(`Locking account ${account}...`);
      await web3.eth.personal.lockAccount(account);
    }
  };

  ['exit', 'SIGINT', 'SIGTERM'].forEach((eventType) => {
    process.on(eventType, lockAccount);
  });
};

exports.initializeOwnerAccount = async (web3, network, accounts) => {
  let ownerAccount;
  if (exports.isTestNetwork(network))
    ownerAccount = accounts[0];
  else if (exports.isInfuraNetwork(network))
    ownerAccount = Wallet.fromMnemonic(process.env.MNEMONIC).address;
  else {
    const {account, secret} = getNetworkCredentials(network);
    await unlockAccount(web3, account, secret);
    ownerAccount = account;
  }
  debug(`Owner account ${ownerAccount} initialized`);
  return ownerAccount;
};

exports.unlockAddress = async (web3, address, password, timeoutInSecs) => {
  const succeeded = await web3.eth.personal.unlockAccount(address, password, timeoutInSecs);
  debug(`Unlock of address ${address} for ${timeoutInSecs}s: ${succeeded ? 'successful' : 'unsuccessful'}`);
  return succeeded;
};

exports.lockAddress = async (web3, address) => {
  const succeeded = await web3.eth.personal.lockAccount(address);
  debug(`Lock of address ${address}: ${succeeded ? 'successful' : 'unsuccessful'}`);
  return succeeded;
};

exports.getNaiveTotalBountyFraction = () => {
  const bountyFraction = process.env.NAIVE_TOTAL_BOUNTY_FRACTION || 5e16;
  debug(`Naive total bounty fraction: ${bountyFraction}`);
  return bountyFraction;
};

exports.getNaiveTotalCriterionAmount = () => {
  const criterionAmount = process.env.NAIVE_TOTAL_CRITERION_AMOUNT || 50000000000000000000;
  debug(`Naive total amount criterion: ${criterionAmount}`);
  return criterionAmount;
};

exports.getBergenBountyFraction = () => {
  const bountyFraction = process.env.BERGEN_BOUNTY_FRACTION || 5e16;
  debug(`Bergen bounty fraction: ${bountyFraction}`);
  return bountyFraction;
};

exports.getBergenCriterionAlpha = () => {
  const alpha = process.env.BERGEN_CRITERION_ALPHA || 10;
  debug(`Bergen alpha criterion: ${alpha}`);
  return alpha;
};

exports.getBergenCriterionBeta = () => {
  const beta = process.env.BERGEN_CRITERION_BETA || 66e16;
  debug(`Bergen beta criterion: ${beta}`);
  return beta;
};

exports.getBergenCriterionGamma = () => {
  const gamma = process.env.BERGEN_CRITERION_GAMMA || 5;
  debug(`Bergen gamma criterion: ${gamma}`);
  return gamma;
};

exports.getOperatorTimeout = () => {
  const minters = process.env.OPERATOR_TIMEOUT || 30 * 24 * 60 * 60; // 30 days
  debug(`Minters: ${minters}`);
  return minters;
};

exports.getStakeToken = () => {
  const stakeToken = process.env.STAKE_TOKEN;
  debug(`Stake token: ${stakeToken}`);
  return stakeToken;
};

exports.timeout = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
