'use strict';

let awsAccounts = require('modules/awsAccounts');
let fp = require('lodash/fp');
let logger = require('modules/logger');

/**
 * Calls fun with each account as its argument and returns a Promise
 * of an array of the results.
 * @param {Function} fun - the function to call for each account.
 * @returns {Promise} - A promise of an array of the results.
 */
function eachAccount(fun) {
  return awsAccounts.all().then(accounts =>
        Promise.all(
          fp.flow(
            fp.sortBy(x => !x.IsMaster),
            fp.map((account) => {
              let accountNumber = `${account.AccountNumber}`;
              return Promise.resolve(accountNumber).then(fun)
              .then(
                value => ({ account: accountNumber, value }),
                error => Promise.resolve({ error, account: accountNumber }));
            }))(accounts)));
}

function isError(result) {
  return Object.prototype.hasOwnProperty.call(result, 'error');
}

/**
 * filter any errors from the input and log them as warnings.
 * @param {Array} results - an array of objects with keys {account, error|value}.
 * @returns {Array} - an array of objects with keys {account, value}.
 */
function ignoreErrors(results) {
  function logError(result) {
    if (isError(result)) {
      let accountNumber = fp.get(['account'])(result);
      logger.warn(`failure in account ${accountNumber}`);
      logger.warn(result.error);
    }
    return result;
  }

  return results.map(logError).filter(x => !isError(x));
}

function throwErrors(results) {
  function throwError(result) {
    if (isError(result)) {
      throw result.error;
    }
    return result;
  }
  return results.map(throwError);
}

function flatten(results) {
  return fp.flow(fp.map(({ account, value }) => fp.map(v => ({ value: v, account }))(value)), fp.flatten)(results);
}

module.exports = {
  eachAccount,
  flatten,
  ignoreErrors,
  throwErrors,
};
