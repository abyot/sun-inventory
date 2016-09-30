/* global angular */

'use strict';

var sunSurvey = angular.module('sunSurvey');

//Controller for settings page
sunSurvey.controller('ValidationDialogController',
        function($scope,
                $modalInstance,
                $filter,
                invalidFields,
                dataElementGroupSets) {
    
    $scope.dataElementGroupSets = dataElementGroupSets;
    
    $scope.invalidFields = $filter('orderBy')(invalidFields, ['dataElementGroupSet.code', 'dataElementGroup.code', 'order']);    
    
    $scope.close = function(status) {        
        $modalInstance.close( status );
    };
    
    $scope.getGroupSpan = function( groupId ){
        return $filter('filter')(invalidFields, {dataElementGroup: {id: groupId}}).length;
    };
});