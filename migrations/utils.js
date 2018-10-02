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

const getCredentialsFromEnvironment = () => {
    return {wallet: process.env.MIGRATE_WALLET, password: process.env.MIGRATE_PASSWORD};
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
        const credentials = getCredentialsFromEnvironment();
        await unlockOwnerAccount(credentials.wallet, credentials.password);
        ownerAccount = credentials.wallet;
    }
    return ownerAccount;
};

exports.finalizeAccount = async (account) => {
    if (unlockedMap.get(account))
        await web3.eth.personal.lockAccount(account);
};