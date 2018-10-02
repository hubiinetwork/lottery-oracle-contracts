/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const unlockedMap = new Map();
const unlockTimeInSeconds = 7200;

const isTestNetwork = (network) => {
    return network.includes('develop') || network.includes('test') || network.includes('ganache');
};

const getNetworkCredentials = () => {
    return {wallet: process.env.ETH_TESTNET_ACCOUNT, password: process.env.ETH_TESTNET_SECRET};
};

const unlockOwnerAccount = async (account, password) => {
    await web3.eth.personal.unlockAccount(account, password, unlockTimeInSeconds);
    unlockedMap.set(account, true);
};

exports.initializeOwnerAccount = async (network, accounts) => {
    let ownerAccount;
    if (isTestNetwork(network))
        ownerAccount = accounts[0];
    else {
        const credentials = getNetworkCredentials();
        await unlockOwnerAccount(credentials.wallet, credentials.password);
        ownerAccount = credentials.wallet;
    }
    return ownerAccount;
};

exports.finalizeAccount = async (account) => {
    if (unlockedMap.get(account))
        await web3.eth.personal.lockAccount(account);
};

exports.getBountyDivisor = () => {
    return typeof process.env.NAIVE_TOTAL_BOUNTY_DIVISOR == 'undefined' ?
        10 :
        Number.parseInt(process.env.NAIVE_TOTAL_BOUNTY_DIVISOR);
};

exports.getNaiveTotalCriterionAmountStaked = () => {
    return process.env.NAIVE_TOTAL_CRITERION_AMOUNT_STAKED || 1000;
};
