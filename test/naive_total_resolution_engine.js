/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {Wallet, providers} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const StakeToken = artifacts.require('StakeToken');
const BountyFund = artifacts.require('BountyFund');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');

contract('NaiveTotalResolutionEngine', (accounts) => {
    let provider, oracleAddress, stakeToken, resolutionEngine, ownerRole, oracleRole, bountyFund, bountyFraction;

    beforeEach(async () => {
        provider = (new providers.Web3Provider(web3.currentProvider)).getSigner(accounts[0]).provider;

        oracleAddress = accounts[1];
        stakeToken = await StakeToken.new('hubiit', 'HBT', 15);

        bountyFund = await BountyFund.new(stakeToken.address);
        await stakeToken.mint(bountyFund.address, 100);

        bountyFraction = (await bountyFund.PARTS_PER()).divn(10);
        resolutionEngine = await NaiveTotalResolutionEngine.new(oracleAddress, bountyFund.address, bountyFraction, 100);

        ownerRole = await resolutionEngine.OWNER_ROLE();
        oracleRole = await resolutionEngine.ORACLE_ROLE();
    });

    describe('constructor()', () => {
        it('should successfully initialize', async () => {
            // TODO Add tests on events emitted at construction time

            (await resolutionEngine.isRoleAccessor(ownerRole, accounts[0])).should.be.true;
            (await resolutionEngine.isRoleAccessor(ownerRole, accounts[1])).should.be.false;
            (await resolutionEngine.isRoleAccessor(oracleRole, accounts[0])).should.be.false;
            (await resolutionEngine.isRoleAccessor(oracleRole, accounts[1])).should.be.true;
            (await resolutionEngine.bountyFraction()).should.be.eq.BN(bountyFraction);
            (await resolutionEngine.bountyAmount()).should.be.eq.BN(10);
            (await resolutionEngine.verificationPhaseNumber()).should.be.eq.BN(1);

            (await stakeToken.balanceOf(resolutionEngine.address))
                .should.eq.BN(10);
        });
    });

    describe('updateMetrics()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.updateMetrics(accounts[2], true, 100, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            it('should successfully update metrics', async () => {
                const result = await resolutionEngine.updateMetrics(accounts[2], true, 100, {from: oracleAddress});
                result.logs[0].event.should.equal('MetricsUpdated');
            });
        });
    });

    describe('resolutionCriteriaMet()', () => {
        describe('if resolution criteria have not been met', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], false, 20, {from: oracleAddress});
            });

            it('should return false', async () => {
                (await resolutionEngine.resolutionCriteriaMet()).should.be.false;
            });
        });

        describe('if resolution criteria have been met on true status', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], true, 110, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], false, 20, {from: oracleAddress});
            });

            it('should return true', async () => {
                (await resolutionEngine.resolutionCriteriaMet()).should.be.true;
            });
        });

        describe('if resolution criteria have been met on false status', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], false, 120, {from: oracleAddress});
            });

            it('should return true', async () => {
                (await resolutionEngine.resolutionCriteriaMet()).should.be.true;
            });
        });
    });

    describe('metricsByVerificationPhaseNumber()', () => {
        describe('if verification phase has opened', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], false, 20, {from: oracleAddress});
            });

            it('should return metrics of started verification phase', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumber(1);

                result.state.should.exist.and.eq.BN(1);
                result.trueStakeAmount.should.exist.and.eq.BN(10);
                result.falseStakeAmount.should.exist.and.eq.BN(20);
                result.stakeAmount.should.exist.and.eq.BN(30);
                result.numberOfWallets.should.exist.and.eq.BN(2);
                result.bountyAmount.should.exist.and.be.eq.BN(10);
                result.bountyAwarded.should.exist.and.be.false;
                result.startBlock.should.exist.and.be.gt.BN(0);
                result.endBlock.should.exist.and.eq.BN(0);
                result.numberOfBlocks.should.exist.and.eq.BN(2);
            });
        });

        describe('if verification phase has not opened', () => {
            it('should return metrics with default values', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumber(2);

                result.state.should.exist.and.eq.BN(0);
                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
                result.numberOfWallets.should.exist.and.eq.BN(0);
                result.bountyAmount.should.exist.and.be.eq.BN(0);
                result.bountyAwarded.should.exist.and.be.false;
                result.startBlock.should.exist.and.eq.BN(0);
                result.endBlock.should.exist.and.eq.BN(0);
                result.numberOfBlocks.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('metricsByVerificationPhaseNumberAndWallet()', () => {
        describe('if verification phase has opened', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[2], false, 20, {from: oracleAddress});
            });

            it('should return metrics of started verification phase', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]);

                result.trueStakeAmount.should.exist.and.eq.BN(10);
                result.falseStakeAmount.should.exist.and.eq.BN(20);
                result.stakeAmount.should.exist.and.eq.BN(30);
            });
        });

        describe('if verification phase has not opened', () => {
            it('should return metrics with default values', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, Wallet.createRandom().address);

                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('metricsByWallet()', () => {
        beforeEach(async () => {
            await resolutionEngine.updateMetrics(accounts[2], true, 10, {from: oracleAddress});
            await resolutionEngine.updateMetrics(accounts[2], false, 20, {from: oracleAddress});
        });

        it('should return metrics of wallet', async () => {
            const result = await resolutionEngine.metricsByWallet(accounts[2]);

            result.trueStakeAmount.should.exist.and.eq.BN(10);
            result.falseStakeAmount.should.exist.and.eq.BN(20);
            result.stakeAmount.should.exist.and.eq.BN(30);
        });
    });

    describe('metricsByBlockNumber()', () => {
        let blockNumber;

        beforeEach(async () => {
            await resolutionEngine.updateMetrics(accounts[2], true, 10, {from: oracleAddress});
            await resolutionEngine.updateMetrics(accounts[2], false, 20, {from: oracleAddress});

            blockNumber = await provider.getBlockNumber();
        });

        it('should return metrics of block number', async () => {
            const result1 = await resolutionEngine.metricsByBlockNumber(blockNumber - 1);

            result1.trueStakeAmount.should.exist.and.eq.BN(10);
            result1.falseStakeAmount.should.exist.and.eq.BN(0);
            result1.stakeAmount.should.exist.and.eq.BN(10);

            const result2 = await resolutionEngine.metricsByBlockNumber(blockNumber);

            result2.trueStakeAmount.should.exist.and.eq.BN(0);
            result2.falseStakeAmount.should.exist.and.eq.BN(20);
            result2.stakeAmount.should.exist.and.eq.BN(20);
        });
    });

    describe('resolveIfCriteriaMet()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.resolveIfCriteriaMet({from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called when resolution criteria are not met', () => {
            it('should not resolve', async () => {
                const result = await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});

                result.logs.should.be.empty;

                (await resolutionEngine.verificationPhaseNumber()).should.be.eq.BN(1);

                (await resolutionEngine.metricsByVerificationPhaseNumber(1)).state.should.eq.BN(1);
                (await resolutionEngine.metricsByVerificationPhaseNumber(2)).state.should.eq.BN(0);
            });
        });

        describe('if called when resolution criteria are met', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], true, 110, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], false, 20, {from: oracleAddress});
            });

            it('should successfully resolve', async () => {
                const result = await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});

                result.logs.map(l => l.event).should.include('VerificationPhaseOpened');
                result.logs.map(l => l.event).should.include('Resolved');
                result.logs.map(l => l.event).should.include('VerificationPhaseClosed');

                (await resolutionEngine.verificationPhaseNumber()).should.be.eq.BN(2);

                (await resolutionEngine.metricsByVerificationPhaseNumber(1)).state.should.eq.BN(2);
                (await resolutionEngine.metricsByVerificationPhaseNumber(2)).state.should.eq.BN(1);
            });
        });
    });

    describe('calculatePayout()', () => {
        describe('if resolution result is null-status', () => {
            it('should return 0', async () => {
                (await resolutionEngine.calculatePayout(0, Wallet.createRandom().address))
                    .should.eq.BN(0);
            });
        });

        // 2nd scenario in https://docs.google.com/document/d/1o_8BCMLXMNzEJ4uovZdeYUkEmRJPktf_fi55jylJ24w/edit#heading=h.e522u33ktgp6
        describe('if bounty was awarded', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], true, 90, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[4], false, 50, {from: oracleAddress});

                await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});
            });

            it('should return 0', async () => {
                (await resolutionEngine.calculatePayout(1, accounts[2]))
                    .should.eq.BN(16); // Including 10 tokens staked
            });
        });

        // 1st scenario in https://docs.google.com/document/d/1o_8BCMLXMNzEJ4uovZdeYUkEmRJPktf_fi55jylJ24w/edit#heading=h.e522u33ktgp6
        describe('if bounty was not awarded', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], true, 100, {from: oracleAddress});

                await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});

                await resolutionEngine.updateMetrics(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], true, 90, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[4], false, 50, {from: oracleAddress});

                await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});
            });

            it('should return 0', async () => {
                (await resolutionEngine.calculatePayout(2, accounts[2]))
                    .should.eq.BN(15); // Including 10 tokens staked
            });
        });
    });

    describe('stagePayout()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.stagePayout(accounts[2], 0, 0, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            beforeEach(async () => {
                await resolutionEngine.updateMetrics(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[3], true, 90, {from: oracleAddress});
                await resolutionEngine.updateMetrics(accounts[4], false, 50, {from: oracleAddress});
            });

            describe('if called on verification phase that has not closed', () => {
                it('should stage 0', async () => {
                    await resolutionEngine.stagePayout(accounts[2], 1, 1, {from: oracleAddress});

                    (await resolutionEngine.walletStagedAmountMap(accounts[2])).should.eq.BN(0);
                });
            });

            describe('if called the first time on verification phase that has closed', () => {
                beforeEach(async () => {
                    await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});
                });

                it('should successfully withdraw payout', async () => {
                    await resolutionEngine.stagePayout(accounts[2], 1, 1, {from: oracleAddress});

                    (await resolutionEngine.walletStagedAmountMap(accounts[2])).should.eq.BN(16);
                });
            });

            describe('if called the second time on verification phase that has closed', () => {
                beforeEach(async () => {
                    await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});

                    await resolutionEngine.stagePayout(accounts[2], 1, 1, {from: oracleAddress});
                });

                it('should withdraw 0', async () => {
                    await resolutionEngine.stagePayout(accounts[2], 1, 1, {from: oracleAddress});

                    (await resolutionEngine.walletStagedAmountMap(accounts[2])).should.eq.BN(16);
                });
            });
        });
    });

    describe('stage()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.stage(accounts[2], 100, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            it('should successfully stage', async () => {
                const result = await resolutionEngine.stage(accounts[2], 100, {from: oracleAddress});
                result.logs[0].event.should.equal('Staged');
                (await resolutionEngine.walletStagedAmountMap(accounts[2])).should.eq.BN(100);
            });
        });
    });

    describe('withdraw()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.withdraw(accounts[2], 100, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called with amount greater than staged amount', () => {
            it('should revert', async () => {
                (await resolutionEngine.walletStagedAmountMap(accounts[2])).should.eq.BN(0);

                resolutionEngine.withdraw(accounts[2], 100, {from: oracleAddress}).should.be.rejected;
            });
        });

        describe('if called with amount smaller or equal to staged amount', () => {
            beforeEach(async () => {
                await resolutionEngine.stage(accounts[2], 100, {from: oracleAddress});

                await stakeToken.mint(resolutionEngine.address, 100);
            });

            it('should successfully withdraw', async () => {
                const result = await resolutionEngine.withdraw(accounts[2], 40, {from: oracleAddress});
                result.logs[0].event.should.equal('Withdrawn');

                (await resolutionEngine.walletStagedAmountMap(accounts[2])).should.eq.BN(60);

                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(40);
            });
        });
    });
});
