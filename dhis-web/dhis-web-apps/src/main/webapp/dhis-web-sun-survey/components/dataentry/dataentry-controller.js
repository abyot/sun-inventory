/* global angular */

'use strict';

var sunSurvey = angular.module('sunSurvey');

//Controller for settings page
sunSurvey.controller('dataEntryController',
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
    $scope.dataValues = {};
    
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
                    overrideRoles: false,
                    dataElementGroupSets: []};
    
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
        $scope.dataValues = {};
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
        $scope.dataValues = {};
        $scope.model.valueExists = false;
        if (angular.isObject($scope.selectedOrgUnit)) {
            //get survey data sets
            DataSetFactory.getDataSetsByProperty( $scope.selectedOrgUnit, 'dataSetDomain', 'SURVEY' ).then(function(dataSets){                
                $scope.model.dataSets = dataSets;                
                if($scope.model.dataElementGroupSets.length === 0){
                    $scope.model.degs = {};
                    $scope.model.deg = {};                    
                    MetaDataFactory.getAll('dataElementGroupSets').then(function(dataElementGroupSets){                        
                        $scope.model.dataElementGroupSets = [];                        
                        angular.forEach(dataElementGroupSets, function(degs){
                            angular.forEach(degs.dataElementGroups, function(deg){
                                deg = dhis2.metadata.processMetaDataAttribute( deg );
                                if( deg.survey ){                                    
                                    if( deg.survey && $scope.model.dataElementGroupSets.indexOf( degs ) === -1 ){
                                        $scope.model.dataElementGroupSets.push( degs );
                                    }                                    
                                    angular.forEach(deg.dataElements, function(de){
                                        $scope.model.degs[de.id] = degs.name;
                                        $scope.model.deg[de.id] = deg.name;                                        
                                    });
                                }
                            });
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
        $scope.dataValues = {};
        $scope.model.selectedProgram = null;
        $scope.model.selectedEvent = {};
        $scope.model.orgUnitsWithValues = [];
        $scope.model.valueExists = false;
        if( angular.isObject($scope.model.selectedDataSet) && $scope.model.selectedDataSet.id){
            $scope.loadDataSetDetails();
        }
    });
    
    $scope.$watch('model.selectedPeriod', function(){        
        $scope.dataValues = {};
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
            $scope.dataValues = {};
            $scope.model.desById = {};
            angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                $scope.model.desById[de.id] = de;
                if( de.order ){
                    de.order = parseInt(de.order);
                }
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
        $scope.dataValues = {};
        $scope.dataValuesCopy = {};
        $scope.model.roleValues = {};
        $scope.model.orgUnitsWithValues = [];
        $scope.model.selectedEvent = {};
        $scope.model.valueExists = false;
        $scope.model.stakeholderRoles = {};
        $scope.model.basicAuditInfo = {};
        $scope.model.basicAuditInfo.exists = false;
        $scope.model.rolesAreDifferent = false;
        $scope.saveStatus = {};
        $scope.dataSetCompletness = {};
    };
    
    $scope.loadDataEntryForm = function(){
        
        resetParams();
        if( angular.isObject( $scope.selectedOrgUnit ) && $scope.selectedOrgUnit.id &&
                angular.isObject( $scope.model.selectedDataSet ) && $scope.model.selectedDataSet.id &&
                angular.isObject( $scope.model.selectedPeriod) && $scope.model.selectedPeriod.id &&                
                $scope.model.categoryOptionsReady ){
            
            var dataValueSetUrl = 'dataSet=' + $scope.model.selectedDataSet.id + '&period=' + $scope.model.selectedPeriod.id + '&orgUnit=' + $scope.selectedOrgUnit.id;            
            
            $scope.model.selectedAttributeOptionCombo = ActionMappingUtils.getOptionComboIdFromOptionNames($scope.model.selectedAttributeOptionCombos, $scope.model.selectedOptions, $scope.model.selectedAttributeCategoryCombo);

            //fetch data values...
            DataValueService.getDataValueSet( dataValueSetUrl ).then(function(response){
                if( response && response.dataValues && response.dataValues.length > 0 ){                    
                    response.dataValues = $filter('filter')(response.dataValues, {attributeOptionCombo: $scope.model.selectedAttributeOptionCombo});                    
                    if( response.dataValues.length > 0 ){
                        $scope.model.valueExists = true;
                        angular.forEach(response.dataValues, function(dv){
                            dv.value = ActionMappingUtils.formatDataValue( dv, $scope.model.desById[dv.dataElement], $scope.model.selectedCategoryCombos );
                            
                            if( $scope.model.desById[dv.dataElement].dimensionAsOptionSet){
                                $scope.dataValues[dv.dataElement] = dv.value;
                            }
                            else{
                                if(!$scope.dataValues[dv.dataElement]){
                                    $scope.dataValues[dv.dataElement] = {};
                                    $scope.dataValues[dv.dataElement][dv.categoryOptionCombo] = dv;
                                }
                                else{                                
                                    $scope.dataValues[dv.dataElement][dv.categoryOptionCombo] = dv;
                                }
                            }                                             
                        });
                        
                        response.dataValues = orderByFilter(response.dataValues, '-created').reverse();                    
                        $scope.model.basicAuditInfo.created = $filter('date')(response.dataValues[0].created, 'dd MMM yyyy');
                        $scope.model.basicAuditInfo.storedBy = response.dataValues[0].storedBy;
                        $scope.model.basicAuditInfo.exists = true;
                    }
                }                
                $scope.dataValuesCopy = angular.copy($scope.dataValues);
            });

            CompletenessService.get( $scope.model.selectedDataSet.id, 
                                    $scope.selectedOrgUnit.id,
                                    $scope.model.selectedPeriod.startDate,
                                    $scope.model.selectedPeriod.endDate,
                                    $scope.model.allowMultiOrgUnitEntry).then(function(response){                
                if( response && 
                        response.completeDataSetRegistrations && 
                        response.completeDataSetRegistrations.length &&
                        response.completeDataSetRegistrations.length > 0){
                    
                    angular.forEach(response.completeDataSetRegistrations, function(cdr){
                        $scope.dataSetCompletness[cdr.attributeOptionCombo.id] = true;
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
    
    $scope.saveDataValue = function( deId, ocId, dimensionAsOptionSet ){
        
        var dataValue = {ou: $scope.selectedOrgUnit.id, pe: $scope.model.selectedPeriod.id, de: deId};
        var status = {saved: false, pending: true, error: false};
        
        if( $scope.model.selectedAttributeCategoryCombo && !$scope.model.selectedAttributeCategoryCombo.isDefault ){
            dataValue.cc = $scope.model.selectedAttributeCategoryCombo.id;
            dataValue.cp = ActionMappingUtils.getOptionIds($scope.model.selectedOptions);
        }
        
        $scope.saveStatus[deId + '-' + ocId ] = status;
        
        if( !dimensionAsOptionSet ){
            dataValue.co = ocId;
            dataValue.value = $scope.dataValues[deId][ocId].value;
        }
        else{
            if( $scope.dataValues[deId] ){                
                dataValue.value = 1;                
                dataValue.co = ocId;                
                var oldValue = $scope.dataValuesCopy[deId];
                if( oldValue && oldValue.id ){
                    var _dataValue = {value: '', co: oldValue.id, ou: $scope.selectedOrgUnit.id, pe: $scope.model.selectedPeriod.id, de: deId};                    
                    if( $scope.model.selectedAttributeCategoryCombo && !$scope.model.selectedAttributeCategoryCombo.isDefault ){
                        _dataValue.cc = $scope.model.selectedAttributeCategoryCombo.id;
                        _dataValue.cp = ActionMappingUtils.getOptionIds($scope.model.selectedOptions);
                    }
                    DataValueService.saveDataValue( _dataValue );
                }                
            }
            else{                
                dataValue.co = $scope.dataValuesCopy[deId].id;
                dataValue.value = '';
            }
        }        
        
        DataValueService.saveDataValue( dataValue ).then(function(response){
            $scope.saveStatus[deId + '-' + ocId].saved = true;
            $scope.saveStatus[deId + '-' + ocId].pending = false;
            $scope.saveStatus[deId + '-' + ocId].error = false;            
            if( dimensionAsOptionSet ){
                $scope.dataValuesCopy[deId] = $scope.dataValues[deId] ? $scope.dataValues[deId] : '';
            }
        }, function(){
            $scope.saveStatus[deId + '-' + ocId].saved = false;
            $scope.saveStatus[deId + '-' + ocId].pending = false;
            $scope.saveStatus[deId + '-' + ocId].error = true;
        });
    };    
    
    $scope.getInputNotifcationClass = function(deId, ocId){        

        var currentElement = $scope.saveStatus[deId + '-' + ocId];
        
        var style = 'form-control';
        
        if( currentElement ){
            if(currentElement.pending){
                style = 'form-control input-pending';
            }

            if(currentElement.saved){
                style = 'form-control input-success';
            }            
            else{
                style = 'form-control input-error';
            }
        }
        
        return style;
    };    
    
    $scope.getAuditInfo = function(de, oco){
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
                    return $scope.dataValues[de.id][oco.id].value;
                },
                comment: function(){
                    return $scope.dataValues[de.id][oco.id].comment;
                },
                program: function () {
                    return $scope.model.selectedProgram;
                },
                orgUnitId: function(){
                    return  $scope.selectedOrgUnit.id;
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
                }
            }
        });
        
        modalInstance.result.then(function () {
        }); 
    };
        
    function processCompletness( isSave ){
        if( isSave ){
            $scope.dataSetCompletness[$scope.model.selectedAttributeOptionCombo] = true;
        }
        else{
            delete $scope.dataSetCompletness[$scope.model.selectedAttributeOptionCombo];
        }
    };
    
    $scope.saveCompletness = function(){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'save_completeness',
            bodyText: 'are_you_sure_to_save_completeness'
        };

        ModalService.showModal({}, modalOptions).then(function(result){
            
            CompletenessService.save($scope.model.selectedDataSet.id, 
                $scope.model.selectedPeriod.id, 
                $scope.selectedOrgUnit.id,
                $scope.model.selectedAttributeCategoryCombo.isDefault ? null : $scope.model.selectedAttributeCategoryCombo.id,
                $scope.model.selectedAttributeCategoryCombo.isDefault ? null : ActionMappingUtils.getOptionIds($scope.model.selectedOptions),
                false).then(function(response){
                    
                var dialogOptions = {
                    headerText: 'success',
                    bodyText: 'marked_complete'
                };
                DialogService.showDialog({}, dialogOptions);
                processCompletness(true);
                
            }, function(response){
                ActionMappingUtils.errorNotifier( response );
            });
        });        
    };
    
    $scope.deleteCompletness = function(){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'delete_completeness',
            bodyText: 'are_you_sure_to_delete_completeness'
        };

        ModalService.showModal({}, modalOptions).then(function(result){
            
            CompletenessService.delete($scope.model.selectedDataSet.id, 
                $scope.model.selectedPeriod.id, 
                $scope.selectedOrgUnit.id,
                $scope.model.selectedAttributeCategoryCombo.isDefault ? null : $scope.model.selectedAttributeCategoryCombo.id,
                $scope.model.selectedAttributeCategoryCombo.isDefault ? null : ActionMappingUtils.getOptionIds($scope.model.selectedOptions),
                false).then(function(response){
                
                var dialogOptions = {
                    headerText: 'success',
                    bodyText: 'marked_not_complete'
                };
                DialogService.showDialog({}, dialogOptions);
                processCompletness(false);
                
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
