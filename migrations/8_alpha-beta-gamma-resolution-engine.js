/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const AlphaBetaGammaResolutionEngine = artifacts.require('./AlphaBetaGammaResolutionEngine.sol');
const BountyFundFactory = artifacts.require('./BountyFundFactory.sol');
const ConstantsLib = artifacts.require('./ConstantsLib.sol');
const FractionalBalanceAllocatorFactory = artifacts.require('./FractionalBalanceAllocatorFactory.sol');
const Oracle = artifacts.require('./Oracle.sol');
const ResolutionEngineOperator = artifacts.require('./ResolutionEngineOperator.sol');
const StakeToken = artifacts.require('./StakeToken.sol');
const VerificationPhaseLib = artifacts.require('./VerificationPhaseLib.sol');

module.exports = async (deployer, network, accounts) => {
  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  const bountyFundFactory = await BountyFundFactory.deployed();
  const bountyAllocatorFactory = await FractionalBalanceAllocatorFactory.deployed();

  const stakeToken = await StakeToken.deployed();

  await bountyFundFactory.create(stakeToken.address);
  const bountyFundsCount = await bountyFundFactory.instancesCount();
  const bountyFund = await bountyFundFactory.instances(bountyFundsCount.subn(1));

  const bountyFraction = web3.utils.toBN(utils.getAlphaBetaGammaBountyFraction());
  await bountyAllocatorFactory.create(bountyFraction);
  const bountyAllocatorsCount = await bountyAllocatorFactory.instancesCount();
  const bountyAllocator = await bountyAllocatorFactory.instances(bountyAllocatorsCount.subn(1));

  await AlphaBetaGammaResolutionEngine.link({
    ConstantsLib: (await ConstantsLib.deployed()).address,
    VerificationPhaseLib: (await VerificationPhaseLib.deployed()).address
  });

  const oracle = await Oracle.deployed();
  const operator = await ResolutionEngineOperator.deployed();

  const alpha = web3.utils.toBN(utils.getAlphaBetaGammaCriterionAlpha());
  const beta = web3.utils.toBN(utils.getAlphaBetaGammaCriterionBeta());
  const gamma = web3.utils.toBN(utils.getAlphaBetaGammaCriterionGamma());
  const resolutionEngine = await deployer.deploy(
    AlphaBetaGammaResolutionEngine, oracle.address, operator.address, bountyFund,
    alpha, beta, gamma,
    {from: ownerAccount}
  );
  await resolutionEngine.setBountyAllocator(bountyAllocator);

  // TODO Enable initialization after deployment

  await oracle.addResolutionEngine(resolutionEngine.address, {from: ownerAccount});
};
