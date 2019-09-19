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

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const FractionalBalanceAllocator = artifacts.require('FractionalBalanceAllocator');
const FractionalBalanceAllocatorFactory = artifacts.require('FractionalBalanceAllocatorFactory');

contract('FractionalBalanceAllocatorFactory', (accounts) => {
  let factory;

  beforeEach(async () => {
    factory = await FractionalBalanceAllocatorFactory.new();
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

  describe('create()', () => {
    let fraction;

    beforeEach(async () => {
      fraction = web3.utils.toBN(1e17);
    });

    it('should successfully create an instance', async () => {
      const result = await factory.create(fraction);

      result.logs.map(l => l.event).should.include('Created');

      const allocatorsCount = await factory.instancesCount();
      allocatorsCount.should.eq.BN(1);

      const allocator = await FractionalBalanceAllocator.at(await factory.instances(allocatorsCount.subn(1)));
      (await allocator.fraction()).should.eq.BN(fraction);

      (await factory.allInstances()).should.include(allocator.address);
    });
  });
});
