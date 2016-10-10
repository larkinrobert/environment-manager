/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

// require('./common/*.js')
// 
require('./common/common.module.js');
require('./compare/compare.module.js');
require('./configuration/configuration.module.js');
require('./environments/environments.module.js');
require('./operations/operations.module.js');

var app = angular.module('EnvironmentManager', [
  'ui.grid',
  'ngRoute',
  'angularMoment',
  'EnvironmentManager.common',
  'EnvironmentManager.compare',
  'EnvironmentManager.configuration',
  'EnvironmentManager.environments',
  'EnvironmentManager.operations',
]);

// Setup global routes
app.config(function ($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: '/app/environments/summary/env-summary.html',
      controller: 'EnvironmentsSummaryController',
      menusection: '',
    })
    .when('/login', {
      templateUrl: '/login.html',
      allowAnonymous: true,
      menusection: '',
    })
    .otherwise({
      redirectTo: '/',
    });
});

app.run(function ($rootScope, $timeout) {
  $rootScope.canUser = function () {
    return true;
  };

  $timeout(function () {
    $rootScope.$broadcast('cookie-expired');
  }, (window.user.getExpiration() - new Date().getTime()));
});
