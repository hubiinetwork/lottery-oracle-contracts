/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('./utils.js');

const TestToken = artifacts.require('TestToken');
const Oracle = artifacts.require('Oracle');
const BountyFund = artifacts.require('BountyFund');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');

// TODO Update to require deployed verification token (HBT) rather than deploying separate test token

module.exports = async (deployer, network, accounts) => {
    let ownerAccount;

    try {
        ownerAccount = await utils.initializeOwnerAccount(network, accounts);

        const testToken = await TestToken.deployed();

        await deployer.deploy(Oracle, {from: ownerAccount});

        await deployer.deploy(BountyFund, testToken.address, {from: ownerAccount});
        await testToken.mint(BountyFund.address, 100, {from: ownerAccount});

        const bountyFund = await BountyFund.deployed();
        const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
        await deployer.deploy(
            NaiveTotalResolutionEngine, Oracle.address, BountyFund.address, bountyFraction, 1000, {from: ownerAccount}
        );
    } finally {
        await utils.finalizeAccount(ownerAccount);
    }
};
