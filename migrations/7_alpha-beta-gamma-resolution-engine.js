/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const AlphaBetaGammaResolutionEngine = artifacts.require('./AlphaBetaGammaResolutionEngine.sol');
const BountyFund = artifacts.require('./BountyFund.sol');
const ConstantsLib = artifacts.require('./ConstantsLib.sol');
const FractionalBalanceAllocator = artifacts.require('./FractionalBalanceAllocator.sol');
const Oracle = artifacts.require('./Oracle.sol');
const ResolutionEngineOperator = artifacts.require('./ResolutionEngineOperator.sol');
const StakeToken = artifacts.require('./StakeToken.sol');
const VerificationPhaseLib = artifacts.require('./VerificationPhaseLib.sol');

module.exports = async (deployer, network, accounts) => {
  const ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

  const stakeToken = await StakeToken.deployed();
  const oracle = await Oracle.deployed();
  const operator = await ResolutionEngineOperator.deployed();

  const bountyFund = await deployer.deploy(BountyFund, stakeToken.address, {from: ownerAccount});
  await stakeToken.mint(bountyFund.address, 100, {from: ownerAccount});

  await FractionalBalanceAllocator.link({
    ConstantsLib: (await ConstantsLib.deployed()).address
  });

  const bountyFraction = web3.utils.toBN(utils.getNaiveTotalBountyFraction());
  const bountyAllocator = await deployer.deploy(
    FractionalBalanceAllocator, bountyFraction, {from: ownerAccount}
  );

  await AlphaBetaGammaResolutionEngine.link({
    ConstantsLib: (await ConstantsLib.deployed()).address,
    VerificationPhaseLib: (await VerificationPhaseLib.deployed()).address
  });

  const resolutionEngine = await deployer.deploy(
    AlphaBetaGammaResolutionEngine, oracle.address, operator.address, bountyFund.address,
    2, web3.utils.toBN('500000000000000000'), 3, // TODO Add cmd line params
    {from: ownerAccount}
  );
  await resolutionEngine.setBountyAllocator(bountyAllocator.address);
  await resolutionEngine.initialize();

  await oracle.addResolutionEngine(resolutionEngine.address, {from: ownerAccount});
};
