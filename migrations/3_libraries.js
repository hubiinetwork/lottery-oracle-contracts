/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const AddressStoreLib = artifacts.require('./AddressStoreLib.sol');
const ConstantsLib = artifacts.require('./ConstantsLib.sol');
const VerificationPhaseLib = artifacts.require('./VerificationPhaseLib.sol');

module.exports = async (deployer, network, accounts) => {
  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  await deployer.deploy(AddressStoreLib, {from: ownerAccount});
  await deployer.deploy(ConstantsLib, {from: ownerAccount});
  await deployer.deploy(VerificationPhaseLib, {from: ownerAccount});
};
