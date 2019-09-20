/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const BountyFundFactory = artifacts.require('./BountyFundFactory.sol');
const ConstantsLib = artifacts.require('./ConstantsLib.sol');
const FractionalBalanceAllocatorFactory = artifacts.require('./FractionalBalanceAllocatorFactory.sol');
const FractionalBalanceAllocator = artifacts.require('./FractionalBalanceAllocator.sol');

module.exports = async (deployer, network, accounts) => {
  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  await FractionalBalanceAllocator.link({
    ConstantsLib: (await ConstantsLib.deployed()).address
  });
  await FractionalBalanceAllocatorFactory.link({
    ConstantsLib: (await ConstantsLib.deployed()).address
  });

  await deployer.deploy(BountyFundFactory, {from: ownerAccount});
  await deployer.deploy(FractionalBalanceAllocatorFactory, {from: ownerAccount});
};
