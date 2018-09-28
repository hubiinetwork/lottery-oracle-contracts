/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const Oracle = artifacts.require('Oracle');
const ResolutionEngine = artifacts.require('ResolutionEngine');
const BountyFund = artifacts.require('BountyFund');
const TestToken = artifacts.require('TestToken');

// TODO Update to require deployed verification token (HBT) rather than deploying separate test token

module.exports = async (deployer) => {
    await deployer.deploy(Oracle);
    await deployer.deploy(TestToken);
    await deployer.deploy(BountyFund, TestToken.address);

    const testToken = await TestToken.deployed();
    await testToken.mint(BountyFund.address, 100);

    const bountyFund = await BountyFund.deployed();
    const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);

    await deployer.deploy(ResolutionEngine, Oracle.address, BountyFund.address, bountyFraction);
};
