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

contract('FractionalBalanceAllocator', () => {
  let allocator, stakeToken, bountyFund;

  beforeEach(async () => {
    allocator = await FractionalBalanceAllocator.new(
      new BN('10').pow(new BN('17'))
    );
  });

  describe('constructor()', () => {
    it('initialize successfully', async () => {
      allocator.address.should.have.lengthOf(42);

      (await allocator.fraction()).should.eq.BN(new BN('10').pow(new BN('17')));
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
