/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const StakeToken = artifacts.require('./StakeToken');

module.exports = async (deployer, network, accounts) => {
  if ('mainnet' === network)
    return;

  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  const stakeToken = await deployer.deploy(StakeToken, 'Lottery Oracle Token', 'LOT', 15, {from: ownerAccount});

  const minters = utils.getMinters();
  for (const minter of minters)
    await stakeToken.addMinter(minter);
};
