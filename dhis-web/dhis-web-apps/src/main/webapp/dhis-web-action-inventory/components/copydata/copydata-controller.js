/* global angular */

'use strict';

var sunInventory = angular.module('sunInventory');

//Controller for settings page
sunInventory.controller('CopyDataController',
        function($scope,
                $modalInstance,
                OrgUnitFactory) {
    
    $scope.close = function(){
        $modalInstance.close();
    };
    
    $scope.selectedOrgUnits = [];
    $scope.selectOrgUnit = function(orgUnit){
        orgUnit.selected = !orgUnit.selected;        
        if( orgUnit.selected ){
            $scope.selectedOrgUnits.push( orgUnit.id );
        }
        else{
            var index = $scope.selectedOrgUnits.indexOf( orgUnit.id );
            if( index !== -1 ){
                $scope.selectedOrgUnits.splice(index, 1);
            }
        }
    };
    
    //Get orgunits for the logged in user
    OrgUnitFactory.getSearchTreeRoot().then(function(response) {
        $scope.orgUnits = response.organisationUnits;
        angular.forEach($scope.orgUnits, function(ou){
            ou.show = true;
            ou.selected = false;
            angular.forEach(ou.children, function(o){
                o.hasChildren = o.children && o.children.length > 0 ? true : false;
            });
        });
    });
    
    
    //expand/collapse of search orgunit tree
    $scope.expandCollapse = function(orgUnit) {
        if( orgUnit.hasChildren ){
            //Get children for the selected orgUnit
            OrgUnitFactory.getChildren(orgUnit.id).then(function(ou) {
                orgUnit.show = !orgUnit.show;
                orgUnit.hasChildren = false;
                orgUnit.children = ou.children;
                orgUnit.selected = orgUnit.selected ? orgUnit.selected : false;
                angular.forEach(orgUnit.children, function(ou){
                    ou.hasChildren = ou.children && ou.children.length > 0 ? true : false;
                    ou.selected = false;
                });
            });
        }
        else{
            orgUnit.show = !orgUnit.show;
        }
    };
    
    $scope.copyData = function(){
        console.log('need to copy data...');
        $scope.close();
    };
    
});