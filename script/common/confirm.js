/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';

function deferredIsNotNull(promise) {
  return new Promise((resolve, reject) => {
    promise.then(res => {
      if (res !== null)
        resolve(res);
      else
        reject();
    });
  });
}

Promise.retry = function (attemptFn, times, delay) {
  return new Promise(function (resolve, reject) {
    let error;

    function attempt() {
      if (!times)
        return reject(error);

      attemptFn()
        .then(resolve)
        .catch(function (e) {
          times--;
          error = e;
          setTimeout(function () {
            attempt();
          }, delay);
        });
    }

    attempt();
  });
};

module.exports = (provider) => {
  return (txHash, timeout = 600) => {
    return Promise.retry(() => {
      return deferredIsNotNull(provider.getTransactionReceipt(txHash));
    }, Math.ceil(timeout), 1000)
      .then(result => {
        if (result.status === 0)
          throw new Error('Transaction failed');
        return result;
      });
  };
};
