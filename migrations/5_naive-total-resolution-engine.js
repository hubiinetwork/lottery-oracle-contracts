/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const StakeToken = artifacts.require('./StakeToken.sol');
const Oracle = artifacts.require('./Oracle.sol');
const ResolutionEngineOperator = artifacts.require('./ResolutionEngineOperator.sol');
const BountyFund = artifacts.require('./BountyFund.sol');
const FractionalBalanceAllocator = artifacts.require('./FractionalBalanceAllocator.sol');
const NaiveTotalResolutionEngine = artifacts.require('./NaiveTotalResolutionEngine.sol');

module.exports = async (deployer, network, accounts) => {
    let ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

    const stakeToken = await StakeToken.deployed();
    const oracle = await Oracle.deployed();
    const operator = await ResolutionEngineOperator.deployed();

    const bountyFund = await deployer.deploy(BountyFund, stakeToken.address, {from: ownerAccount});
    await stakeToken.mint(bountyFund.address, 100, {from: ownerAccount});

    const allocator = await deployer.deploy(
        FractionalBalanceAllocator, bountyFund.address, web3.utils.toBN(1e17), {from: ownerAccount}
    );

    const criterionAmountStaked = web3.utils.toBN(utils.getNaiveTotalCriterionAmountStaked());

    const resolutionEngine = await deployer.deploy(
        NaiveTotalResolutionEngine, oracle.address, operator.address, bountyFund.address,
        allocator.address, criterionAmountStaked, {from: ownerAccount}
    );
    await oracle.addResolutionEngine(resolutionEngine.address, {from: ownerAccount});
};
