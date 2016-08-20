/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for reports page
sunPMT.controller('GeoCoverageController',
        function($scope,
                $filter,
                $translate,
                SessionStorageService,
                DialogService,
                PeriodService,
                MetaDataFactory,
                ActionMappingUtils,
                OptionComboService,
                ReportService) {
    $scope.periodOffset = 0;
    $scope.showReportFilters = true;
    $scope.reportReady = false;
    $scope.noDataExists = false;
    $scope.orgUnitLevels = null;
    $scope.model = {stakeholderRoles: [{id: 'CA_ID', name: $translate.instant('catalyst')},{id: 'FU_ID', name: $translate.instant('funder')},{id: 'RM_ID', name: $translate.instant('responsible_ministry')}],
        ouModes: [],
        periods: [],
        dataSets: null,
        selectedDataSets: [],
        ouLevels: [],
        programs: null,
        programsByCode: [],
        programCodesById: [],
        dataElementsByCode: [],
        dataElementCodesById: [],
        selectedPrograms: null,
        selectedRole: null,
        mappedOptionCombos: null,
        roleDataElementsById: null,
        reportDataElements: null,
        whoDoesWhatCols: null,
        mappedValues: null,
        childrenIds: [],
        children: []};
    
    function resetParams(){
        $scope.showReportFilters = true;
        $scope.reportStarted = false;
        $scope.reportReady = false;
        $scope.noDataExists = false;
        $scope.model.reportDataElements = [];
        $scope.model.whoDoesWhatCols = [];
    }
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {
        resetParams();
        $scope.model.selectedDataSets = [];
        $scope.model.selectedPeriod = null;        
        $scope.model.selectedRole = null;
        if( angular.isObject($scope.selectedOrgUnit)){            
            
            ActionMappingUtils.getChildrenIds($scope.selectedOrgUnit).then(function(response){
                $scope.model.childrenIds = response.childrenIds;
                $scope.model.children = response.children;
                $scope.model.childrenByIds = response.childrenByIds;
            });
            
            $scope.model.programs = [];
            $scope.model.roleDataElementsById = [];
            $scope.model.roleDataElements = [];
            
            MetaDataFactory.getAll('programs').then(function(programs){
                $scope.model.programs = programs;
                angular.forEach(programs, function(program){
                    if( program.programStages && program.programStages[0] && program.programStages[0].programStageDataElements ){
                        angular.forEach(program.programStages[0].programStageDataElements, function(prStDe){
                            if( prStDe.dataElement && prStDe.dataElement.id && !$scope.model.roleDataElementsById[prStDe.dataElement.id]){                                
                                $scope.model.roleDataElementsById[prStDe.dataElement.id] = {name:  prStDe.dataElement.name, sortOrder: prStDe.sortOrder};
                            }                            
                        });
                    }                    
                    $scope.model.programsByCode[program.actionCode] = program;
                    $scope.model.programCodesById[program.id] = program.actionCode;
                });
                
                for( var k in $scope.model.roleDataElementsById ){
                    if( $scope.model.roleDataElementsById.hasOwnProperty( k ) ){
                        $scope.model.roleDataElements.push( {id: k, name: $scope.model.roleDataElementsById[k].name, sortOrder: $scope.model.roleDataElementsById[k].sortOrder, domain: 'EV'} );
                    }
                }
                
                $scope.orgUnitLevels = [];
                MetaDataFactory.getAll('ouLevels').then(function(ouLevels){
                    angular.forEach(ouLevels, function(ol){
                        $scope.model.ouLevels[ol.level] = ol.displayName;
                    });                    
                    var res = ActionMappingUtils.populateOuLevels($scope.selectedOrgUnit, $scope.model.ouLevels);
                    $scope.model.ouModes = res.ouModes;
                    $scope.model.selectedOuMode = res.selectedOuMode;
                    
                    $scope.model.mappedOptionCombos = [];
                    OptionComboService.getMappedOptionCombos().then(function(ocos){
                        $scope.model.mappedOptionCombos = ocos;
                    });                    
                });
                
                $scope.model.categoryCombos = {};
                $scope.model.stakeholderCategories = [];
                $scope.model.pushedCategoryIds = [];
                MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                    angular.forEach(ccs, function(cc){
                        $scope.model.categoryCombos[cc.id] = cc;
                    });

                    $scope.model.dataSets = [];
                    MetaDataFactory.getAll('dataSets').then(function(dataSets){
                        $scope.model.dataSets = $filter('filter')(dataSets, {dataSetType: 'action'});
                        angular.forEach($scope.model.dataSets, function(ds){
                            if( ds.dataElements && ds.dataElements[0] && ds.dataElements[0].code ){
                                $scope.model.dataElementsByCode[ds.dataElements[0].code] = ds.dataElements[0];
                                var res = ActionMappingUtils.getStakeholderCategoryFromDataSet(ds, $scope.model.categoryCombos, $scope.model.stakeholderCategories, $scope.model.pushedCategoryIds);
                                $scope.model.stakeholderCategories = res.categories;
                                $scope.model.pushedCategoryIds = res.categoryIds;
                            }
                        });
                        
                        var len = angular.copy( $scope.model.roleDataElements.length );
                        var count = 1;
                        angular.forEach($scope.model.stakeholderCategories, function(c){
                            var ops = [];
                            angular.forEach(c.categoryOptions, function(o){
                                ops.push( o.displayName );
                            });
                            $scope.model.roleDataElements.push( {id: c.id, name: c.name, sortOrder: len + count, domain: 'CA', categoryOptions: ops});
                        });
                    });                
                });
            });
                
            SessionStorageService.set('SELECTED_OU', $scope.selectedOrgUnit);
            $scope.model.periods = PeriodService.getPeriods('Yearly', $scope.model.periodOffset);
        }
    });

    $scope.getPeriods = function(mode){
        
        if( mode === 'NXT'){
            $scope.periodOffset = $scope.periodOffset + 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods('Yearly', $scope.periodOffset);
        }
        else{
            $scope.periodOffset = $scope.periodOffset - 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods('Yearly', $scope.periodOffset);
        }
    };
    
    $scope.interacted = function(field) {        
        var status = false;
        if(field){            
            status = $scope.geoCoverageForm.submitted || field.$dirty;
        }
        return status;        
    };
    
    $scope.getReport = function(){
        
        //check for form validity
        $scope.geoCoverageForm.submitted = true;        
        if( $scope.geoCoverageForm.$invalid ){
            return;
        }
        
        if( !$scope.model.selectedDataSets.length || $scope.model.selectedDataSets.length < 1 ){            
            var dialogOptions = {
                headerText: $translate.instant('error'),
                bodyText: $translate.instant('please_select_actions')
            };		
            DialogService.showDialog({}, dialogOptions);
            return;
        }
        
        $scope.orgUnits = [];
        if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){
            $scope.orgUnits = $scope.model.children;
        }
        else{
            $scope.orgUnits = [$scope.selectedOrgUnit];
        }
        
        resetParams();
        $scope.reportStarted = true;
        $scope.showReportFilters = false;
        var dataValueSetUrl = 'period=' + $scope.model.selectedPeriod.id;
        angular.forEach($scope.model.selectedDataSets, function(ds){
            dataValueSetUrl += '&dataSet=' + ds.id;
        });
        
        if( $scope.selectedOrgUnit.l === 3 ){
            dataValueSetUrl += '&orgUnit=' + $scope.selectedOrgUnit.id;
        }        
        else{            
            if( $scope.selectedOrgUnit.l+1 < 3 ){
                angular.forEach($scope.selectedOrgUnit.c, function(c){
                    dataValueSetUrl += '&orgUnit=' + c;
                });
            }
            else {
                dataValueSetUrl += '&orgUnit=' + $scope.selectedOrgUnit.id;
            }
            
            dataValueSetUrl += '&children=true';
        }
        
        $scope.model.selectedPrograms = [];
        $scope.model.dataElementCodesById = [];
        $scope.model.mappedRoles = {};
        $scope.optionCombos = [];
        angular.forEach($scope.model.selectedDataSets, function(ds){
            if( ds.dataElements && ds.dataElements[0] && ds.dataElements[0].code && $scope.model.programsByCode[ds.dataElements[0].code] ){
                var pr = $scope.model.programsByCode[ds.dataElements[0].code];
                if( pr && pr.actionCode ){
                    $scope.model.selectedPrograms.push( pr );
                    $scope.model.reportDataElements.push( ds.dataElements[0] );
                    $scope.model.dataElementCodesById[ds.dataElements[0].id] = ds.dataElements[0].code;
                    $scope.optionCombos = $scope.optionCombos.concat($scope.model.categoryCombos[ds.dataElements[0].categoryCombo.id].categoryOptionCombos);
                    $scope.model.mappedRoles[pr.actionCode] = {};
                }
            }
        });        
        
        $scope.model.availableRoles = {};
        var reportParams = {orgUnit: $scope.selectedOrgUnit.id, 
                        programs: $scope.model.selectedPrograms, 
                        period: $scope.model.selectedPeriod, 
                        dataValueSetUrl: dataValueSetUrl};
        var reportData = {mappedRoles: $scope.model.mappedRoles,
                        programCodesById: $scope.model.programCodesById,
                        roleDataElementsById: $scope.model.roleDataElementsById,
                        whoDoesWhatCols: $scope.model.whoDoesWhatCols,
                        availableRoles: $scope.model.availableRoles,
                        mappedOptionCombos: $scope.model.mappedOptionCombos,
                        dataElementCodesById: $scope.model.dataElementCodesById
                    };
        
        ReportService.getReportData( reportParams, reportData ).then(function(response){            
            $scope.model.mappedRoles = response.mappedRoles;
            $scope.model.whoDoesWhatCols = response.whoDoesWhatCols;
            $scope.model.availableRoles = response.availableRoles;
            $scope.model.mappedValues = response.mappedValues;
            $scope.reportReady = response.reportReady;
            $scope.showReportFilters = response.showReportFilters;
            $scope.noDataExists = response.noDataExists;
            $scope.reportStarted = response.reportStarted;
        });        
    };
    
    $scope.getRequiredCols = function(){
        return ActionMappingUtils.getRequiredCols($scope.model.availableRoles, $scope.model.selectedRole);
    };
    
    $scope.valueExists = function(ou, de, oc){        
        var filteredValues = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: de});        
        if( !filteredValues || !filteredValues.length || filteredValues.length === 0 ){
            return "empty-data-row";
        }
        
        if( oc ){
            filteredValues = $filter('filter')($scope.model.mappedValues.dataValues, {categoryOptionCombo: oc});
            if( !filteredValues || !filteredValues.length || filteredValues.length === 0 ){
                return "empty-data-row";
            }
        }
        
        if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){
            var values = [];
            angular.forEach(filteredValues, function(val){            
                if( val.orgUnit === $scope.selectedOrgUnit.id || 
                        ( $scope.model.childrenByIds[val.orgUnit] &&
                        $scope.model.childrenByIds[val.orgUnit].path &&
                        $scope.model.childrenByIds[val.orgUnit].path.indexOf(ou.id) !== -1)
                        ){                    
                    values.push( val );
                }
            });
            
            if( values.length === 0 ){
                return "empty-data-row";
            }
        }        
    };
    
    $scope.getValuePerRole = function( ou, col, deId, ocId ){        
        var filteredValues = $filter('filter')($scope.model.mappedValues.dataValues, {dataElement: deId, categoryOptionCombo: ocId});
        var checkedOus = {};        
        var value = 0;            
        angular.forEach(filteredValues, function(val){
            if( val[$scope.model.selectedRole.id] && 
                    val[$scope.model.selectedRole.id].length 
                    && val[$scope.model.selectedRole.id].indexOf( col ) !== -1){
                
                if( $scope.model.childrenIds.indexOf( val.orgUnit ) === -1 ){
                    console.log('missing orgunit:  ', val.orgUnit);
                    return;
                }
                
                if($scope.model.selectedOuMode.level !== $scope.selectedOrgUnit.l ){
                    
                    if( val.orgUnit === $scope.selectedOrgUnit.id || 
                            ( $scope.model.childrenByIds[val.orgUnit] &&
                            $scope.model.childrenByIds[val.orgUnit].path &&
                            $scope.model.childrenByIds[val.orgUnit].path.indexOf(ou.id) !== -1)
                            ){                    
                        if( !checkedOus[col] ){
                            checkedOus[col] = [];
                        }
                        if( $scope.model.childrenIds.indexOf( val.orgUnit ) !== -1 && checkedOus[col].indexOf( val.orgUnit ) === -1){
                            value++;
                            checkedOus[col].push( val.orgUnit );
                        }
                    }
                }
                else{
                    if( !checkedOus[col] ){
                        checkedOus[col] = [];
                    }
                    if( $scope.model.childrenIds.indexOf( val.orgUnit ) !== -1 && checkedOus[col].indexOf( val.orgUnit ) === -1){
                        value++;
                        checkedOus[col].push( val.orgUnit );
                    }
                }
            }            
        });
        
        return value === 0 ? "" : value + " (" + ActionMappingUtils.getPercent( value, $scope.model.childrenIds.length) + ")";
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        saveAs(blob, "Report.xls");
    };
});
