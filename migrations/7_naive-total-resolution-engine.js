/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const BountyFundFactory = artifacts.require('./BountyFundFactory.sol');
const FractionalBalanceAllocatorFactory = artifacts.require('./FractionalBalanceAllocatorFactory.sol');
const NaiveTotalResolutionEngine = artifacts.require('./NaiveTotalResolutionEngine.sol');
const Oracle = artifacts.require('./Oracle.sol');
const StakeToken = artifacts.require('./StakeToken.sol');
const ResolutionEngineOperator = artifacts.require('./ResolutionEngineOperator.sol');
const VerificationPhaseLib = artifacts.require('./VerificationPhaseLib.sol');

module.exports = async (deployer, network, accounts) => {
  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  const bountyFundFactory = await BountyFundFactory.deployed();
  const bountyAllocatorFactory = await FractionalBalanceAllocatorFactory.deployed();

  const stakeToken = await StakeToken.deployed();

  await bountyFundFactory.create(stakeToken.address);
  const bountyFundsCount = await bountyFundFactory.instancesCount();
  const bountyFund = await bountyFundFactory.instances(bountyFundsCount.subn(1));

  const bountyFraction = web3.utils.toBN(utils.getNaiveTotalBountyFraction());
  await bountyAllocatorFactory.create(bountyFraction);
  const bountyAllocatorsCount = await bountyAllocatorFactory.instancesCount();
  const bountyAllocator = await bountyAllocatorFactory.instances(bountyAllocatorsCount.subn(1));

  await NaiveTotalResolutionEngine.link({
    VerificationPhaseLib: (await VerificationPhaseLib.deployed()).address
  });

  const oracle = await Oracle.deployed();
  const operator = await ResolutionEngineOperator.deployed();

  const amount = web3.utils.toBN(utils.getNaiveTotalCriterionAmount());
  const resolutionEngine = await deployer.deploy(
    NaiveTotalResolutionEngine, oracle.address, operator.address, bountyFund,
    amount, {from: ownerAccount}
  );
  await resolutionEngine.setBountyAllocator(bountyAllocator);

  // TODO Enable initialization after deployment

  await oracle.addResolutionEngine(resolutionEngine.address, {from: ownerAccount});
};
