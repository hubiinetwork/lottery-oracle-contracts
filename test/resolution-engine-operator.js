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

const ResolutionEngineOperator = artifacts.require('ResolutionEngineOperator');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');

contract('ResolutionEngineOperator', (accounts) => {
    let provider, operator, mockedResolutionEngine;

    beforeEach(async () => {
        provider = (new providers.Web3Provider(web3.currentProvider)).getSigner(accounts[0]).provider;

        operator = await ResolutionEngineOperator.new(2);
        mockedResolutionEngine = await MockedResolutionEngine.new(
            Wallet.createRandom().address, Wallet.createRandom().address, 10
        );
    });

    describe('constructor()', () => {
        it('should successfully initialize', async () => {
            operator.address.should.have.lengthOf(42);
            const ownerRole = await operator.OWNER_ROLE();
            (await operator.isRoleAccessor(ownerRole, accounts[0])).should.be.true;
            (await operator.isRoleAccessor(ownerRole, accounts[1])).should.be.false;
        });
    });

    describe('startTeardownTimer()', () => {
        describe('if called by non-owner', () => {
            it('should revert', async () => {
                operator.startTeardownTimer(
                    Wallet.createRandom().address, 10, {from: accounts[1]}
                ).should.be.rejected;
            });
        });

        describe('if called by with timeout param less than the minimum', () => {
            it('should revert', async () => {
                operator.startTeardownTimer(
                    Wallet.createRandom().address, 1, {from: accounts[0]}
                ).should.be.rejected;
            });
        });

        describe('if called by with timeout param greater than or equal to the minimum', () => {
            let resolutionEngine;

            beforeEach(() => {
               resolutionEngine = Wallet.createRandom().address;
            });

            it('should successfully start the teardown timer', async () => {
                const result = await operator.startTeardownTimer(
                    resolutionEngine, 2
                );

                result.logs[0].event.should.equal('TeardownTimerStarted');

                const blockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
                (await operator.teardownTimeoutByResolutionEngine(
                    resolutionEngine
                )).should.eq.BN(blockTimestamp + 2);
            });
        });
    });

    describe('isTeardownTimerExpired()', () => {
        let resolutionEngine;

        beforeEach(async () => {
            resolutionEngine = Wallet.createRandom().address;
            await operator.startTeardownTimer(resolutionEngine, 2);
        });

        describe('if called before teardown timer has expired', () => {
            it('should return false', async () => {
                (await operator.isTeardownTimerExpired(resolutionEngine)).should.be.false;
            });
        });

        describe('if called after teardown timer has expired', () => {
            beforeEach(async () => {
                // TODO Factor this fast forward out into separate function in ./helpers.js
                await provider.send('evm_increaseTime', [3]);
                await provider.send('evm_mine');
            });

            it('should return true', async () => {
                (await operator.isTeardownTimerExpired(resolutionEngine)).should.be.true;
            });
        });
    });
});
