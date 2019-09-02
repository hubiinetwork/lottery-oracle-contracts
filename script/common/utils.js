/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

const unlockedMap = new Map();
const unlockTimeInSeconds = typeof process.env.ETH_UNLOCK_SECONDS === 'undefined' ?
    7200 :
    Number.parseInt(process.env.ETH_UNLOCK_SECONDS);

const isTestNetwork = (network) => {
    return network.includes('develop') || network.includes('test') || network.includes('ganache');
};

const getNetworkCredentials = () => {
    return {account: process.env.ETH_TESTNET_ACCOUNT, secret: process.env.ETH_TESTNET_SECRET};
};

const unlockAccount = async (web3, account, password) => {
    if (!unlockedMap.get(account)) {
        unlockedMap.set(account, true);

        console.log(`Unlocking account ${account}...`);
        await web3.eth.personal.unlockAccount(account, password, unlockTimeInSeconds);

        await timeout(3000);
    }

    const lockAccount = async () => {
        if (unlockedMap.get(account)) {
            unlockedMap.set(account, false);

            console.log(`Locking account ${account}...`);
            await web3.eth.personal.lockAccount(account);
        }
    };

    ['exit', 'SIGINT', 'SIGTERM'].forEach((eventType) => {
        process.on(eventType, lockAccount);
    });
};

exports.initializeOwnerAccount = async (web3, network, accounts) => {
    let ownerAccount;
    if (isTestNetwork(network))
        ownerAccount = accounts[0];
    else {
        const {account, secret} = getNetworkCredentials();
        await unlockAccount(web3, account, secret);
        ownerAccount = account;
    }
    return ownerAccount;
};

exports.getNaiveTotalCriterionAmountStaked = () => {
    return process.env.NAIVE_TOTAL_CRITERION_AMOUNT_STAKED || 1000;
};

const timeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
