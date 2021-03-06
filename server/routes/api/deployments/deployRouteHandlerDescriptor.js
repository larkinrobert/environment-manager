/* Copyright (c) Trainline Limited, 2016-2017. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let sender = require('modules/sender');
let adapt = require('modules/callbackAdapter');
let route = require('modules/helpers/route');
let RequestData = require('modules/RequestData');
let deployAuthorizer = require('modules/authorizers/deploy-authorizer');

module.exports = route.post('/:account/environments/:environment/services/:service/:version/deploy')
  .inOrderTo('Deploy a particular service version by provisioning the infrastructure and uploading the package on S3.')
  .withDocs({
    description: 'Deploy',
    tags: ['Deployments'],
    params: [
      { in: ['query', 'body'], type: 'string', required: true, name: 'Mode', description: 'Todo: Describe "Mode" parameter' },
      { in: ['query', 'body'], type: 'string', required: true, name: 'Slice', description: 'Todo: Describe "Slice" parameter' },
      { in: ['query', 'body'], type: 'string', required: true, name: 'PackagePath', description: 'Todo: Describe "PackagePath" parameter' },
      { in: ['query'], type: 'string', required: false, name: 'server_role', description: 'Target server role for service deployment, if multiple are possible' }
    ]
  })
  .withAuthorizer(deployAuthorizer)
  .do((request, response) => {
    let requestData = new RequestData(request);

    let mode = requestData.get('Mode', 'overwrite').toLowerCase();
    let serviceSlice = requestData.get('Slice', 'none').toLowerCase();
    let packagePath = requestData.get('PackagePath');

    if (!packagePath) {
      response.status(400);
      response.send('Missing "packagePath" argument.');
      return;
    }

    let command = {
      name: 'DeployService',
      environmentName: request.params.environment,
      serviceName: request.params.service,
      serviceVersion: request.params.version,
      serviceSlice,
      mode,
      packagePath,
      serverRoleName: request.serverRoleName
    };

    // Location
    let callback = adapt.callbackToExpress(request, response);

    sender.sendCommand({ command, user: request.user }).then(
      (deployment) => {
        response.status(201);
        response.location(`/api/${deployment.accountName}/deployments/history/${deployment.id}`);
        callback(null, deployment);
      },

      (error) => {
        callback(error);
      }
    );
  });
