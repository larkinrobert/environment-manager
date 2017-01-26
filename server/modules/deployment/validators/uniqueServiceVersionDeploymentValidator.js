/* Copyright (c) Trainline Limited, 2016-2017. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let logger = require('modules/logger');
let ms = require('ms');
let sender = require('modules/sender');
let utils = require('modules/utilities');
let DeploymentValidationError = require('modules/errors/DeploymentValidationError.class');
let deploymentLogger = require('modules/DeploymentLogger');

const DEPLOYMENT_MAXIMUM_THRESHOLD = ms('65m');
const ROLE_REGEX = /environments\/([^\/]+)\/roles\/([^\/]+)\/services\/([^\/]+)\/([^\/]+)/;

function parseRoleKey(roleKey) {
  let t = ROLE_REGEX.exec(roleKey);
  if (t === null) {
    return null;
  }
  return {
    environment: t[1],
    role: t[2],
    service: t[3],
    slice: t[4]
  };
}

function get(roleKey) {
  let environment = parseRoleKey(roleKey).environment;
  let query = {
    name: 'GetTargetState',
    environment,
    recurse: false,
    key: roleKey
  };
  return sender.sendQuery({ query });
}

function conflictingInstallations(targetEnvironment, targetService, targetVersion, targetSlice, allServicesInEnv) {
  // Get all the installations of this service in this environment on other slices.
  let serviceOnOtherSlices = allServicesInEnv.filter((roleKey) => {
    let installation = parseRoleKey(roleKey);
    if (installation === null) {
      logger.error(new Error(`Could not parse service installation: ${roleKey}`));
      return false;
    } else {
      let { environment, service, slice } = installation;
      return environment === targetEnvironment
        && service === targetService
        && slice !== targetSlice;
    }
  });

  // Get the version of each of the potentially conflicting services.
  let potentialConflicts = serviceOnOtherSlices.map((roleKey) => {
    return get(roleKey).then(value => ({
      roleKey,
      version: value.Version
    }));
  });

  let conflicts = Promise.all(potentialConflicts)
    .then(items => items.filter(x => x.version === targetVersion).map(x => `${x.roleKey}@${x.version}`));

  return conflicts;
}

function validateServiceNotCurrentlyBeingDeployed(deployment) {
  let expectedStatus = 'In Progress';
  let minimumRangeDate = utils.offsetMilliseconds(new Date(), -DEPLOYMENT_MAXIMUM_THRESHOLD).toISOString();
  let maximumRangeDate = new Date().toISOString();
  let query = {
    name: 'ScanCrossAccountDynamoResources',
    resource: 'deployments/history',
    filter: {
      'Value.Status': expectedStatus,
      'Value.EnvironmentName': deployment.environmentName,
      'Value.ServiceName': deployment.serviceName,
      'Value.ServerRoleName': deployment.serverRoleName,
      '$date_from': minimumRangeDate,
      '$date_to': maximumRangeDate,
      'Value.SchemaVersion': 2
    }
  };

  return sender.sendQuery({ query }).then((deployments) => {
    if (deployments.length) {
      return Promise.reject(new DeploymentValidationError(
        `The '${deployment.serviceName}' service is already being deployed to '${deployment.serverRoleName}' at this time.`
      ));
    }

    return Promise.resolve();
  });
}

function validateServiceAndVersionNotDeployed(deployment) {
  let environment = deployment.environmentName;
  let service = deployment.serviceName;
  let version = deployment.serviceVersion;
  let slice = deployment.serviceSlice;

  let query = {
    name: 'GetTargetState',
    environment,
    recurse: true,
    key: `environments/${environment}/roles/?keys`
  };

  return sender.sendQuery({ query })
    .then(allServicesInEnv => conflictingInstallations(environment, service, version, slice, allServicesInEnv))
    .then((conflicts) => {
      if (conflicts.length === 0) {
        return Promise.resolve();
      } else {
        let message = `Each version of a service may only be deployed to slices of one colour per environment.
You attempted to deploy ${service} ${version} to a ${slice} slice of ${environment}.
Conflicts:
${conflicts.join('\n')}`;
        deploymentLogger.inProgress(deployment.id, deployment.accountName, message);
        return Promise.reject(new DeploymentValidationError(message));
      }
    });
}

module.exports = {
  validate(deployment) {
    return Promise.all([
      validateServiceNotCurrentlyBeingDeployed(deployment),
      validateServiceAndVersionNotDeployed(deployment)
    ]);
  }
};
