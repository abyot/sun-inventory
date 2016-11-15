/* global angular */

'use strict';

var sunInventory = angular.module('sunInventory');

//Controller for settings page
sunInventory.controller('CopyDataController',
        function($scope,
                $modalInstance,
                OrgUnitFactory,
                ActionMappingUtils,
                DataValueService,
                dataValues,
                selectedDataSet,
                selectedPeriod,
                selectedOrgUnitId,
                selectedDataElement,
                attributeOptionCombo,
                selectedCategoryCombo) {
    
    $scope.close = function(){
        $modalInstance.close();
    };    
    
    $scope.selectedOrgUnits = [];
    $scope.selectOrgUnit = function(orgUnit){
        
        if( selectedDataSet.organisationUnits[orgUnit.id] ){
            
            if( orgUnit.id !== selectedOrgUnitId ){                
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
            }            
        }
        else{
            ActionMappingUtils.notificationDialog('error', 'dataset_not_assigned_to_ou');
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
        var _dataValues = {};
        for (var k in dataValues) {
            if (dataValues[k]) {                
                if( dataValues[k].length ){
                    angular.forEach(dataValues[k], function(dv){
                        _dataValues[dv.id] = 1;
                    });
                }
                else{
                    _dataValues[dataValues[k].id] = 1;
                }
            }
        }
        
        var dvs = {dataValues: []};
        angular.forEach($scope.selectedOrgUnits, function(ou){
            
            angular.forEach(selectedCategoryCombo.categoryOptionCombos, function(oco){
                
                var dv = {dataElement: selectedDataElement.id, 
                            period: selectedPeriod.id,
                            orgUnit: ou,
                            categoryOptionCombo: oco.id, 
                            attributeOptionCombo: attributeOptionCombo,
                            value: 0};

                if( _dataValues[oco.id] ){
                    dv.value = 1;
                }
                
                dvs.dataValues.push( dv );

            });
            
        });
        
        if( dvs.dataValues.length > 0 ){
            DataValueService.saveDataValueSets( dvs ).then(function(){
                $scope.close();
            });
        }
        else{
            $scope.close();
        }        
    };
    
});