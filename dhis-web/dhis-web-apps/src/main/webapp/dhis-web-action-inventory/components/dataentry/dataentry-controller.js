/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for settings page
sunPMT.controller('dataEntryController',
        function($scope,
                $filter,
                $modal,
                orderByFilter,
                SessionStorageService,
                storage,
                DataSetFactory,
                PeriodService,
                MetaDataFactory,
                ActionMappingUtils,
                DataValueService,
                CompletenessService,
                ModalService,
                DialogService) {
    $scope.periodOffset = 0;
    $scope.saveStatus = {};
    var addNewOption = {code: 'ADD_NEW_OPTION', id: 'ADD_NEW_OPTION', displayName: '[Add New Stakeholder]'};
    $scope.model = {invalidDimensions: false,
                    selectedAttributeCategoryCombo: null,
                    standardDataSets: [],
                    multiDataSets: [],
                    dataSets: [],
                    optionSets: null,
                    programs: null,
                    categoryOptionsReady: false,
                    allowMultiOrgUnitEntry: false,
                    selectedOptions: [],
                    stakeholderRoles: {},
                    dataValues: {},
                    roleValues: {},
                    orgUnitsWithValues: [],
                    selectedProgram: null,
                    selectedAttributeOptionCombos: {},
                    selectedAttributeOptionCombo: null,
                    selectedEvent: {},
                    stakeholderCategory: null,
                    attributeCategoryUrl: null,
                    valueExists: false,
                    rolesAreDifferent: false,
                    overrideRoles: false};
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {
        $scope.model.periods = [];
        $scope.model.dataSets = [];
        $scope.model.selectedDataSet = null;
        $scope.model.selectedPeriod = null;
        $scope.model.selectedAttributeCategoryCombo = null;
        $scope.model.selectedAttributeOptionCombos = {};
        $scope.model.selectedAttributeOptionCombo = null;
        $scope.model.selectedProgram = null;
        $scope.model.stakeholderRoles = {};
        $scope.model.dataValues = {};
        $scope.model.basicAuditInfo = {};
        $scope.model.selectedEvent = {};
        $scope.model.orgUnitsWithValues = [];
        $scope.model.categoryOptionsReady = false;
        $scope.model.valueExists = false;
        if( angular.isObject($scope.selectedOrgUnit)){
            SessionStorageService.set('SELECTED_OU', $scope.selectedOrgUnit); 
            var systemSetting = storage.get('SYSTEM_SETTING');
            $scope.model.allowMultiOrgUnitEntry = systemSetting && systemSetting.multiOrganisationUnitForms ? systemSetting.multiOrganisationUnitForms : false;
            loadOptionSets();
            $scope.loadDataSets($scope.selectedOrgUnit);
        }
    });
        
    function loadOptionSets() {        
        if(!$scope.model.optionSets){
            $scope.model.optionSets = [];
            MetaDataFactory.getAll('optionSets').then(function(optionSets){
                angular.forEach(optionSets, function(optionSet){
                    $scope.model.optionSets[optionSet.id] = optionSet;
                });
            });
        }
    }
    
    function loadOptionCombos(){
        $scope.model.selectedAttributeCategoryCombo = null;     
        if( $scope.model.selectedDataSet && $scope.model.selectedDataSet.categoryCombo && $scope.model.selectedDataSet.categoryCombo.id ){
            MetaDataFactory.get('categoryCombos', $scope.model.selectedDataSet.categoryCombo.id).then(function(coc){
                $scope.model.selectedAttributeCategoryCombo = coc;
                if( $scope.model.selectedAttributeCategoryCombo && $scope.model.selectedAttributeCategoryCombo.isDefault ){
                    $scope.model.categoryOptionsReady = true;
                }                
                angular.forEach($scope.model.selectedAttributeCategoryCombo.categoryOptionCombos, function(oco){
                    $scope.model.selectedAttributeOptionCombos['"' + oco.displayName + '"'] = oco.id;
                });
            });
        }
    }    
    
    //load datasets associated with the selected org unit.
    $scope.loadDataSets = function(orgUnit) {
        $scope.selectedOrgUnit = orgUnit;
        $scope.model.dataSets = [];
        $scope.model.selectedAttributeCategoryCombo = null;
        $scope.model.selectedAttributeOptionCombos = {};
        $scope.model.selectedAttributeOptionCombo = null;
        $scope.model.selectedProgram = null;
        $scope.model.selectedPeriod = null;  
        $scope.model.stakeholderRoles = {};
        $scope.model.orgUnitsWithValues = [];
        $scope.model.selectedEvent = {};
        $scope.model.dataValues = {};
        $scope.model.valueExists = false;
        if (angular.isObject($scope.selectedOrgUnit)) {            
            DataSetFactory.getDataSets( $scope.selectedOrgUnit ).then(function(dataSets){
                $scope.model.dataSets = $filter('filter')(dataSets, {entryMode: 'Multiple Entry'});
                $scope.model.dataSets = orderByFilter($scope.model.dataSets, '-displayName').reverse();
                if(!$scope.model.dataElementGroupSets){
                    $scope.model.degs = {};
                    $scope.model.deg = {};
                    MetaDataFactory.getAll('dataElementGroupSets').then(function(dataElementGroupSets){                                                                        
                        $scope.model.dataElementGroupSets = [];
                        angular.forEach(dataElementGroupSets, function(degs){
                            if( degs.name.indexOf("Outcome") === -1 ){
                                $scope.model.dataElementGroupSets.push( degs );
                                angular.forEach(degs.dataElementGroups, function(deg){
                                    angular.forEach(deg.dataElements, function(de){
                                        $scope.model.degs[de.id] = degs.name;
                                        $scope.model.deg[de.id] = deg.name;
                                    });
                                });
                            }                            
                        });
                    });
                }
            });
        }
    }; 
    
    //watch for selection of data set
    $scope.$watch('model.selectedDataSet', function() {        
        $scope.model.periods = [];
        $scope.model.selectedPeriod = null;
        $scope.model.categoryOptionsReady = false;
        $scope.model.stakeholderRoles = {};
        $scope.model.dataValues = {};
        $scope.model.selectedProgram = null;
        $scope.model.selectedEvent = {};
        $scope.model.orgUnitsWithValues = [];
        $scope.model.valueExists = false;
        if( angular.isObject($scope.model.selectedDataSet) && $scope.model.selectedDataSet.id){
            $scope.loadDataSetDetails();
        }
    });
    
    $scope.$watch('model.selectedPeriod', function(){        
        $scope.model.dataValues = {};
        $scope.model.valueExists = false;
        $scope.loadDataEntryForm();
    });    
        
    $scope.loadDataSetDetails = function(){
        if( $scope.model.selectedDataSet && $scope.model.selectedDataSet.id && $scope.model.selectedDataSet.periodType){ 
            
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.model.periodOffset);
            
            if(!$scope.model.selectedDataSet.dataElements || $scope.model.selectedDataSet.dataElements.length < 1){                
                $scope.invalidCategoryDimensionConfiguration('error', 'missing_data_elements_indicators');
                return;
            }            
            
            loadOptionCombos();            
            
            $scope.model.selectedCategoryCombos = {};
            $scope.model.dataElements = [];
            angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                MetaDataFactory.get('categoryCombos', de.categoryCombo.id).then(function(coc){
                    if( coc.isDefault ){
                        $scope.model.defaultCategoryCombo = coc;
                    }
                    $scope.model.selectedCategoryCombos[de.categoryCombo.id] = coc;
                });                
            });
        }
    };
    
    var resetParams = function(){
        $scope.model.dataValues = {};
        $scope.model.roleValues = {};
        $scope.model.orgUnitsWithValues = [];
        $scope.model.selectedEvent = {};
        $scope.model.valueExists = false;
        $scope.model.stakeholderRoles = {};
        $scope.model.basicAuditInfo = {};
        $scope.model.basicAuditInfo.exists = false;
        $scope.model.rolesAreDifferent = false;
        $scope.saveStatus = {};
    };
    
    $scope.loadDataEntryForm = function(){
        
        resetParams();
        if( angular.isObject( $scope.selectedOrgUnit ) && $scope.selectedOrgUnit.id &&
                angular.isObject( $scope.model.selectedDataSet ) && $scope.model.selectedDataSet.id &&
                angular.isObject( $scope.model.selectedPeriod) && $scope.model.selectedPeriod.id &&                
                $scope.model.categoryOptionsReady ){
            
            var dataValueSetUrl = 'dataSet=' + $scope.model.selectedDataSet.id + '&period=' + $scope.model.selectedPeriod.id;

            if( $scope.model.allowMultiOrgUnitEntry && $scope.model.selectedDataSet.entryMode === 'Multiple Entry'){
                angular.forEach($scope.selectedOrgUnit.c, function(c){
                    dataValueSetUrl += '&orgUnit=' + c;
                });
            }
            else{
                dataValueSetUrl += '&orgUnit=' + $scope.selectedOrgUnit.id;                
            }
            
            $scope.model.selectedAttributeOptionCombo = ActionMappingUtils.getOptionComboIdFromOptionNames($scope.model.selectedAttributeOptionCombos, $scope.model.selectedOptions);

            //fetch data values...
            DataValueService.getDataValueSet( dataValueSetUrl ).then(function(response){
                if( response && response.dataValues && response.dataValues.length > 0 ){                    
                    response.dataValues = $filter('filter')(response.dataValues, {attributeOptionCombo: $scope.model.selectedAttributeOptionCombo});                    
                    if( response.dataValues.length > 0 ){
                        $scope.model.valueExists = true;
                        angular.forEach(response.dataValues, function(dv){
                            if(!$scope.model.dataValues[dv.orgUnit]){
                                $scope.model.dataValues[dv.orgUnit] = {};
                                $scope.model.dataValues[dv.orgUnit][dv.dataElement] = {};
                                $scope.model.dataValues[dv.orgUnit][dv.dataElement][dv.categoryOptionCombo] = dv;
                            }
                            else{
                                if(!$scope.model.dataValues[dv.orgUnit][dv.dataElement]){
                                    $scope.model.dataValues[dv.orgUnit][dv.dataElement] = {};
                                }
                                $scope.model.dataValues[dv.orgUnit][dv.dataElement][dv.categoryOptionCombo] = dv;
                            }                 
                        });
                        response.dataValues = orderByFilter(response.dataValues, '-created').reverse();                    
                        $scope.model.basicAuditInfo.created = $filter('date')(response.dataValues[0].created, 'dd MMM yyyy');
                        $scope.model.basicAuditInfo.storedBy = response.dataValues[0].storedBy;
                        $scope.model.basicAuditInfo.exists = true;
                    }
                }                
            });
            
            $scope.model.dataSetCompleted = false; 
            CompletenessService.get( $scope.model.selectedDataSet.id, 
                                    $scope.selectedOrgUnit.id,
                                    $scope.model.selectedPeriod.startDate,
                                    $scope.model.selectedPeriod.endDate,
                                    $scope.model.allowMultiOrgUnitEntry).then(function(response){                
                if( response && 
                        response.completeDataSetRegistrations && 
                        response.completeDataSetRegistrations.length &&
                        response.completeDataSetRegistrations.length > 0){
                    $scope.model.dataSetCompleted = true;
                    
                    $scope.model.dataSetCompletness = {};
                    angular.forEach(response.completeDataSetRegistrations, function(cdr){
                        if( cdr.attributeOptionCombo.id === $scope.model.selectedAttributeOptionCombo ){
                            $scope.model.dataSetCompletness[cdr.organisationUnit.id] = true;
                        }                        
                    });
                }
            });
            
            angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                de.dataElementGroupSet = $scope.model.degs[de.id];
                de.dataElementGroup = $scope.model.deg[de.id];
            });
            
        }
    };
    
    function checkOptions(){
        resetParams();
        for(var i=0; i<$scope.model.selectedAttributeCategoryCombo.categories.length; i++){
            if($scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption && $scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption.id){
                $scope.model.categoryOptionsReady = true;
                $scope.model.selectedOptions.push($scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption);
            }
            else{
                $scope.model.categoryOptionsReady = false;
                break;
            }
        }        
        if($scope.model.categoryOptionsReady){
            $scope.loadDataEntryForm();
        }
    };
    
    $scope.getCategoryOptions = function(category){
        $scope.model.categoryOptionsReady = false;
        $scope.model.selectedOptions = [];
        
        if( category && category.selectedOption && category.selectedOption.id === 'ADD_NEW_OPTION' ){
            category.selectedOption = null;
            showAddStakeholder( category );
        }        
        else{
            checkOptions();
        }        
    };
    
    $scope.getPeriods = function(mode){
        
        if( mode === 'NXT'){
            $scope.periodOffset = $scope.periodOffset + 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset);
        }
        else{
            $scope.periodOffset = $scope.periodOffset - 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset);
        }
    };
    
    $scope.saveDataValue = function( ouId, deId, ocId ){
        
        $scope.saveStatus[ouId + '-' + deId + '-' + ocId] = {saved: false, pending: true, error: false};
        
        var dataValue = {ou: ouId,
                    pe: $scope.model.selectedPeriod.id,
                    de: deId,
                    co: ocId,
                    cc: $scope.model.selectedAttributeCategoryCombo.id,
                    cp: ActionMappingUtils.getOptionIds($scope.model.selectedOptions),
                    value: $scope.model.dataValues[ouId][deId][ocId].value
                };
                
        DataValueService.saveDataValue( dataValue ).then(function(response){
           $scope.saveStatus[ouId + '-' + deId + '-' + ocId].saved = true;
           $scope.saveStatus[ouId + '-' + deId + '-' + ocId].pending = false;
           $scope.saveStatus[ouId + '-' + deId + '-' + ocId].error = false;
        }, function(){
            $scope.saveStatus[ouId + '-' + deId + '-' + ocId].saved = false;
            $scope.saveStatus[ouId + '-' + deId + '-' + ocId].pending = false;
            $scope.saveStatus[ouId + '-' + deId + '-' + ocId].error = true;
        });
    };    
    
    $scope.getInputNotifcationClass = function(ouId, deId, ocId){

        var currentElement = $scope.saveStatus[ouId + '-' + deId + '-' + ocId];        
        
        if( currentElement ){
            if(currentElement.pending){
                return 'form-control input-pending';
            }

            if(currentElement.saved){
                return 'form-control input-success';
            }            
            else{
                return 'form-control input-error';
            }
        }    
        
        return 'form-control';
    };    
    
    $scope.getAuditInfo = function(de, ouId, oco, value, comment){        
        var modalInstance = $modal.open({
            templateUrl: 'components/dataentry/history.html',
            controller: 'DataEntryHistoryController',
            windowClass: 'modal-window-history',
            resolve: {
                period: function(){
                    return $scope.model.selectedPeriod;
                },
                dataElement: function(){
                    return de;
                },
                value: function(){
                    return value;
                },
                comment: function(){
                    return comment;
                },
                program: function () {
                    return $scope.model.selectedProgram;
                },
                orgUnitId: function(){
                    return  ouId;
                },
                attributeCategoryCombo: function(){
                    return $scope.model.selectedAttributeCategoryCombo;
                },
                attributeCategoryOptions: function(){
                    return ActionMappingUtils.getOptionIds($scope.model.selectedOptions);
                },
                attributeOptionCombo: function(){
                    return $scope.model.selectedAttributeOptionCombo;
                },
                optionCombo: function(){
                    return oco;
                },
                currentEvent: function(){
                    return $scope.model.selectedEvent[ouId];
                }
            }
        });
        
        modalInstance.result.then(function () {
        }); 
    };
        
    function processCompletness( orgUnit, multiOrgUnit, isSave ){
        if( multiOrgUnit ){
            angular.forEach($scope.selectedOrgUnit.c, function(ou){                
                if( isSave ){
                    if( angular.isUndefined( $scope.model.dataSetCompletness) ){
                        $scope.model.dataSetCompletness = {};
                    }
                    $scope.model.dataSetCompletness[ou] = true;
                }
                else{
                    delete $scope.model.dataSetCompletness[ou];
                }
            });
        }
        else{
            if( isSave ){
                $scope.model.dataSetCompletness[orgUnit] = true;
            }
            else{
                delete $scope.model.dataSetCompletness[orgUnit];
            }
        }
    };
    
    $scope.saveCompletness = function(orgUnit, multiOrgUnit){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'save_completeness',
            bodyText: 'are_you_sure_to_save_completeness'
        };

        ModalService.showModal({}, modalOptions).then(function(result){
            
            CompletenessService.save($scope.model.selectedDataSet.id, 
                $scope.model.selectedPeriod.id, 
                orgUnit,
                $scope.model.selectedAttributeCategoryCombo.id,
                ActionMappingUtils.getOptionIds($scope.model.selectedOptions),
                multiOrgUnit).then(function(response){
                    
                var dialogOptions = {
                    headerText: 'success',
                    bodyText: 'marked_complete'
                };
                DialogService.showDialog({}, dialogOptions);
                processCompletness(orgUnit, multiOrgUnit, true);
                $scope.model.dataSetCompleted = angular.equals({}, $scope.model.dataSetCompletness);
                
            }, function(response){
                ActionMappingUtils.errorNotifier( response );
            });
        });        
    };
    
    $scope.deleteCompletness = function( orgUnit, multiOrgUnit){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'delete_completeness',
            bodyText: 'are_you_sure_to_delete_completeness'
        };

        ModalService.showModal({}, modalOptions).then(function(result){
            
            CompletenessService.delete($scope.model.selectedDataSet.id, 
                $scope.model.selectedPeriod.id, 
                orgUnit,
                $scope.model.selectedAttributeCategoryCombo.id,
                ActionMappingUtils.getOptionIds($scope.model.selectedOptions),
                multiOrgUnit).then(function(response){
                
                var dialogOptions = {
                    headerText: 'success',
                    bodyText: 'marked_not_complete'
                };
                DialogService.showDialog({}, dialogOptions);
                processCompletness(orgUnit, multiOrgUnit, false);
                $scope.model.dataSetCompleted = !angular.equals({}, $scope.model.dataSetCompletness);
                
            }, function(response){
                ActionMappingUtils.errorNotifier( response );
            });
        });        
    };
    
    $scope.setCurrentDataElementGroup = function(deg){
        $scope.currentDataElementGroup = deg;
    };
    
    $scope.setCurrentDataElement = function(de){
        $scope.currentDataElement = de;
    };
});
