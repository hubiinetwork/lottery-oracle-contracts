/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');
const debug = require('debug')('2_stake-token');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const StakeToken = artifacts.require('./StakeToken');

module.exports = async (deployer, network, accounts) => {
  if (network.includes('mainnet'))
    return debug(`Not deploying to ${network}`);

  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  await deployer.deploy(StakeToken, 'Lottery Oracle Token', 'LOT', 15, {from: ownerAccount});
};
