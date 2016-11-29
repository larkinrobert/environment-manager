/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let fp = require('lodash/fp');
let upstreams = require('modules/data-access/configUpstreamDatabase');
let uuid = require('uuid');

function audit(req) {
  return {
    LastChanged: new Date().toISOString(),
    TransactionID: uuid.v4(),
    User: req.user.getName(),
  };
}

function project(upstream) {
  return {
    AccountName: upstream.account,
    Value: JSON.parse(upstream.value.value),
    Version: upstream.value.version,
    key: upstream.value.key,
  };
}

/**
 * GET /config/upstreams
 */
function getUpstreamsConfig(req, res, next) {
  return upstreams.scan().then(fp.flow(fp.map(project), res.json.bind(res))).catch(next);
}

/**
 * GET /config/upstreams/{name}
 */
function getUpstreamConfigByName(req, res, next) {
  let key = req.swagger.params.name.value;
  return upstreams.get({ key }).then(fp.flow(project, res.json.bind(res))).catch(next);
}

/**
 * POST /config/upstreams
 */
function postUpstreamsConfig(req, res, next) {
  let body = req.swagger.params.body.value;
  let key = body.key;

  let item = {
    Audit: audit(req),
    key,
    value: JSON.stringify(body.Value),
  };

  return upstreams.create(item).then(data => res.json(data)).catch(next);
}

/**
 * PUT /config/upstreams/{name}
 */
function putUpstreamConfigByName(req, res, next) {
  let body = req.swagger.params.body.value;
  let key = req.swagger.params.name.value;
  let expectedVersion = req.swagger.params['expected-version'].value;

  let item = {
    Audit: audit(req),
    key,
    value: JSON.stringify(body),
    version: expectedVersion,
  };

  return upstreams.put(item).then(data => res.json(data)).catch(next);
}

/**
 * DELETE /config/upstreams/{name}
 */
function deleteUpstreamConfigByName(req, res, next) {
  let key = req.swagger.params.name.value;
  return upstreams.delete({ key }).then(data => res.json(data)).catch(next);
}

module.exports = {
  getUpstreamsConfig,
  getUpstreamConfigByName,
  postUpstreamsConfig,
  putUpstreamConfigByName,
  deleteUpstreamConfigByName,
};
