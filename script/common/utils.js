/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const debug = require('debug')('utils');

const unlockByAccount = new Map();
const unlockTimeInSeconds = typeof process.env.ETH_UNLOCK_SECONDS === 'undefined' ?
  7200 :
  Number.parseInt(process.env.ETH_UNLOCK_SECONDS);

const isTestNetwork = (network) => {
  return network.includes('develop') || network.includes('test') || network.includes('ganache');
};

const getNetworkCredentials = () => {
  return {account: process.env.ETH_TESTNET_ACCOUNT, secret: process.env.ETH_TESTNET_SECRET};
};

const unlockAccount = async (web3, account, password) => {
  if (!unlockByAccount.get(account)) {
    unlockByAccount.set(account, true);

    debug(`Unlocking account ${account}...`);
    await web3.eth.personal.unlockAccount(account, password, unlockTimeInSeconds);

    await exports.timeout(3000);
  }

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
  if (isTestNetwork(network))
    ownerAccount = accounts[0];
  else {
    const {account, secret} = getNetworkCredentials();
    await unlockAccount(web3, account, secret);
    ownerAccount = account;
  }
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
  const bountyFraction = process.env.NAIVE_TOTAL_BOUNTY_FRACTION || 1e17;
  debug(`Naive total bounty fraction: ${bountyFraction}`);
  return bountyFraction;
};

exports.getNaiveTotalCriterionAmount = () => {
  const criterionAmount = process.env.NAIVE_TOTAL_CRITERION_AMOUNT || 1000;
  debug(`Naive total criterion amount: ${criterionAmount}`);
  return criterionAmount;
};

exports.getMinters = () => {
  const minters = process.env.MINTERS ? process.env.MINTERS.split(',') : [];
  debug(`Minters: ${minters}`);
  return minters;
};

exports.getResolutionEngineOperatorTimeout = () => {
  const minters = process.env.RESOLUTION_ENGINE_OPERATOR_TIMEOUT || 30 * 24 * 60 * 60; // 30 days
  debug(`Minters: ${minters}`);
  return minters;
};

exports.timeout = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
