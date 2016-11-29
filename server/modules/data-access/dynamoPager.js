/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

/**
 * Aggregate paged DynamoDB results into a single promise.
 * @param {Object} awsRequest - an AWS.Request object http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Request.html.
 * @returns {Promise} - a promise of an Array of items.
 */
function promiseAllItems(awsRequest) {
  return new Promise((resolve, reject) => {
    let acc = [];
    awsRequest.eachPage((error, page) => {
      if (error) {
        reject(error);
      }
      if (page === null) {
        resolve(acc);
      } else {
        (page.Items || []).forEach(item => acc.push(item));
      }
    });
  });
}

module.exports = {
  promiseAllItems,
};
