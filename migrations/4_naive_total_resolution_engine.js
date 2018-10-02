/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('./utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const StakeToken = artifacts.require('./StakeToken.sol');
const Oracle = artifacts.require('./Oracle.sol');
const BountyFund = artifacts.require('./BountyFund.sol');
const NaiveTotalResolutionEngine = artifacts.require('./NaiveTotalResolutionEngine.sol');

module.exports = async (deployer, network, accounts) => {
    let ownerAccount;
    try {
        ownerAccount = await utils.initializeOwnerAccount(network, accounts);

        const stakeToken = await StakeToken.deployed();
        const oracle = await Oracle.deployed();

        const bountyFund = await deployer.deploy(BountyFund, stakeToken.address, {from: ownerAccount});
        await stakeToken.mint(bountyFund.address, 100, {from: ownerAccount});

        const bountyDivisor = utils.getNaiveTotalBountyDivisor();
        const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(bountyDivisor);

        const criterionAmountStaked = web3.utils.toBN(utils.getNaiveTotalCriterionAmountStaked());

        const resolutionEngine = await deployer.deploy(
            NaiveTotalResolutionEngine, oracle.address, bountyFund.address, bountyFraction, criterionAmountStaked, {from: ownerAccount}
        );
        await oracle.addResolutionEngine(resolutionEngine.address, {from: ownerAccount});
    } finally {
        await utils.finalizeAccount(ownerAccount);
    }
};
