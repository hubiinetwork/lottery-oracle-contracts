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
const StakeToken = artifacts.require('StakeToken');
const MockedBountyFund = artifacts.require('MockedBountyFund');

contract('FractionalBalanceAllocator', (accounts) => {
  let allocator, stakeToken, bountyFund;

  beforeEach(async () => {
    allocator = await FractionalBalanceAllocator.new(web3.utils.toBN(1e17));
  });

  describe('constructor()', () => {
    it('initialize successfully', async () => {
      allocator.address.should.have.lengthOf(42);

      (await allocator.fraction()).should.eq.BN(web3.utils.toBN(1e17));
    });
  });

  describe('freeze()', () => {
    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await allocator.freeze({from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully freeze', async () => {
        const result = await allocator.freeze();

        result.logs[0].event.should.equal('Frozen');

        (await allocator.frozen()).should.be.true;
      });
    });
  });

  describe('setFraction()', () => {
    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await allocator.setFraction(web3.utils.toBN(5e17), {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called after allocator was frozen', () => {
      beforeEach(async () => {
        await allocator.freeze();
      });

      it('should revert', async () => {
        await allocator.setFraction(web3.utils.toBN(5e17))
          .should.be.rejected;
      });
    });

    describe('if called with argument out of bounds', () => {
      it('should revert', async () => {
        await allocator.setFraction(web3.utils.toBN(2e18))
          .should.be.rejected;
      });
    });

    describe('if called by owner on non-frozen allocator with sizeable argument', () => {
      it('should successfully set the bounty allocator', async () => {
        const result = await allocator.setFraction(web3.utils.toBN(5e17));

        result.logs[0].event.should.equal('FractionSet');

        (await allocator.fraction()).should.eq.BN(web3.utils.toBN(5e17));
      });
    });
  });

  describe('allocate()', () => {
    beforeEach(async () => {
      stakeToken = await StakeToken.new('Lottery Oracle Token', 'LOT', 15);

      bountyFund = await MockedBountyFund.new();
      await bountyFund._setToken(stakeToken.address);

      stakeToken.mint(bountyFund.address, 100);
    });

    it('should return the fractional amount of tokens owned by the bounty fund', async () => {
      (await bountyFund._allocateTokens(allocator.address)).should.eq.BN(
        (await stakeToken.balanceOf(bountyFund.address)).divn(10)
      );
    });
  });
});
