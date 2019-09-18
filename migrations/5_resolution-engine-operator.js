/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const ResolutionEngineOperator = artifacts.require('./ResolutionEngineOperator.sol');

module.exports = async (deployer, network, accounts) => {
  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  const timeout = web3.utils.toBN(utils.getResolutionEngineOperatorTimeout());
  await deployer.deploy(ResolutionEngineOperator, timeout, {from: ownerAccount});
};