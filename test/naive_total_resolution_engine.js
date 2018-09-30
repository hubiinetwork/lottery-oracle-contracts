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

const TestToken = artifacts.require('TestToken');
const BountyFund = artifacts.require('BountyFund');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');

contract('NaiveTotalResolutionEngine', (accounts) => {
    let oracleAddress, testToken, resolutionEngine, ownerRole, oracleRole, bountyFund;

    beforeEach(async () => {
        oracleAddress = accounts[1];
        testToken = await TestToken.new();

        bountyFund = await BountyFund.new(testToken.address);
        await testToken.mint(bountyFund.address, 100);

        const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
        resolutionEngine = await NaiveTotalResolutionEngine.new(oracleAddress, bountyFund.address, bountyFraction, 100);

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

    describe('resolutionCriteriaMet()', () => {
        describe('if resolution criteria have not been met', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], 0, true, 10, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], 0, false, 20, {from: oracleAddress});
            });

            it('should return false', async () => {
                (await resolutionEngine.resolutionCriteriaMet.call()).should.be.false;
            });
        });

        describe('if resolution criteria have been met on true status', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], 0, true, 110, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], 0, false, 20, {from: oracleAddress});
            });

            it('should return true', async () => {
                (await resolutionEngine.resolutionCriteriaMet.call()).should.be.true;
            });
        });

        describe('if resolution criteria have been met on false status', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], 0, true, 10, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], 0, false, 120, {from: oracleAddress});
            });

            it('should return true', async () => {
                (await resolutionEngine.resolutionCriteriaMet.call()).should.be.true;
            });
        });
    });
});
