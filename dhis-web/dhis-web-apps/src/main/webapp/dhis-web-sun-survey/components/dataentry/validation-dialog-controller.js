/* global angular */

'use strict';

var sunSurvey = angular.module('sunSurvey');

//Controller for settings page
sunSurvey.controller('ValidationDialogController',
function ($scope,
        $modalInstance,
        $filter,
        orderByFilter,
        invalidFields,
        dataElementGroupSets) {

    $scope.dataElementGroupSets = dataElementGroupSets;

    $scope.invalidFields = $filter('orderBy')(invalidFields, ['dataElementGroupSet.code', 'dataElementGroup.code', 'order']);

    $scope.invalidGroupSets = [];
    angular.forEach($scope.invalidFields, function (field) {
        if ($scope.invalidGroupSets.indexOf(field.dataElementGroupSet.code) === -1) {
            $scope.invalidGroupSets.push(field.dataElementGroupSet.code);
        }
    });

    $scope.invalidGroupSets = $scope.invalidGroupSets.sort();

    var groupsByGroupSets = {};
    var invalidItems = {};
    angular.forEach($scope.invalidGroupSets, function (igs) {
        var fields = $filter('filter')(invalidFields, {dataElementGroupSet: {code: igs}});
        angular.forEach(fields, function (field) {
            if (groupsByGroupSets[igs]) {
                if (groupsByGroupSets[igs].indexOf(field.dataElementGroup.code) === -1) {
                    groupsByGroupSets[igs].push(field.dataElementGroup.code);
                }
            } else {
                groupsByGroupSets[igs] = [];
                groupsByGroupSets[igs].push(field.dataElementGroup.code);
            }
        });
        groupsByGroupSets[igs] = groupsByGroupSets[igs].sort();
        invalidItems[igs] = {};
        angular.forEach(groupsByGroupSets[igs], function(ig){
            invalidItems[igs][ig] = [];            
            angular.forEach(orderByFilter($filter('filter')(invalidFields, {dataElementGroupSet: {code: igs}, dataElementGroup: {code: ig}}), 'order'), function(item){
                invalidItems[igs][ig].push( item.displayName );
            });            
        });        
    });
    
    $scope.close = function (status) {
        $modalInstance.close(status);
    };

    $scope.getGroupSpan = function (groupId) {
        return $filter('filter')(invalidFields, {dataElementGroup: {id: groupId}}).length;
    };
        
    $scope.invalidDataElements = [];
    var currRow = [];
    for (var groupSetKey in invalidItems) {
        var groupSet = invalidItems[groupSetKey];
        var groupSetDs = {
            val: groupSetKey,
            span: 0
        };
        currRow.push(groupSetDs);
        for (var groupKey in groupSet) {
            var group = groupSet[groupKey];
            var groupDs = {
                val: groupKey,
                span: 0
            };
            currRow.push(groupDs);
            for (var deKey in group) {
                groupSetDs.span++;
                groupDs.span++;
                var de = group[deKey];
                currRow.push({
                    val: de,
                    span: 1
                });
                $scope.invalidDataElements.push(currRow);
                currRow = [];
            }
        }
    }
});