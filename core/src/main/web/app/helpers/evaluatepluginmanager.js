/*
 *  Copyright 2014 TWO SIGMA OPEN SOURCE, LLC
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
/**
 * Module bk.evaluatePluginManager
 */
(function() {
  'use strict';
  var module = angular.module('bk.evaluatePluginManager', ['bk.utils']);
  module.factory('bkEvaluatePluginManager', function(bkUtils) {
      var nameToUrlMap = {};
      var nameToVisualParams = {};
      var plugins = {};
      var loadingInProgressPlugins = [];
      return {
        getKnownEvaluatorPlugins: function() {
          return nameToUrlMap;
        },
        addNameToUrlEntry: function(name, url) {
          if ( typeof url === 'string' ) {
            nameToUrlMap[name] = url;
          } else {
            nameToUrlMap[name] = url.url;
            delete url.url;
            nameToVisualParams[name] = url;
          }
        },
        getVisualParams: function(name) {
            return nameToVisualParams[name];
        },
        getEvaluatorFactory: function(nameOrUrl) {
          if (plugins[nameOrUrl]) {
            var deferred = bkUtils.newDeferred();
            plugins[nameOrUrl].getEvaluatorFactory().then(function(shellCreator) {
              deferred.resolve(shellCreator);
            }, function(err) {
              deferred.reject(err);
            });
            return deferred.promise;
          } else {
            var deferred = bkUtils.newDeferred();
            var name, url;
            if (nameToUrlMap[nameOrUrl]) {
              name = nameOrUrl;
              url = nameToUrlMap[nameOrUrl];
            } else {
              name = "";
              url = nameOrUrl;
            }
            loadingInProgressPlugins.push({
              name: name,
              url: url
            });
            bkUtils.loadModule(url, name).then(function(ex) {
              if (!_.isEmpty(ex.name)) {
                plugins[ex.name] = ex;
              }
              if (!_.isEmpty(name) && name !== ex.name) {
                plugins[name] = ex;
              }
              ex.getEvaluatorFactory().then(function(shellCreator) {
                deferred.resolve(shellCreator);
              }, function(err) {
                if (!_.isEmpty(ex.name)) {
                  delete plugins[ex.name];
                }
                if (!_.isEmpty(name) && name !== ex.name) {
                  delete plugins[name];
                }
                console.error(err);
                if (_.isEmpty(name)) {
                  deferred.reject("failed to load plugin: " + url);
                } else {
                  deferred.reject("failed to load plugin: " + name + " at " + url);
                }
              });
            }, function(err) {
              if (!_.isEmpty(ex.name)) {
                delete plugins[ex.name];
              }
              if (!_.isEmpty(name) && name !== ex.name) {
                delete plugins[name];
              }
              console.error(err);
              if (_.isEmpty(name)) {
                deferred.reject("failed to load plugin: " + url);
              } else {
                deferred.reject("failed to load plugin: " + name + " at " + url);
              }
            }).finally(function() {
              loadingInProgressPlugins = _(loadingInProgressPlugins).filter(function(it) {
                return it.url !== url;
              });
            });
            return deferred.promise;
          }
        },
        createEvaluatorThenExit: function(settings) {
          var theShell;
          return this.getEvaluatorFactory(settings.plugin)
              .then(function(factory) {
                var evaluator = factory.create(settings);
                return evaluator;
              })
              .then(function(evaluator) {
                if (evaluator.exit) {
                  evaluator.exit();
                }
              })
              .then(function() {
                _(plugins).filter(function(aShell) {
                  return aShell !== theShell;
                });
              });
        }
      };
    });
})();
