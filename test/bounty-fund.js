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
const {Wallet, constants: {AddressZero}} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const BountyFund = artifacts.require('BountyFund');
const StakeToken = artifacts.require('StakeToken');
const MockedAllocator = artifacts.require('MockedAllocator');

contract('BountyFund', (accounts) => {
  let stakeToken, bountyFund;

  beforeEach(async () => {
    stakeToken = await StakeToken.new('Lottery Oracle Token', 'LOT', 15);

    bountyFund = await BountyFund.new(stakeToken.address);
  });

  describe('constructor()', () => {
    it('initialize successfully', async () => {
      bountyFund.address.should.have.lengthOf(42);

      const ownerRole = await bountyFund.OWNER_ROLE();
      (await bountyFund.isRoleAccessor(ownerRole, accounts[0])).should.be.true;
      (await bountyFund.isRoleAccessor(ownerRole, accounts[1])).should.be.false;
    });
  });

  describe('token()', () => {
    it('should equal the value passed as constructor argument', async () => {
      (await bountyFund.token()).should.equal(stakeToken.address);
    });
  });

  describe('setResolutionEngine()', () => {
    let resolutionEngine;

    describe('when called with zero address', () => {
      it('should revert', async () => {
        bountyFund.setResolutionEngine(AddressZero).should.be.rejected;
      });
    });

    describe('when called the first time', () => {
      beforeEach(() => {
        resolutionEngine = Wallet.createRandom().address;
      });

      it('should successfully set the resolution engine', async () => {
        const result = await bountyFund.setResolutionEngine(resolutionEngine);

        result.logs[0].event.should.equal('ResolutionEngineSet');

        (await bountyFund.resolutionEngine()).should.equal(resolutionEngine);
      });
    });

    describe('when called the second time', () => {
      beforeEach(async () => {
        resolutionEngine = Wallet.createRandom().address;
        await bountyFund.setResolutionEngine(resolutionEngine);
      });

      it('should revert', async () => {
        bountyFund.setResolutionEngine(resolutionEngine).should.be.rejected;
      });
    });
  });

  describe('depositTokens()', () => {
    beforeEach(async () => {
      await stakeToken.mint(accounts[2], 100);
      await stakeToken.approve(bountyFund.address, 100, {from: accounts[2]});
    });

    it('should successfully transfer tokens to bounty fund', async () => {
      const result = await bountyFund.depositTokens(100, {from: accounts[2]});

      result.logs[0].event.should.equal('TokensDeposited');

      (await stakeToken.balanceOf(bountyFund.address)).should.eq.BN(100);
    });
  });

  describe('allocateTokens()', () => {
    let bountyAllocator;

    beforeEach(async () => {
      bountyAllocator = await MockedAllocator.new();
      await bountyAllocator._setAllocation(10);
    });

    describe('if called by agent not registered as resolution engine', () => {
      it('should revert', async () => {
        bountyFund.allocateTokens(bountyAllocator).should.be.rejected;
      });
    });

    describe('if called by registered resolution engine and bounty is within bounds', () => {
      let balanceBefore;

      beforeEach(async () => {
        await bountyFund.setResolutionEngine(accounts[0]);

        await stakeToken.mint(bountyFund.address, 100);

        balanceBefore = await stakeToken.balanceOf(bountyFund.address);
      });

      it('should successfully transfer tokens to bounty fund', async () => {
        const result = await bountyFund.allocateTokens(bountyAllocator.address);

        result.logs[0].event.should.equal('TokensAllocated');

        (await stakeToken.balanceOf(bountyFund.address))
          .should.eq.BN(balanceBefore.subn(10));
        (await stakeToken.balanceOf(accounts[0]))
          .should.eq.BN(10);
      });
    });
  });
});
