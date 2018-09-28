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
    let oracle, testToken, resolutionEngine, ownerRole, oracleRole, bountyFund;

    beforeEach(async () => {
        oracle = accounts[1];
        testToken = await TestToken.new();

        bountyFund = await BountyFund.new(testToken.address);
        testToken.mint(bountyFund.address, 100);

        const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
        resolutionEngine = await ResolutionEngine.new(oracle, bountyFund.address, bountyFraction);

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

    describe('stakeTokens()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.stakeTokens(accounts[2], 0, true, 100, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called on non-current verification phase number', () => {
            it('should revert', async () => {
                resolutionEngine.stakeTokens(accounts[2], 1, true, 100, {from: oracle}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            beforeEach(async () => {
                await testToken.mint(accounts[2], 100);
                await testToken.approve(resolutionEngine.address, 100, {from: accounts[2]});
            });

            it('should successfully stake tokens', async () => {
                const result = await resolutionEngine.stakeTokens(accounts[2], 0, true, 100, {from: oracle});
                result.logs[0].event.should.equal('TokensStaked');
            });
        });
    });

    describe('metricsByVerificationPhaseNumber()', () => {
        describe('if verification phase number is too large', () => {
            it('should revert', async () => {
                resolutionEngine.metricsByVerificationPhaseNumber.call(1).should.be.rejected;
            });
        });

        describe('if verification phase number is within bounds', () => {
            it('should return metrics of verification phase number', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumber.call(0);
                result.state.should.exist.and.eq.BN(1);
                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
                result.numberOfWallets.should.exist.and.eq.BN(0);
                result.bountyAmount.should.exist.and.be.eq.BN(10);
                result.bountyAwarded.should.exist.and.be.false;
                result.startBlock.should.exist.and.be.gt.BN(0);
                result.endBlock.should.exist.and.eq.BN(0);
                result.numberOfBlocks.should.exist.and.be.gt.BN(0);
            });
        });
    });

    describe('metricsByVerificationPhaseNumberAndWallet()', () => {
        describe('if verification phase number is too large', () => {
            it('should revert', async () => {
                resolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(1, Wallet.createRandom().address).should.be.rejected;
            });
        });

        describe('if verification phase number is within bounds', () => {
            it('should return metrics of verification phase number and wallet', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(0, Wallet.createRandom().address);
                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('metricsByWallet()', () => {
        it('should return metrics of wallet', async () => {
            const result = await resolutionEngine.metricsByWallet.call(Wallet.createRandom().address);
            result.trueStakeAmount.should.exist.and.eq.BN(0);
            result.falseStakeAmount.should.exist.and.eq.BN(0);
            result.stakeAmount.should.exist.and.eq.BN(0);
        });
    });

    describe('metricsByBlockNumber()', () => {
        describe('if block number is too large', () => {
            let blockNumber;

            beforeEach(async () => {
                blockNumber = await web3.eth.getBlockNumber();
            });

            it('should revert', async () => {
                resolutionEngine.metricsByBlockNumber.call(blockNumber * 2).should.be.rejected;
            });
        });

        describe('if block number is within bounds', () => {
            it('should return metrics of block number', async () => {
                const result = await resolutionEngine.metricsByBlockNumber.call(0);
                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('withdrawFromBountyFund()', () => {
        let mockedResolutionEngine, balanceBefore;

        beforeEach(async () => {
            bountyFund = await BountyFund.new(testToken.address);
            testToken.mint(bountyFund.address, 100);

            const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
            mockedResolutionEngine = await MockedResolutionEngine.new(oracle, bountyFund.address, bountyFraction);

            balanceBefore = await testToken.balanceOf.call(mockedResolutionEngine.address);
        });

        it('should successfully withdraw', async () => {
            await mockedResolutionEngine._withdrawFromBountyFund();

            (await testToken.balanceOf.call(mockedResolutionEngine.address)).should.eq.BN(balanceBefore.addn(9));
        });
    });

    describe('openVerificationPhase()', () => {
        describe('if verification phase is already opened', () => {
            let mockedResolutionEngine;

            beforeEach(async () => {
                bountyFund = await BountyFund.new(testToken.address);
                testToken.mint(bountyFund.address, 100);

                const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
                mockedResolutionEngine = await MockedResolutionEngine.new(oracle, bountyFund.address, bountyFraction);
            });

            it('should revert', async () => {
                mockedResolutionEngine._openVerificationPhase().should.be.rejected;
            });
        });
    });

    describe('closeVerificationPhase()', () => {
        let mockedResolutionEngine, verificationPhaseNumberBefore, bountyBalanceBefore;

        beforeEach(async () => {
            bountyFund = await BountyFund.new(testToken.address);
            testToken.mint(bountyFund.address, 100);

            const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
            mockedResolutionEngine = await MockedResolutionEngine.new(oracle, bountyFund.address, bountyFraction);

            verificationPhaseNumberBefore = await mockedResolutionEngine.verificationPhaseNumber.call();
            bountyBalanceBefore = await testToken.balanceOf.call(bountyFund.address);
        });

        describe('if verification status is unchanged', () => {
            it('should successfully close the verification phase without toggling verification status', async () => {
                await mockedResolutionEngine._closeVerificationPhase();

                const result = await mockedResolutionEngine.metricsByVerificationPhaseNumber(0);
                result.startBlock.should.exist.and.be.gt.BN(0);
                result.endBlock.should.exist.and.be.gt.BN(0);
                result.numberOfBlocks.should.exist.and.be.eq.BN(result.endBlock.sub(result.startBlock));
                result.bountyAwarded.should.exist.and.be.false;

                (await testToken.balanceOf.call(bountyFund.address)).should.eq.BN(bountyBalanceBefore);

                (await mockedResolutionEngine.verificationPhaseNumber.call()).should.be.eq.BN(verificationPhaseNumberBefore.addn(1));
            });
        });

        describe('if verification status is changed', () => {
            beforeEach(async () => {
                await testToken.mint(accounts[2], 100);
                await testToken.approve(mockedResolutionEngine.address, 100, {from: accounts[2]});
                await mockedResolutionEngine.stakeTokens(accounts[2], 0, true, 100, {from: oracle});
            });

            it('should successfully close the verification phase and toggle verification status', async () => {
                await mockedResolutionEngine._closeVerificationPhase();

                const result = await mockedResolutionEngine.metricsByVerificationPhaseNumber.call(0);
                result.startBlock.should.exist.and.be.gt.BN(0);
                result.endBlock.should.exist.and.be.gt.BN(0);
                result.numberOfBlocks.should.exist.and.be.eq.BN(result.endBlock.sub(result.startBlock));
                result.bountyAwarded.should.exist.and.be.true;

                (await testToken.balanceOf.call(bountyFund.address)).should.eq.BN(bountyBalanceBefore.subn(9));

                (await mockedResolutionEngine.verificationPhaseNumber.call()).should.be.eq.BN(verificationPhaseNumberBefore.addn(1));
            });
        });
    });
});
