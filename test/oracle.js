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
const TestToken = artifacts.require('TestToken');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');

contract('Oracle', (accounts) => {
    let oracle, testToken;

    beforeEach(async () => {
        oracle = await Oracle.deployed();
        testToken = await TestToken.new();
    });

    describe('constructor()', () => {
        it('should test successfully', async () => {
            oracle.address.should.have.lengthOf(42);
            const ownerRole = await oracle.OWNER_ROLE.call();
            (await oracle.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await oracle.isRoleAccessor.call(ownerRole, accounts[1])).should.not.be.true;
        });
    });

    describe('hasResolutionEngine()', () => {
        it('should test successfully', async () => {
            (await oracle.hasResolutionEngine.call(Wallet.createRandom().address)).should.be.false;
        });
    });

    describe('resolutionEnginesCount()', () => {
        it('should test successfully', async () => {
            (await oracle.resolutionEnginesCount.call()).should.eq.BN(0);
        });
    });

    describe('addResolutionEngine()', () => {
        let engineAddress;

        beforeEach(() => {
            engineAddress = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                oracle.addResolutionEngine(engineAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            it('should test successfully', async () => {
                const result = await oracle.addResolutionEngine(engineAddress);
                result.logs[0].event.should.equal('ResolutionEngineAdded');
                (await oracle.hasResolutionEngine.call(engineAddress)).should.be.true;
                (await oracle.resolutionEnginesCount.call()).should.eq.BN(1);
            });
        });
    });

    describe('removeResolutionEngine()', () => {
        let engineAddress1;

        beforeEach(() => {
            engineAddress1 = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                oracle.removeResolutionEngine(engineAddress1, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            let resolutionEnginesCount;

            describe('if removing the last address stored', () => {
                beforeEach(async () => {
                    await oracle.addResolutionEngine(engineAddress1);
                    resolutionEnginesCount = await oracle.resolutionEnginesCount.call();
                });

                it('should test successfully', async () => {
                    const result = await oracle.removeResolutionEngine(engineAddress1);
                    result.logs[0].event.should.equal('ResolutionEngineRemoved');
                    (await oracle.hasResolutionEngine.call(engineAddress1)).should.be.false;
                    (await oracle.resolutionEnginesCount.call()).should.eq.BN(resolutionEnginesCount.sub(web3.utils.toBN(1)));
                });
            });

            describe('if removing not the last address stored', () => {
                let engineAddress2;

                beforeEach(async () => {
                    engineAddress2 = Wallet.createRandom().address;

                    await oracle.addResolutionEngine(engineAddress1);
                    await oracle.addResolutionEngine(engineAddress2);
                    resolutionEnginesCount = await oracle.resolutionEnginesCount.call();
                });

                it('should test successfully', async () => {
                    const result = await oracle.removeResolutionEngine(engineAddress1);
                    result.logs[0].event.should.equal('ResolutionEngineRemoved');
                    (await oracle.hasResolutionEngine.call(engineAddress1)).should.be.false;
                    (await oracle.resolutionEnginesCount.call()).should.eq.BN(resolutionEnginesCount.sub(web3.utils.toBN(1)));
                });
            });
        });
    });

    describe('stakeTokens()', () => {
        describe('if called on non-registered resolution engine', () => {
            let resolutionEngineAddress;

            before(() => {
                resolutionEngineAddress = Wallet.createRandom().address;
            });

            it('should revert', async () => {
                oracle.stakeTokens(resolutionEngineAddress, 0, true, 100).should.be.rejected;
            });
        });

        describe('if called on registered resolution engine', () => {
            let mockedResolutionEngine;

            beforeEach(async () => {
                mockedResolutionEngine = await MockedResolutionEngine.new();
                await oracle.addResolutionEngine(mockedResolutionEngine.address);

                await testToken.mint(accounts[1], 100);
                await testToken.approve(oracle.address, 100, {from: accounts[1]});
            });

            afterEach(async () => {
                await oracle.removeResolutionEngine(mockedResolutionEngine.address);
            });

            it('should test successfully', async () => {
                const result = await oracle.stakeTokens(mockedResolutionEngine.address, 0, true, 100, {from: accounts[1]});
                result.logs[0].event.should.equal('TokensStaked');
                // TODO Solve issue that suggest couple of resolution engines (
                // (await mockedResolutionEngine.stakes.call(accounts[1], true)).should.eq.BN(100);
            });
        });
    });
});
