/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

angular.module('EnvironmentManager.common').factory('Deployment',
  function ($q, resources, $log, awsService) {

    class Deployment {
      constructor(data) {
        _.assign(this, data);
      }

      static getById(accountName, deploymentId) {
        return resources.deployments.get({ account: accountName, key: deploymentId }).then(function (data) {
          return new Deployment(data);
        });
      }

      static convertToListView(data) {
        function normalizeStatus(status) {
          return status.toLowerCase().replace(' ', '-');
        }

        var nodes = data.Value.Nodes ? data.Value.Nodes.map(convertToNode) : [];

        var deployment = {
          id: data.DeploymentID,
          account: data.AccountName,
          data: data,
          user: data.Value.User,
          cluster: data.Value.OwningCluster,
          status: data.Value.Status,
          normalisedStatus: normalizeStatus(data.Value.Status),
          timestamp: data.Value.EndTimestamp || data.Value.StartTimestamp,
          log: data.Value.ExecutionLog,
          environment: {
            name: data.Value.EnvironmentName,
            type: data.Value.EnvironmentType,
          },
          service: {
            name: data.Value.ServiceName,
            version: data.Value.ServiceVersion,
          },
          nodes: nodes,
          error: null,
        };

        if (data.Value.ErrorReason) {
          deployment.error = {
            reason: data.Value.ErrorReason,
            detail: data.Value.ErrorDetail,
          };
        }

        return deployment;
      }
    }

    _.assign(Deployment.prototype, {

      fetchNodesIps: function() {
        var self = this;
        var instanceIds = _.map(self.Value.Nodes, 'InstanceId');

        var params = {
          account: this.AccountName,
          query: {
            'instance-id': instanceIds,
          },
        };
        return awsService.instances.GetInstanceDetails(params).then(function (instances) {
          instances.forEach(function (node) {
            var tmp = _.find(self.Value.Nodes, {InstanceId: node.InstanceId});
            if (tmp === undefined) {
              $log.warn('Error while mapping instance ' + node.InstanceId + ' to IP');
              return;
            }
            tmp.InstanceIP = node.Ip;
          });
          return self;
        });
      }

    });

    
    function convertToNode(node) {
      return {
        instanceId: node.InstanceId,
        status: {
          status: node.Status,
          class: 'status-' + node.Status.toLowerCase().replace(' ', '-'),
        },
      };
    }

    return Deployment;
  });