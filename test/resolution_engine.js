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

const ResolutionEngine = artifacts.require('ResolutionEngine');
const TestToken = artifacts.require('TestToken');

contract('ResolutionEngine', (accounts) => {
    let resolutionEngine, oracleRole, testToken;

    before(async () => {
        testToken = await TestToken.new();
    });

    beforeEach(async () => {
        resolutionEngine = await ResolutionEngine.deployed();
        oracleRole = await resolutionEngine.ORACLE_ROLE();
    });

    describe('constructor()', () => {
        it('should test successfully', async () => {
            resolutionEngine.address.should.have.lengthOf(42);
            const ownerRole = await resolutionEngine.OWNER_ROLE.call();
            (await resolutionEngine.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await resolutionEngine.isRoleAccessor.call(ownerRole, accounts[1])).should.not.be.true;
        });
    });

    describe('setOracle()', () => {
        let oracleAddress;

        beforeEach(() => {
            oracleAddress = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                resolutionEngine.setOracle(oracleAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            it('should test successfully', async () => {
                const result = await resolutionEngine.setOracle(oracleAddress);
                result.logs[0].event.should.equal('OracleSet');
                (await resolutionEngine.oracle.call()).should.equal(oracleAddress);
            });
        });
    });

    describe('setToken()', () => {
        let tokenAddress;

        beforeEach(() => {
            tokenAddress = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                resolutionEngine.setToken(tokenAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            it('should test successfully', async () => {
                const result = await resolutionEngine.setToken(tokenAddress);
                result.logs[0].event.should.equal('TokenSet');
                (await resolutionEngine.token.call()).should.equal(tokenAddress);
            });
        });
    });

    describe('stakeTokens()', () => {
        before(async () => {
            await resolutionEngine.setToken(testToken.address);

            await testToken.mint(accounts[2], 100);
            await testToken.approve(resolutionEngine.address, 100, {from: accounts[2]});
        });

        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.stakeTokens(accounts[2], 0, 100, true, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            beforeEach(async () => {
                await resolutionEngine.addRoleAccessor(oracleRole, accounts[1], {from: accounts[0]})
            });

            it('should test successfully', async () => {
                const result = await resolutionEngine.stakeTokens(accounts[2], 100, true, {from: accounts[1]});
                result.logs[0].event.should.equal('TokensStaked');
            });
        });
    })
});
