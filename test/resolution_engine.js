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

const Oracle = artifacts.require('Oracle');
const ResolutionEngine = artifacts.require('ResolutionEngine');
const TestToken = artifacts.require('TestToken');

contract('ResolutionEngine', (accounts) => {
    let oracleAddress, testToken, resolutionEngine, ownerRole, oracleRole;

    beforeEach(async () => {
        oracleAddress = accounts[1];
        testToken = await TestToken.new();

        resolutionEngine = await ResolutionEngine.new(oracleAddress, testToken.address);

        ownerRole = await resolutionEngine.OWNER_ROLE.call();
        oracleRole = await resolutionEngine.ORACLE_ROLE.call();
    });

    describe('constructor()', () => {
        it('should successfully initialize', async () => {
            resolutionEngine.address.should.have.lengthOf(42);
            (await resolutionEngine.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await resolutionEngine.isRoleAccessor.call(ownerRole, accounts[1])).should.be.false;
            (await resolutionEngine.isRoleAccessor.call(oracleRole, accounts[0])).should.be.false;
            (await resolutionEngine.isRoleAccessor.call(oracleRole, accounts[1])).should.be.true;
        });
    });

    describe('setBountyFund()', () => {
        describe('when called the first time', () => {
            it('should successfully set the bounty fund', async () => {
                const result = await resolutionEngine.setBountyFund(accounts[1]);
                result.logs[0].event.should.equal('BountyFundSet');
            });
        });

        describe('when called the second time', () => {
            beforeEach(async () => {
                await resolutionEngine.setBountyFund(accounts[1]);
            });

            it('should revert', async () => {
                resolutionEngine.setBountyFund(accounts[1]).should.be.rejected;
            });
        });
    });

    describe('stakeTokens()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.stakeTokens(accounts[2], 0, true, 100, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called on non-current verification phase number', () => {
            it('should revert', async () => {
                resolutionEngine.stakeTokens(accounts[2], 1, true, 100, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            beforeEach(async () => {
                await testToken.mint(accounts[2], 100);
                await testToken.approve(resolutionEngine.address, 100, {from: accounts[2]});
            });

            it('should successfully stake tokens', async () => {
                const result = await resolutionEngine.stakeTokens(accounts[2], 0, true, 100, {from: accounts[1]});
                result.logs[0].event.should.equal('TokensStaked');
            });
        });
    })
});
