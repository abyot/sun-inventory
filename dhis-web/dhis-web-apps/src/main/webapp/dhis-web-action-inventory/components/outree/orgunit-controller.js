/* global angular */

'use strict';

var sunInventory = angular.module('sunInventory');

//Controller for settings page
sunInventory.controller('OuTreeController',
        function($scope,
                $modalInstance,
                orgUnits,
                selectedOrgUnit,
                OrgUnitFactory){ 
                
    $scope.orgUnits = orgUnits;
    $scope.selectedOrgUnit = selectedOrgUnit;
    
    //expand/collapse of search orgunit tree
    $scope.expandCollapse = function(orgUnit) {
        if( orgUnit.hasChildren ){
            //Get children for the selected orgUnit
            OrgUnitFactory.getChildren(orgUnit.id).then(function(ou) {
                orgUnit.show = !orgUnit.show;
                orgUnit.hasChildren = false;
                orgUnit.children = ou.children;
                angular.forEach(orgUnit.children, function(ou){
                    ou.hasChildren = ou.children && ou.children.length > 0 ? true : false;
                });
            });
        }
        else{
            orgUnit.show = !orgUnit.show;
        }
    };

    $scope.setSelectedOrgUnit = function( orgUnit ){
    	$scope.selectedOrgUnit = orgUnit;
    };

    $scope.select = function () {        
        $modalInstance.close( $scope.selectedOrgUnit );
    };

    $scope.cancel = function(){
        $modalInstance.close();
    };
});