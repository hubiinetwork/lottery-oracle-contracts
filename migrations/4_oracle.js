/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const AddressStoreLib = artifacts.require('./AddressStoreLib.sol');
const Oracle = artifacts.require('./Oracle.sol');

module.exports = async (deployer, network, accounts) => {
  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  await Oracle.link('AddressStoreLib', (await AddressStoreLib.deployed()).address);

  await deployer.deploy(Oracle, {from: ownerAccount});
};
