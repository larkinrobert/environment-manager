/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

/* eslint func-names: 0, import/no-extraneous-dependencies: 0, prefer-arrow-callback: 0 */

'use strict';

let proxyquire = require('proxyquire').noCallThru();
let should = require('should');
let sinon = require('sinon');

let accounts = [
    {
        AccountName: 'master',
        AccountNumber: 1,
        IsMaster: true,
    },
    {
        AccountName: 'child',
        AccountNumber: 2,
        IsMaster: false,
    }
];

let master = `${accounts[0].AccountNumber}`;
let child = `${accounts[1].AccountNumber}`;

describe('crossAccount', function () {
    describe('eachAccount', function () {
        let sut;
        before(function () {
            sut = proxyquire('modules/data-access/crossAccount', {
                'modules/awsAccounts': {
                    all: () => Promise.resolve(accounts),
                },
                'modules/logger': {
                    warn: () => undefined,
                }
            })
        })
        it('when the input function returns a value the result contains the value and its account', function () {
            return sut.eachAccount(account => account).should.finally.eql([
                { account: master, value: master },
                { account: child, value: child },
            ])
        });
        it('when the input function returns a resolved promise the result contains the value and its account', function () {
            return sut.eachAccount(account => Promise.resolve(account)).should.finally.eql([
                { account: master, value: master },
                { account: child, value: child },
            ])
        });
        it('when the input function throws an error the result contains the error and its account', function () {
            return sut.eachAccount(account => { throw new Error(account); }).should.finally.match([
                { account: master, error: /0/ },
                { account: child, error: /1/ },
            ])
        });
        it('when the input function returns a rejected promise the result contains the error and its account', function () {
            return sut.eachAccount(account => Promise.reject(new Error(account))).should.finally.match([
                { account: master, error: /0/ },
                { account: child, error: /1/ },
            ])
        });
    });
    describe('ignoreErrors', function () {
        let sut;
        let logger = { warn: sinon.spy(() => undefined) };
        beforeEach(function () {
            sut = proxyquire('modules/data-access/crossAccount', {
                'modules/awsAccounts': {},
                'modules/logger': logger
            })
        })
        it('logs a warning for each error', function () {
            let error = new Error('oops');
            sut.ignoreErrors([{ account: 123, error }]);
            sinon.assert.calledWith(logger.warn, sinon.match(/123/));
            sinon.assert.calledWith(logger.warn, sinon.match(error));
        })
        it('returns only non-error results', function () {
            let result = sut.ignoreErrors([
                { account: undefined, error: undefined },
                { account: undefined, value: undefined }
            ]);
            result.should.match([{ account: undefined, value: undefined }]);
        })
    })
});
