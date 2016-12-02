/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let clock = require('modules/clock');
let logger = require('modules/logger');
let LRU = require('lru-cache');
let masterAccountClient = require('modules/amazon-client/masterAccountClient');
let fp = require('lodash/fp');
let s3Url = require('modules/amazon-client/s3url');

let cache = LRU({
  length: (n, key) => n.response.Body.length || 1, // Size of entry is value of its length property.
  max: 1 * 1024 * 1024, // Max size
});

function create(options) {
  if (!options.objectUrl) {
    throw new Error('options.objectUrl is required');
  }
  const OBJECT_URL = options.objectUrl;

  function fresh(cacheEntry) {
    let parts = /max-age=([0-9]+)/.exec(cacheEntry.response.CacheControl);
    if (parts) {
      let maxAge = parts[1];
      let age = clock.now() - cacheEntry.metadata.date;
      return age <= 1000 * maxAge;
    }
    return false;
  }

  function scan() {
    let key = OBJECT_URL;
    let cachedItem = cache.get(key);
    if (cachedItem && fresh(cachedItem)) {
      logger.debug('Fresh. Serving resource from cache.');
      return Promise.resolve(cachedItem.response.Body);
    }
    let s3Location = s3Url.parse(OBJECT_URL);

    return masterAccountClient.createS3Client(fp.pick('endpoint')(s3Location))
    .then((s3) => {
      let req = fp.pick(['Bucket', 'Key'])(s3Location);
      if (cachedItem) {
        req.IfNoneMatch = cachedItem.response.ETag;
      }
      return s3.getObject(req).promise()
        .then((rsp) => {
          logger.debug(`Invalidated. Serving resource from origin. ${key}`);
          let item = {
            response: Object.assign({}, rsp, { Body: JSON.parse(rsp.Body.toString()) }),
            metadata: { date: clock.now() },
          };
          cache.set(key, item);
          return item;
        },
        (err) => {
          if (err.statusCode === 304) {
            logger.debug(`Validated. Serving resource from cache. ${key}`);
            cachedItem.metadata.date = clock.now();
            cache.set(key, cachedItem);
            return Promise.resolve(cachedItem);
          } else {
            logger.error(`Could not get resource from origin. ${key}`);
            logger.error(err);
            return Promise.resolve(cachedItem);
          }
        })
        .then(item => (cachedItem || item).response.Body);
    });
  }

  return {
    scan,
  };
}

module.exports = create;
