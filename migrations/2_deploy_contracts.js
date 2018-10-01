/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const TestToken = artifacts.require('TestToken');
const Oracle = artifacts.require('Oracle');
const BountyFund = artifacts.require('BountyFund');
// const ResolutionEngine = artifacts.require('ResolutionEngine');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');

// TODO Update to require deployed verification token (HBT) rather than deploying separate test token

module.exports = async (deployer) => {
    await deployer.deploy(TestToken);

    await deployer.deploy(Oracle);

    await deployer.deploy(BountyFund, TestToken.address);

    const testToken = await TestToken.deployed();
    await testToken.mint(BountyFund.address, 100);

    const bountyFund = await BountyFund.deployed();
    const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);

    await deployer.deploy(NaiveTotalResolutionEngine, Oracle.address, BountyFund.address, bountyFraction, 1000);
};
