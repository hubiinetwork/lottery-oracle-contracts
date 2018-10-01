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
const Oracle = artifacts.require('Oracle');
const BountyFund = artifacts.require('BountyFund');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');

contract('*', (accounts) => {
    let testToken, oracle, bountyFund, naiveTotalResolutionEngine, balanceBeforeAccount1, balanceBeforeAccount2;

    describe('NaiveTotalResolutionEngine', () => {
        describe('initialize', () => {
            it('should initialize successfully', async () => {
                // Deploy test token
                testToken = await TestToken.new();

                // Mint tokens for default account
                await testToken.mint(accounts[0], 1000);

                // Deploy oracle
                oracle = await Oracle.new();

                // Deploy bounty fund
                bountyFund = await BountyFund.new(testToken.address);

                // Deposit tokens into bounty fund
                await testToken.approve(bountyFund.address, 1000);
                await bountyFund.depositTokens(1000);

                // Mint tokens for bounty fund (rather than depositing into it)
                // await testToken.mint(bountyFund.address, 1000);

                // Deploy naïve total resolution engine and register it with oracle
                const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
                naiveTotalResolutionEngine = await NaiveTotalResolutionEngine.new(
                    oracle.address, bountyFund.address, bountyFraction, 100
                );
                await oracle.addResolutionEngine(naiveTotalResolutionEngine.address);

                (await naiveTotalResolutionEngine.oracle.call()).should.equal(oracle.address);
                (await naiveTotalResolutionEngine.bountyFund.call()).should.equal(bountyFund.address);
                (await naiveTotalResolutionEngine.bountyFraction.call()).should.eq.BN(bountyFraction);

                (await oracle.hasResolutionEngine.call(naiveTotalResolutionEngine.address)).should.be.true;

                // Mint tokens for wallets and approve of
                await testToken.mint(accounts[1], 1000);
                await testToken.mint(accounts[2], 1000);
            })
        });

        describe('start of first verification phase', () => {
            it('should be properly initialized', async () => {
                (await naiveTotalResolutionEngine.verificationPhaseNumber.call()).should.eq.BN();
                (await naiveTotalResolutionEngine.verificationStatus.call()).should.eq.BN(0);
                (await naiveTotalResolutionEngine.bountyAmount.call()).should.eq.BN(100);
            });
        });

        describe('stake into first verification phase', () => {
            it('should stake successfully', async () => {
                balanceBeforeAccount1 = await testToken.balanceOf.call(accounts[1]);
                balanceBeforeAccount2 = await testToken.balanceOf.call(accounts[2]);

                // Approve of oracle staking for wallets
                await testToken.approve(oracle.address, 110, {from: accounts[1]});
                await testToken.approve(oracle.address, 20, {from: accounts[2]});

                // Stake below resolution criteria
                await oracle.stakeTokens(naiveTotalResolutionEngine.address, 0, true, 10, {from: accounts[1]});
                await oracle.stakeTokens(naiveTotalResolutionEngine.address, 0, false, 20, {from: accounts[2]});

                (await naiveTotalResolutionEngine.verificationPhaseNumber.call()).should.eq.BN(0);
                (await naiveTotalResolutionEngine.verificationStatus.call()).should.eq.BN(0);

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(0, accounts[1]))
                    .trueStakeAmount.should.eq.BN(10);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(0, accounts[2]))
                    .falseStakeAmount.should.eq.BN(20);

                // Stake above resolution criteria on the true status, thus close first verification phase
                // and change resolution engine's verification status
                await oracle.stakeTokens(naiveTotalResolutionEngine.address, 0, true, 100, {from: accounts[1]});

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(0, accounts[1]))
                    .trueStakeAmount.should.eq.BN(110);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(0, accounts[2]))
                    .falseStakeAmount.should.eq.BN(20);

                (await testToken.balanceOf.call(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(110));
                (await testToken.balanceOf.call(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(20));
            });
        });

        describe('start of second verification phase', () => {
            it('should be properly initialized', async () => {
                (await naiveTotalResolutionEngine.verificationPhaseNumber.call()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.verificationStatus.call()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.bountyAmount.call()).should.eq.BN(90);
            });
        });

        describe('stake into second verification phase', () => {
            it('should stake successfully', async () => {
                balanceBeforeAccount1 = await testToken.balanceOf.call(accounts[1]);
                balanceBeforeAccount2 = await testToken.balanceOf.call(accounts[2]);

                // Approve of oracle staking for wallets
                await testToken.approve(oracle.address, 10, {from: accounts[1]});
                await testToken.approve(oracle.address, 120, {from: accounts[2]});

                // Stake above resolution criteria on the false status, thus close the second verification phase
                // and change resolution engine's verification status
                await oracle.stakeTokens(naiveTotalResolutionEngine.address, 1, true, 10, {from: accounts[1]});
                await oracle.stakeTokens(naiveTotalResolutionEngine.address, 1, false, 120, {from: accounts[2]});

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(1, accounts[1]))
                    .trueStakeAmount.should.eq.BN(10);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(1, accounts[2]))
                    .falseStakeAmount.should.eq.BN(120);

                (await testToken.balanceOf.call(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(10));
                (await testToken.balanceOf.call(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(120));
            });
        });

        describe('start of third verification phase', () => {
            it('should be properly initialized', async () => {
                (await naiveTotalResolutionEngine.verificationPhaseNumber.call()).should.eq.BN(2);
                (await naiveTotalResolutionEngine.verificationStatus.call()).should.eq.BN(2);
                (await naiveTotalResolutionEngine.bountyAmount.call()).should.eq.BN(81);
            });
        });

        describe('claim payout', () => {
            it('should claim payout successfully', async () => {
                balanceBeforeAccount1 = await testToken.balanceOf.call(accounts[1]);
                balanceBeforeAccount2 = await testToken.balanceOf.call(accounts[2]);

                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber.call(0)).bountyAwarded.should.be.true;
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber.call(1)).bountyAwarded.should.be.true;

                (await oracle.claimPayout(naiveTotalResolutionEngine.address, 0, 1, {from: accounts[1]}));
                (await oracle.claimPayout(naiveTotalResolutionEngine.address, 0, 1, {from: accounts[2]}));

                // Payout claimed for account[1]:
                // phase1: 100% * (bounty of 100 + opposite stake of 20) + own stake of 110
                // phase2: 0
                (await testToken.balanceOf.call(accounts[1])).should.eq.BN(balanceBeforeAccount1.addn(100 + 20 + 110));

                // Payout claimed for account[2]:
                // phase1: 0
                // phase2: 100% * (bounty of 90 + opposite stake of 10) + own stake of 120
                (await testToken.balanceOf.call(accounts[2])).should.eq.BN(balanceBeforeAccount2.addn(90 + 10 + 120));
            });
        });
    });
});