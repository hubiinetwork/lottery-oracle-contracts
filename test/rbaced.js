/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

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
        ownerRole = await rbaced.OWNER_ROLE.call();
    });

    describe('rolesCount()', () => {
        it('should test successfully', async () => {
            (await rbaced.rolesCount.call()).should.eq.BN(1);
        });
    });

    describe('isRole()', () => {
        it('should test successfully', async () => {
            (await rbaced.isRole.call(ownerRole)).should.be.true;
            (await rbaced.isRole.call('SOME_NON_EXISTENT_ROLE')).should.be.false;
        });
    });

    describe('addRole()', () => {
        let role;

        beforeEach(() => {
            role = 'SOME_ROLE';
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                rbaced.addRole(role, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            it('should test successfully', async () => {
                const result = await rbaced.addRole(role, {from: accounts[0]});
                result.logs[0].event.should.equal('RoleAdded');
                (await rbaced.isRole.call('SOME_ROLE')).should.be.true;
            });
        });
    });

    describe('isRoleAccessor()', () => {
        it('should test successfully', async () => {
            (await rbaced.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await rbaced.isRoleAccessor.call(ownerRole, accounts[1])).should.be.false;
        });
    });

    describe('addRoleAccessor()', () => {
        let accessorAddress;

        beforeEach(() => {
            accessorAddress = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                rbaced.addRoleAccessor(ownerRole, accessorAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            it('should test successfully', async () => {
                const result = await rbaced.addRoleAccessor(ownerRole, accessorAddress, {from: accounts[0]});
                result.logs[0].event.should.equal('RoleAccessorAdded');
                (await rbaced.isRoleAccessor.call(ownerRole, accessorAddress)).should.be.true;
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
                rbaced.removeRoleAccessor(ownerRole, accessorAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            beforeEach(async () => {
                await rbaced.addRoleAccessor(ownerRole, accessorAddress, {from: accounts[0]});
            });

            it('should test successfully', async () => {
                const result = await rbaced.removeRoleAccessor(ownerRole, accessorAddress, {from: accounts[0]});
                result.logs[0].event.should.equal('RoleAccessorRemoved');
                (await rbaced.isRoleAccessor.call(ownerRole, accessorAddress)).should.be.false;
            });
        });
    });
});
