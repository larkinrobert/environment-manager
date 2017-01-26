/* eslint-env mocha */
/* Copyright (c) Trainline Limited, 2016-2017. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

// 'environments/pr1/roles/WorkerElectronicFulfilmentBH2B/services/TVTicketKeeperAdapterBH2/none'

let should = require('should');
let sinon = require('sinon');
let proxyquire = require('proxyquire');
let DeploymentContract = require('modules/deployment/DeploymentContract');

let id = '00000000-0000-0000-0000-000000000001';
let environmentTypeName = 'Prod';
let clusterName = 'Tango';
let accountName = 'Prod';
let username = 'test-user';

function validator(sender) {
  return proxyquire('modules/deployment/validators/uniqueServiceVersionDeploymentValidator', {
    'modules/sender': sender
  });
}

function deploy({ environment, role, service, slice, version }) {
  return new DeploymentContract({
    id,
    environmentName: environment,
    environmentTypeName,
    serverRole: role,
    serverRoleName: `${role}-${slice}`,
    serviceName: service,
    serviceVersion: version,
    serviceSlice: slice,
    clusterName,
    accountName,
    username
  });
}

let scenario = (environment, role, service, slice, version) => ({
  environment,
  role,
  service,
  slice,
  version
});

function existing({ environment, role, service, slice, version }) {
  return [`environments/${environment}/roles/${role}/services/${service}/${slice}`, version];
}

function stub(...responses) {
  let rsp = new Map(responses);
  return (query) => {
    if (query.key.endsWith('?keys')) {
      return Promise.resolve(Array.from(rsp.keys()));
    } else {
      return Promise.resolve({ Version: rsp.get(query.key) });
    }
  };
}

describe('UniqueServiceVersionDeploymentValidator: ', function () {
  let configuration = {};
  let senderMock;

  describe('validating any deployment', function () {
    let sut;

    beforeEach(() => {
      senderMock = { sendQuery: sinon.stub().returns(Promise.resolve([])) };
      sut = validator(senderMock);
    });

    it('sends a query', () => {
      let deployment = deploy(scenario('env1', 'role1', 'svc1', 'blue', '1.0.0'));
      return sut.validate(deployment, configuration).then(() => {
        senderMock.sendQuery.called.should.be.true();
      });
    });

    it('queries the running deployments', () => {
      let deployment = deploy(scenario('env1', 'role1', 'svc1', 'blue', '1.0.0'));
      return sut.validate(deployment, configuration).then(() => {
        senderMock.sendQuery.getCall(0).args[0].should.match({
          query: {
            name: 'ScanCrossAccountDynamoResources',
            resource: 'deployments/history',
            filter: {
              'Value.EnvironmentName': 'env1',
              'Value.SchemaVersion': 2,
              'Value.ServiceName': 'svc1',
              'Value.Status': 'In Progress'
            }
          }
        });
      });
    });

    it('queries the deployed services', () => {
      let deployment = deploy(scenario('env1', 'role1', 'svc1', 'blue', '1.0.0'));
      return sut.validate(deployment, configuration)
        .then(() =>
          senderMock.sendQuery.calledWithMatch({
            query: {
              name: 'GetTargetState',
              environment: 'env1',
              recurse: true,
              key: 'environments/env1/roles/?keys'
            }
          })
        ).should.finally.be.true();
    });

    it('fails when the service is being deployed', () => {
      let deployment = deploy(scenario('env1', 'role1', 'svc1', 'blue', '1.0.0'));
      senderMock.sendQuery = () => Promise.resolve([undefined]);
      return sut.validate(deployment, configuration).catch((result) => {
        result.should.match({
          name: 'DeploymentValidationError',
          message: 'The \'svc1\' service is already being deployed to \'role1-blue\' at this time.'
        });
      });
    });
  });

  describe('validating a blue/green deployment', function () {
    function mockSender(createResponse) {
      function sendQuery(query) {
        if (query.query.name === 'ScanCrossAccountDynamoResources') {
          return Promise.resolve([]);
        }
        let rsp = createResponse(query.query);
        return rsp;
      }
      return { sendQuery };
    }

    let target = scenario('env A', 'role A', 'service A', 'none', '1.0.0');
    let differingBy = (args) => {
      let copy = Object.assign({}, target);
      args.forEach((x) => { copy[x] += '#'; });
      return copy;
    };

    let scenarios = [
      [[], true],
      [['version'], true],
      [['slice'], false],
      [['service'], true],
      [['role'], true],
      [['environment'], true],
      [['slice', 'role'], false],
      [['slice', 'version'], true],
      [['slice', 'service'], true],
      [['slice', 'environment'], true]
    ];

    scenarios.forEach(([differentFields, pass]) => {
      it(`${pass ? 'passes' : 'fails'} when an existing service differs only in ${differentFields.join(' and ')}.`, function () {
        let sender = mockSender(stub(existing(differingBy(differentFields))));
        let sut = validator(sender);
        let result = sut.validate(deploy(target), configuration);
        return pass ? result.should.be.fulfilled() : result.should.be.rejected();
      });
    });
  });
});
