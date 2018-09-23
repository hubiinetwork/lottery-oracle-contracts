/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const Migrations = artifacts.require('Migrations');

module.exports = async (deployer) => {
  await deployer.deploy(Migrations);
};
