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
        mockedResolutionEngine = await MockedResolutionEngine.new();
    });

    describe('constructor()', () => {
        it('should successfully initialize', async () => {
            operator.address.should.have.lengthOf(42);
            const ownerRole = await operator.OWNER_ROLE();
            (await operator.isRoleAccessor(ownerRole, accounts[0])).should.be.true;
            (await operator.isRoleAccessor(ownerRole, accounts[1])).should.be.false;
        });
    });

    describe('startDisablementTimer()', () => {
        describe('if called by non-owner', () => {
            it('should revert', async () => {
                operator.startDisablementTimer(
                    Wallet.createRandom().address, 10, {from: accounts[1]}
                ).should.be.rejected;
            });
        });

        describe('if called by with timeout param less than the minimum', () => {
            it('should revert', async () => {
                operator.startDisablementTimer(
                    Wallet.createRandom().address, 1, {from: accounts[0]}
                ).should.be.rejected;
            });
        });

        describe('if called by with timeout param greater than or equal to the minimum', () => {
            it('should successfully start the disablement timer and disable staking', async () => {
                const result = await operator.startDisablementTimer(
                    mockedResolutionEngine.address, 2
                );

                result.logs[0].event.should.equal('DisablementTimerStarted');

                (await mockedResolutionEngine._disabledAction()).should.equal(
                    await mockedResolutionEngine.STAKE_ACTION()
                );

                const blockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
                (await operator.disablementTimeoutByResolutionEngine(
                    mockedResolutionEngine.address
                )).should.eq.BN(blockTimestamp + 2);
            });
        });
    });

    describe('stopDisablementTimer()', () => {
        describe('if called by non-owner', () => {
            it('should revert', async () => {
                operator.stopDisablementTimer(
                    Wallet.createRandom().address, {from: accounts[1]}
                ).should.be.rejected;
            });
        });

        describe('if called by with timeout param less than the minimum', () => {
            it('should revert', async () => {
                operator.stopDisablementTimer(
                    Wallet.createRandom().address, {from: accounts[0]}
                ).should.be.rejected;
            });
        });

        describe('if called by with timeout param greater than or equal to the minimum', () => {
            it('should successfully start the disablement timer and disable staking', async () => {
                const result = await operator.stopDisablementTimer(
                    mockedResolutionEngine.address
                );

                result.logs[0].event.should.equal('DisablementTimerStopped');

                (await mockedResolutionEngine._enabledAction()).should.equal(
                    await mockedResolutionEngine.STAKE_ACTION()
                );

                (await operator.disablementTimeoutByResolutionEngine(
                    mockedResolutionEngine.address
                )).should.eq.BN(0);
            });
        });
    });

    describe('isDisablementTimerExpired()', () => {
        beforeEach(async () => {
            await operator.startDisablementTimer(mockedResolutionEngine.address, 2);
        });

        describe('if called before disablement timer has expired', () => {
            it('should return false', async () => {
                (await operator.isDisablementTimerExpired(mockedResolutionEngine.address))
                    .should.be.false;
            });
        });

        describe('if called after disablement timer has expired', () => {
            beforeEach(async () => {
                // TODO Factor this fast forward out into separate function in ./helpers.js
                await provider.send('evm_increaseTime', [3]);
                await provider.send('evm_mine');
            });

            it('should return true', async () => {
                (await operator.isDisablementTimerExpired(mockedResolutionEngine.address))
                    .should.be.true;
            });
        });
    });

    describe('disable()', () => {
        beforeEach(async () => {
            await operator.startDisablementTimer(mockedResolutionEngine.address, 2);
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                operator.disable(mockedResolutionEngine.address, {from: accounts[1]})
                    .should.be.rejected;
            });
        });

        describe('if called before disablement timer has expired', () => {
            it('should revert', async () => {
                operator.disable(mockedResolutionEngine.address).should.be.rejected;
            });
        });

        describe('if called after disablement timer has expired', () => {
            beforeEach(async () => {
                // TODO Factor this fast forward out into separate function in ./helpers.js
                await provider.send('evm_increaseTime', [3]);
                await provider.send('evm_mine');
            });

            it('should successfully tear down the resolution engine', async () => {
                const result = await operator.disable(mockedResolutionEngine.address);

                result.logs[0].event.should.equal('Disabled');

                (await mockedResolutionEngine._disabledAction()).should.equal(
                    await mockedResolutionEngine.RESOLVE_ACTION()
                );
            });
        });
    });
});
