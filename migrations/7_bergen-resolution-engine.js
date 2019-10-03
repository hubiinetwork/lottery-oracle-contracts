/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');
const debug = require('debug')('7_bergen-resolution-engine');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const BergenResolutionEngine = artifacts.require('BergenResolutionEngine');
const BountyFund = artifacts.require('BountyFund');
const ConstantsLib = artifacts.require('ConstantsLib');
const FractionalBalanceAllocator = artifacts.require('FractionalBalanceAllocator');
const Operator = artifacts.require('Operator');
const Oracle = artifacts.require('Oracle');
const StakeToken = artifacts.require('StakeToken');
const VerificationPhaseLib = artifacts.require('VerificationPhaseLib');

module.exports = async (deployer, network, accounts) => {
  if (network.includes('mainnet'))
    return debug(`Not deploying to ${network}`);

  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  const oracle = await Oracle.deployed();
  const operator = await Operator.deployed();

  const stakeToken = utils.getStakeToken() || (await StakeToken.deployed()).address;
  const bountyFund = await deployer.deploy(BountyFund, stakeToken, operator.address, {from: ownerAccount});

  const bountyFraction = web3.utils.toBN(utils.getBergenBountyFraction());
  await FractionalBalanceAllocator.link({
    ConstantsLib: (await ConstantsLib.deployed()).address
  });
  const bountyAllocator = await deployer.deploy(FractionalBalanceAllocator, bountyFraction, {from: ownerAccount});

  const alpha = web3.utils.toBN(utils.getBergenCriterionAlpha());
  const beta = web3.utils.toBN(utils.getBergenCriterionBeta());
  const gamma = web3.utils.toBN(utils.getBergenCriterionGamma());
  await BergenResolutionEngine.link({
    ConstantsLib: (await ConstantsLib.deployed()).address,
    VerificationPhaseLib: (await VerificationPhaseLib.deployed()).address
  });
  const resolutionEngine = await deployer.deploy(
    BergenResolutionEngine, oracle.address, operator.address, bountyFund.address,
    alpha, beta, gamma,
    {from: ownerAccount}
  );
  await resolutionEngine.setBountyAllocator(bountyAllocator.address);

  // NOTE Remember to initialize resolution engine after deployment

  await oracle.addResolutionEngine(resolutionEngine.address, {from: ownerAccount});
};
