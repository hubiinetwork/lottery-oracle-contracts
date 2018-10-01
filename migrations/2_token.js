/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const TestToken = artifacts.require('TestToken');

// TODO Update to require deployed verification token (HBT) rather than deploying separate test token

module.exports = async (deployer) => {
    await deployer.deploy(TestToken);
};
