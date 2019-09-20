/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {Wallet} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const BountyFund = artifacts.require('BountyFund');
const BountyFundFactory = artifacts.require('BountyFundFactory');

contract.skip('BountyFundFactory', (accounts) => {
  let factory;

  beforeEach(async () => {
    factory = await BountyFundFactory.new();
  });

  describe('constructor()', () => {
    it('initialize successfully', async () => {
      factory.address.should.have.lengthOf(42);

      const ownerRole = await factory.OWNER_ROLE();
      (await factory.isRoleAccessor(ownerRole, accounts[0])).should.be.true;
      (await factory.isRoleAccessor(ownerRole, accounts[1])).should.be.false;
    });
  });

  describe('instancesCount()', () => {
    it('should equal value initialized', async () => {
      (await factory.instancesCount()).should.eq.BN(0);
    });
  });

  describe('allInstances()', () => {
    it('should equal value initialized', async () => {
      (await factory.allInstances()).should.be.an('array').that.is.empty;
    });
  });

  describe('instancesByOwnerCount()', () => {
    it('should equal value initialized', async () => {
      (await factory.instancesByOwnerCount(Wallet.createRandom().address))
        .should.eq.BN(0);
    });
  });

  describe('allInstancesByOwner()', () => {
    it('should equal value initialized', async () => {
      (await factory.allInstancesByOwner(Wallet.createRandom().address))
        .should.be.an('array').that.is.empty;
    });
  });

  describe('create()', () => {
    let token;

    beforeEach(async () => {
      token = Wallet.createRandom().address;
    });

    it('should successfully create an instance', async () => {
      const result = await factory.create(token);

      result.logs.map(l => l.event).should.include('Created');

      const instancesCount = await factory.instancesCount();
      instancesCount.should.eq.BN(1);

      (await factory.instancesByOwnerCount(accounts[0]))
        .should.eq.BN(1);

      const bountyFund = await BountyFund.at(await factory.instances(instancesCount.subn(1)));
      (await bountyFund.token()).should.equal(token);

      (await factory.allInstances()).should.include(bountyFund.address);
      (await factory.allInstancesByOwner(accounts[0])).should.include(bountyFund.address);
    });
  });
});
