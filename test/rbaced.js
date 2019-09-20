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

const RBACed = artifacts.require('TestRBACed');

contract('RBACed', (accounts) => {
  let rbaced, ownerRole;

  beforeEach(async () => {
    rbaced = await RBACed.new();
    ownerRole = await rbaced.OWNER_ROLE();
  });

  describe('rolesCount()', () => {
    it('should return initial value', async () => {
      (await rbaced.rolesCount()).should.eq.BN(1);
    });
  });

  describe('isRole()', () => {
    describe('if role is owner', () => {
      it('should return true', async () => {
        (await rbaced.isRole(ownerRole)).should.be.true;
      });
    });

    describe('if role is not owner', () => {
      it('should return false', async () => {
        (await rbaced.isRole('SOME_NON_EXISTENT_ROLE')).should.be.false;
      });
    });
  });

  describe('addRole()', () => {
    let role;

    beforeEach(() => {
      role = 'SOME_ROLE';
    });

    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await rbaced.addRole(role, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully add role', async () => {
        const result = await rbaced.addRole(role, {from: accounts[0]});
        result.logs[0].event.should.equal('RoleAdded');
        (await rbaced.isRole('SOME_ROLE')).should.be.true;
      });
    });
  });

  describe('isRoleAccessor()', () => {
    describe('if called with address of owner', () => {
      it('should return true', async () => {
        (await rbaced.isRoleAccessor(ownerRole, accounts[0])).should.be.true;
      });
    });

    describe('if called with address of non-owner', () => {
      it('should return false', async () => {
        (await rbaced.isRoleAccessor(ownerRole, accounts[1])).should.be.false;
      });
    });
  });

  describe('addRoleAccessor()', () => {
    let accessorAddress;

    beforeEach(() => {
      accessorAddress = Wallet.createRandom().address;
    });

    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await rbaced.addRoleAccessor(ownerRole, accessorAddress, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully add role accessor', async () => {
        const result = await rbaced.addRoleAccessor(ownerRole, accessorAddress, {from: accounts[0]});
        result.logs[0].event.should.equal('RoleAccessorAdded');
        (await rbaced.isRoleAccessor(ownerRole, accessorAddress)).should.be.true;
      });
    });
  });

  describe('removeRoleAccessor()', () => {
    let accessorAddress;

    beforeEach(() => {
      accessorAddress = Wallet.createRandom().address;
    });

    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await rbaced.removeRoleAccessor(ownerRole, accessorAddress, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      beforeEach(async () => {
        await rbaced.addRoleAccessor(ownerRole, accessorAddress, {from: accounts[0]});
      });

      it('should successfully remove role accessor', async () => {
        const result = await rbaced.removeRoleAccessor(ownerRole, accessorAddress, {from: accounts[0]});
        result.logs[0].event.should.equal('RoleAccessorRemoved');
        (await rbaced.isRoleAccessor(ownerRole, accessorAddress)).should.be.false;
      });
    });
  });
});
