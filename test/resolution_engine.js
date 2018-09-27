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
const BountyFund = artifacts.require('BountyFund');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');
const TestToken = artifacts.require('TestToken');

contract('ResolutionEngine', (accounts) => {
    let oracleAddress, testToken, resolutionEngine, ownerRole, oracleRole, bountyFund;

    beforeEach(async () => {
        oracleAddress = accounts[1];
        testToken = await TestToken.new();

        resolutionEngine = await ResolutionEngine.new(oracleAddress, testToken.address);

        ownerRole = await resolutionEngine.OWNER_ROLE.call();
        oracleRole = await resolutionEngine.ORACLE_ROLE.call();

        bountyFund = await BountyFund.new(resolutionEngine.address);
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
            beforeEach(async () => {
                resolutionEngine = await ResolutionEngine.new(oracleAddress, testToken.address);
            });

            it('should successfully set the bounty fund', async () => {
                const result = await resolutionEngine.setBountyFund(bountyFund.address);
                result.logs[0].event.should.equal('BountyFundSet');
            });
        });

        describe('when called the second time', () => {
            it('should revert', async () => {
                resolutionEngine.setBountyFund(bountyFund.address).should.be.rejected;
            });
        });
    });

    describe('setBountyFraction()', () => {
        let bountyFraction;

        describe('when called without bounty fund set', () => {
            beforeEach(async () => {
                resolutionEngine = await ResolutionEngine.new(oracleAddress, testToken.address);
                bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
            });

            it('should revert', async () => {
                resolutionEngine.setBountyFraction(bountyFraction).should.be.rejected;
            });
        });

        describe('when bounty fraction is too large', () => {
            beforeEach(async () => {
                bountyFraction = (await bountyFund.PARTS_PER.call()).muln(10);
            });

            it('should revert', async () => {
                resolutionEngine.setBountyFund(bountyFraction).should.be.rejected;
            });
        });

        describe('when called the first time', () => {
            beforeEach(async () => {
                bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
            });

            it('should successfully set the bounty fraction', async () => {
                const result = await resolutionEngine.setBountyFraction(bountyFraction);
                result.logs[0].event.should.equal('BountyFractionSet');
                (await resolutionEngine.bountyFraction.call()).should.eq.BN(bountyFraction);
            });
        });

        describe('when called the second time', () => {
            beforeEach(async () => {
                bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
                await resolutionEngine.setBountyFraction(bountyFraction);
            });

            it('should revert', async () => {
                resolutionEngine.setBountyFraction(bountyFraction).should.be.rejected;
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
    });

    describe('metricsByVerificationPhaseNumber()', () => {
        describe('if verification phase number is too large', () => {
            it('should revert', async () => {
                resolutionEngine.metricsByVerificationPhaseNumber(1).should.be.rejected;
            });
        });

        describe('if verification phase number is within bounds', () => {
            it('should return metrics of verification phase number', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumber(0);
                result.state.should.exist.and.eq.BN(0);
                result.trueAmount.should.exist.and.eq.BN(0);
                result.falseAmount.should.exist.and.eq.BN(0);
                result.amount.should.exist.and.eq.BN(0);
                result.numberOfWallets.should.exist.and.eq.BN(0);
                result.startBlock.should.exist.and.eq.BN(0);
                result.endBlock.should.exist.and.eq.BN(0);
                result.numberOfBlocks.should.exist.and.be.gt.BN(0);
                result.bounty.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('metricsByVerificationPhaseNumberAndWallet()', () => {
        describe('if verification phase number is too large', () => {
            it('should revert', async () => {
                resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, Wallet.createRandom().address).should.be.rejected;
            });
        });

        describe('if verification phase number is within bounds', () => {
            it('should return metrics of verification phase number and wallet', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(0, Wallet.createRandom().address);
                result.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('metricsByWallet()', () => {
        it('should return metrics of wallet', async () => {
            const result = await resolutionEngine.metricsByWallet(Wallet.createRandom().address);
            result.should.exist.and.eq.BN(0);
        });
    });

    describe('metricsByBlockNumber()', () => {
        describe('if block number is too large', () => {
            let blockNumber;

            beforeEach(async () => {
                blockNumber = await web3.eth.getBlockNumber();
            });

            it('should revert', async () => {
                resolutionEngine.metricsByBlockNumber(blockNumber * 2).should.be.rejected;
            });
        });

        describe('if block number is within bounds', () => {
            it('should return metrics of block number', async () => {
                const result = await resolutionEngine.metricsByBlockNumber(0);
                result.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('openVerificationPhase()', () => {
        let mockedResolutionEngine;

        beforeEach(async () => {
            mockedResolutionEngine = await MockedResolutionEngine.new(oracleAddress, testToken.address);
            bountyFund = await BountyFund.new(mockedResolutionEngine.address);

            const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
            await mockedResolutionEngine.setBountyFraction(bountyFraction);

            await testToken.mint(bountyFund.address, 100);
        });

        describe('if verification phase is unopened', () => {
            it('should successfully open the verification phase', async () => {
                await mockedResolutionEngine._openVerificationPhase();

                const result = await mockedResolutionEngine.metricsByVerificationPhaseNumber(0);
                result.startBlock.should.exist.and.be.gt.BN(0);
                result.endBlock.should.exist.and.eq.BN(0);
                result.numberOfBlocks.should.exist.and.be.gt.BN(0);
                result.bounty.should.exist.and.be.eq.BN(10);
            });
        });

        describe('if verification phase is open', () => {
            beforeEach(async () => {
                await mockedResolutionEngine._openVerificationPhase();
            });

            it('should revert', async () => {
                mockedResolutionEngine._openVerificationPhase().should.be.rejected;
            });
        });
    });

    describe('closeVerificationPhase()', () => {
        let mockedResolutionEngine;

        beforeEach(async () => {
            mockedResolutionEngine = await MockedResolutionEngine.new(oracleAddress, testToken.address);
            bountyFund = await BountyFund.new(mockedResolutionEngine.address);

            const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
            await mockedResolutionEngine.setBountyFraction(bountyFraction);

            await testToken.mint(bountyFund.address, 100);

            await mockedResolutionEngine._openVerificationPhase();
        });

        it('should successfully close the verification phase', async () => {
            await mockedResolutionEngine._closeVerificationPhase();

            const result = await mockedResolutionEngine.metricsByVerificationPhaseNumber(0);
            result.startBlock.should.exist.and.be.gt.BN(0);
            result.endBlock.should.exist.and.be.gt.BN(0);
            result.numberOfBlocks.should.exist.and.be.gte.BN(0);

            (await mockedResolutionEngine.verificationPhaseNumber.call()).should.be.gt.BN(0);
        });
    });
});
