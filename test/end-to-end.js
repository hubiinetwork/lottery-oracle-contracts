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

const StakeToken = artifacts.require('StakeToken');
const Oracle = artifacts.require('Oracle');
const BountyFund = artifacts.require('BountyFund');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');

contract('*', (accounts) => {
    let stakeToken, oracle, bountyFund, naiveTotalResolutionEngine, balanceBeforeAccount1, balanceBeforeAccount2;

    describe('NaiveTotalResolutionEngine', () => {
        describe('initialize', () => {
            it('should initialize successfully', async () => {
                // Deploy test token
                stakeToken = await StakeToken.new('hubiit', 'HBT', 15);

                // Mint tokens for default account
                await stakeToken.mint(accounts[0], 1000);

                // Deploy oracle
                oracle = await Oracle.new();

                // Deploy bounty fund
                bountyFund = await BountyFund.new(stakeToken.address);

                // Deposit tokens into bounty fund
                await stakeToken.approve(bountyFund.address, 1000);
                await bountyFund.depositTokens(1000);

                // Deploy naïve total resolution engine and register it with oracle
                const bountyFraction = (await bountyFund.PARTS_PER()).divn(10);
                naiveTotalResolutionEngine = await NaiveTotalResolutionEngine.new(
                    oracle.address, bountyFund.address, bountyFraction, 100
                );
                await oracle.addResolutionEngine(naiveTotalResolutionEngine.address);

                (await naiveTotalResolutionEngine.oracle()).should.equal(oracle.address);
                (await naiveTotalResolutionEngine.bountyFund()).should.equal(bountyFund.address);
                (await naiveTotalResolutionEngine.bounty()).fraction.should.eq.BN(bountyFraction);

                (await oracle.hasResolutionEngine(naiveTotalResolutionEngine.address)).should.be.true;

                // Mint tokens for wallets and approve of oracle transferring
                await stakeToken.mint(accounts[1], 1000);
                await stakeToken.approve(oracle.address, 1000, {from: accounts[1]});
                await stakeToken.mint(accounts[2], 1000);
                await stakeToken.approve(oracle.address, 1000, {from: accounts[2]});
            })
        });

        describe('stake into first verification phase below resolution criteria', () => {
            before(async () => {
                balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
                balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);

                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(0);
                (await naiveTotalResolutionEngine.bounty()).amount.should.eq.BN(100);

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
                    .trueStakeAmount.should.eq.BN(0);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
                    .falseStakeAmount.should.eq.BN(0);
            });

            it('should stake successfully', async () => {
                await oracle.stake(naiveTotalResolutionEngine.address, 1, true, 10, {from: accounts[1]});
                await oracle.stake(naiveTotalResolutionEngine.address, 1, false, 20, {from: accounts[2]});
            });

            after(async () => {
                (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(10));
                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(20));

                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(0);
                (await naiveTotalResolutionEngine.bounty()).amount.should.eq.BN(100);

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
                    .trueStakeAmount.should.eq.BN(10);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
                    .falseStakeAmount.should.eq.BN(20);
            });
        });

        describe('stake into first verification phase and surpass resolution criteria', () => {
            before(async () => {
                balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
                balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);

                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(0);
                (await naiveTotalResolutionEngine.bounty()).amount.should.eq.BN(100);

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
                    .trueStakeAmount.should.eq.BN(10);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
                    .falseStakeAmount.should.eq.BN(20);
            });

            it('should stake successfully', async () => {
                // Stake above resolution criteria on the true status, thus close first verification phase
                // and change resolution engine's verification status
                await oracle.stake(naiveTotalResolutionEngine.address, 1, true, 100, {from: accounts[1]});
            });

            after(async () => {
                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(2);
                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.bounty()).amount.should.eq.BN(90);

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
                    .trueStakeAmount.should.eq.BN(100);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
                    .falseStakeAmount.should.eq.BN(20);

                (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(100));
                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2);
            });
        });

        describe('stake into second verification phase and surpass resolution criteria', () => {
            before(async () => {
                balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
                balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);

                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(2);
                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.bounty()).amount.should.eq.BN(90);

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[1]))
                    .trueStakeAmount.should.eq.BN(0);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[2]))
                    .falseStakeAmount.should.eq.BN(0);
            });

            it('should stake successfully', async () => {
                // Stake above resolution criteria on the false status, thus close the second verification phase
                // and change resolution engine's verification status
                await oracle.stake(naiveTotalResolutionEngine.address, 2, true, 10, {from: accounts[1]});
                await oracle.stake(naiveTotalResolutionEngine.address, 2, false, 120, {from: accounts[2]});
            });

            after(async () => {
                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(3);
                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(2);
                (await naiveTotalResolutionEngine.bounty()).amount.should.eq.BN(81);

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[1]))
                    .trueStakeAmount.should.eq.BN(10);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[2]))
                    .falseStakeAmount.should.eq.BN(100);

                (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(10));
                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(120));
            });
        });

        describe('stage payout', () => {
            before(async () => {
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAwarded.should.be.true;
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(2)).bountyAwarded.should.be.true;
            });

            it('should stage payout successfully', async () => {
                (await oracle.stagePayout(naiveTotalResolutionEngine.address, 1, 2, {from: accounts[1]}));
                (await oracle.stagePayout(naiveTotalResolutionEngine.address, 1, 2, {from: accounts[2]}));
            });

            after(async () => {
                // Payout staged for account[1]:
                // phase1: 100% * (bounty of 100 + opposite stake of 20) + own stake of 110
                // phase2: 0
                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[1])).should.eq.BN(100 + 20 + 110);

                // Payout staged for account[2]:
                // phase1: 0
                // phase2: 100% * (bounty of 90 + opposite stake of 10) + own stake of 120
                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(90 + 10 + 120);
            });
        });

        describe('withdraw', () => {
            let stagedAmountBeforeAccount1, stagedAmountBeforeAccount2;

            before(async () => {
                balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
                balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);

                stagedAmountBeforeAccount1 = await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[1]);
                stagedAmountBeforeAccount2 = await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[2]);
            });

            it('should stage payout successfully', async () => {
                (await oracle.withdraw(naiveTotalResolutionEngine.address, 100, {from: accounts[1]}));
                (await oracle.withdraw(naiveTotalResolutionEngine.address, 100, {from: accounts[2]}));
            });

            after(async () => {
                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[1])).should.eq.BN(stagedAmountBeforeAccount1.subn(100));
                (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.addn(100));

                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(stagedAmountBeforeAccount2.subn(100));
                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.addn(100));
            });
        });
    });
});
