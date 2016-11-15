/* global angular */

'use strict';

var sunInventory = angular.module('sunInventory');

//Controller for settings page
sunInventory.controller('dataEntryController',
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
                    showButtonInfo: false,
                    selectedAttributeCategoryCombo: null,
                    standardDataSets: [],
                    multiDataSets: [],
                    dataSets: [],
                    optionSets: null,
                    programs: null,
                    categoryOptionsReady: false,
                    allowMultiOrgUnitEntry: false,
                    selectedOptions: [],
                    dataValues: {},
                    orgUnitsWithValues: [],
                    selectedProgram: null,
                    selectedAttributeOptionCombos: {},
                    selectedAttributeOptionCombo: null,
                    stakeholderCategory: null,
                    attributeCategoryUrl: null,
                    dataElementGroupSets: [],
                    mappedCategoryCombos: [],
                    mappedOptionCombos: [],
                    mappedOptionCombosById: [],
                    mappedOptionComboIds: []};
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {
        $scope.model.periods = [];
        $scope.model.dataSets = [];
        $scope.pushedOptions = {};
        $scope.model.selectedDataSet = null;
        $scope.model.selectedPeriod = null;
        $scope.model.selectedAttributeCategoryCombo = null;
        $scope.model.selectedAttributeOptionCombos = {};
        $scope.model.selectedAttributeOptionCombo = null;
        $scope.model.selectedProgram = null;
        $scope.dataValues = {};
        $scope.model.basicAuditInfo = {};
        $scope.model.orgUnitsWithValues = [];
        $scope.model.categoryOptionsReady = false;
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
            
            var optionGroupByMembers = [];
            MetaDataFactory.getAll('categoryOptionGroups').then(function(categoryOptionGroups){
                $scope.model.categoryOptionGroups = [];
                angular.forEach(categoryOptionGroups, function(cog){
                    
                    if( cog.dataSetDomain === 'INVENTORY' ){
                        angular.forEach(cog.categoryOptions, function(co){
                            optionGroupByMembers[co.name] = cog;
                        });
                        $scope.model.categoryOptionGroups.push(cog);
                    }                     
                });
                
                var orderedOptionGroup = {};                            
                MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                    angular.forEach(ccs, function(cc){
                        if( cc.isDefault ){
                            $scope.model.defaultCategoryCombo = cc;
                            $scope.model.defaultOptionCombo = cc.categoryOptionCombos[0];
                        }
                        $scope.pushedOptions[cc.id] = [];

                        if( cc.categories && cc.categories.length === 1 && cc.categories[0].categoryOptions ){

                            var sortedOptions = [];
                            angular.forEach(cc.categories[0].categoryOptions, function(co){
                                sortedOptions.push( co.displayName );
                            });

                            cc.categoryOptionCombos = _.sortBy( cc.categoryOptionCombos, function(coc){
                                return sortedOptions.indexOf( coc.displayName );
                            });
                            
                            if( cc.displayName === 'Action inventory dimensions' ){
                                for(var i=0; i< cc.categoryOptionCombos.length; i++){
                                    $scope.model.mappedOptionCombos[cc.categoryOptionCombos[i].displayName] = cc.categoryOptionCombos[i];
                                    $scope.model.mappedOptionCombosById[cc.categoryOptionCombos[i].id] = cc.categoryOptionCombos[i];
                                    var og = optionGroupByMembers[cc.categoryOptionCombos[i].displayName];
                                    if( og ){                                    
                                        cc.categoryOptionCombos[i].categoryOptionGroup = og;
                                        if( !orderedOptionGroup[og.id] ){
                                            orderedOptionGroup[og.id] = i;
                                        }
                                    }
                                }                            

                                angular.forEach($scope.model.categoryOptionGroups, function(cog){
                                    cog.order = orderedOptionGroup[cog.id];
                                });
                            }                            
                        }
                        
                        else{
                            angular.forEach(cc.categoryOptionCombos, function(oco){
                                $scope.model.mappedOptionComboIds[oco.displayName] = oco.id;
                            });
                        }
                        
                        $scope.model.mappedCategoryCombos[cc.id] = cc;
                    });
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
        $scope.model.orgUnitsWithValues = [];
        $scope.dataValues = {};
        if (angular.isObject($scope.selectedOrgUnit)) {
            //get survey data sets
            DataSetFactory.getDataSetsByProperty( $scope.selectedOrgUnit, 'dataSetDomain', 'INVENTORY' ).then(function(dataSets){
                $scope.model.dataSets = dataSets;
                
                angular.forEach($scope.model.dataSets, function(ds){
                    if( ds.dataElements && ds.dataElements.length === 1 ){
                        if( ds.dataElements[0] ){
                            if( ds.dataElements[0].dataElementGroups && ds.dataElements[0].dataElementGroups.length ){
                                angular.forEach(ds.dataElements[0].dataElementGroups, function(deg){
                                    deg = dhis2.metadata.processMetaDataAttribute( deg );
                                    var groupNames = deg.name.split(" - ");                                        
                                    if( groupNames[1] && groupNames[1] !== "" ){
                                        ds.groupType = groupNames[1];
                                    }
                                });
                            }
                        }
                    }
                });
                
                /*if($scope.model.dataElementGroupSets.length === 0){
                    $scope.model.degs = {};
                    $scope.model.deg = {}; 
                    $scope.model.dataElementGroupsById = {};
                    MetaDataFactory.getAll('dataElementGroupSets').then(function(dataElementGroupSets){                        
                        $scope.model.dataElementGroupSets = [];                        
                        angular.forEach(dataElementGroupSets, function(degs){
                            angular.forEach(degs.dataElementGroups, function(deg){
                                deg = dhis2.metadata.processMetaDataAttribute( deg );
                                if( deg.survey ){                                    
                                    if( deg.survey && $scope.model.dataElementGroupSets.indexOf( degs ) === -1 ){
                                        degs.active = false;
                                        $scope.model.dataElementGroupSets.push( degs );
                                    }
                                    
                                    angular.forEach(deg.dataElements, function(de){
                                        de = dhis2.metadata.processMetaDataAttribute( de );
                                        $scope.model.degs[de.id] = {name: degs.name, id: degs.id, code: degs.code};
                                        $scope.model.deg[de.id] = {name: deg.name, id: deg.id, code: deg.shortName};
                                    });
                                    
                                    deg.dataElements = orderByFilter(deg.dataElements, '-order').reverse(); 
                                }
                                $scope.model.dataElementGroupsById[deg.id] = deg;
                            });
                        });
                    });
                }*/
            });
        }
    };
    
    //watch for selection of data set
    $scope.$watch('model.selectedDataSet', function() {        
        $scope.model.periods = [];
        $scope.model.selectedPeriod = null;
        $scope.model.categoryOptionsReady = false;
        $scope.dataValues = {};
        $scope.model.selectedProgram = null;
        $scope.model.orgUnitsWithValues = [];
        if( angular.isObject($scope.model.selectedDataSet) && $scope.model.selectedDataSet.id){
            $scope.loadDataSetDetails();
        }
    });
    
    $scope.$watch('model.selectedPeriod', function(){
        $scope.loadDataEntryForm();
    });
    
    $scope.pushOption = function(categoryComboId, optionName){
        if( !$scope.pushedOptions[categoryComboId] ){
            $scope.pushedOptions[categoryComboId] = [];
            $scope.pushedOptions[categoryComboId].push( optionName );
        }
        if( $scope.pushedOptions[categoryComboId].indexOf( optionName ) === -1 ){
            $scope.pushedOptions[categoryComboId].push( optionName );
        }
    };
    
    $scope.getRowSpan = function( optionCombos, optionName ){
        var occurance = 0;        
        angular.forEach(optionCombos, function(oc){
            if( oc.displayName.startsWith(optionName, 0) ){
                occurance++;
            }
        });
        return occurance;
    };
        
    $scope.loadDataSetDetails = function(){
        if( $scope.model.selectedDataSet && $scope.model.selectedDataSet.id && $scope.model.selectedDataSet.periodType){
            
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset, $scope.model.selectedDataSet.openFuturePeriods);
            
            if(!$scope.model.selectedDataSet.dataElements || $scope.model.selectedDataSet.dataElements.length < 1){
                ActionMappingUtils.notificationDialog('error', 'missing_data_elements');
                return;
            }            
                        
            if( $scope.model.selectedDataSet.categoryCombo && $scope.model.selectedDataSet.categoryCombo.id ){
                $scope.model.selectedAttributeCategoryCombo = angular.copy( $scope.model.mappedCategoryCombos[$scope.model.selectedDataSet.categoryCombo.id] );
            }
                        
            $scope.model.dataElements = [];
            $scope.dataValues = {};
            $scope.desById = {};
            angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                $scope.desById[de.id] = de;
                if( de.order ){
                    de.order = parseInt(de.order);
                }                                
            });
        }
    };
    
    var resetParams = function(){
        $scope.dataValues = {};
        $scope.dataValuesCopy = {};
        $scope.model.basicAuditInfo = {};
        $scope.model.basicAuditInfo.exists = false;
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
            
            $scope.model.selectedAttributeOptionCombo = ActionMappingUtils.getOptionComboIdFromOptionNames($scope.model.mappedOptionComboIds, $scope.model.selectedOptions, $scope.model.selectedAttributeCategoryCombo);
            
            //fetch data values...
            DataValueService.getDataValueSet( dataValueSetUrl ).then(function(response){
                
                if( response && response.dataValues && response.dataValues.length > 0 ){                    
                    response.dataValues = $filter('filter')(response.dataValues, {attributeOptionCombo: $scope.model.selectedAttributeOptionCombo});
                    
                    if( response.dataValues.length > 0 ){
                        
                        angular.forEach(response.dataValues, function(dv){
                            
                            if( dv && dv.value && dv.categoryOptionCombo ){
                                
                                var oco = $scope.model.mappedOptionCombosById[dv.categoryOptionCombo];
                                
                                if( oco && oco.categoryOptionGroup && oco.categoryOptionGroup.id ){
                                    
                                    if( !$scope.dataValues[dv.dataElement] ){
                                        $scope.dataValues[dv.dataElement] = {};
                                    }
                                    
                                    switch( oco.categoryOptionGroup.dimensionEntryMode ){                                            
                                        case 'SINGLE':
                                            if( !$scope.dataValues[dv.dataElement][oco.categoryOptionGroup.id] ){                                        
                                                $scope.dataValues[dv.dataElement][oco.categoryOptionGroup.id] = {};
                                            }                                            
                                            $scope.dataValues[dv.dataElement][oco.categoryOptionGroup.id] = oco;
                                            break;
                                        case 'MULTIPLE':
                                            if( !$scope.dataValues[dv.dataElement][oco.categoryOptionGroup.id] ){                                        
                                                $scope.dataValues[dv.dataElement][oco.categoryOptionGroup.id] = [];
                                            }
                                            $scope.dataValues[dv.dataElement][oco.categoryOptionGroup.id].push( oco );
                                            break;
                                        default:                                                
                                    }                                                                        
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
    
    $scope.getCategoryOptions = function(){
        $scope.model.categoryOptionsReady = false;
        $scope.model.selectedOptions = [];        
        checkOptions();       
    };
    
    $scope.getPeriods = function(mode){
        
        if( mode === 'NXT'){
            $scope.periodOffset = $scope.periodOffset + 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset, $scope.model.selectedDataSet.openFuturePeriods);
        }
        else{
            $scope.periodOffset = $scope.periodOffset - 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset, $scope.model.selectedDataSet.openFuturePeriods);
        }
    };
    
    var statusNotifier = function( deId, cogId, success ){
        $scope.saveStatus[deId + '-' + cogId].saved = success;
        $scope.saveStatus[deId + '-' + cogId].pending = false;
        $scope.saveStatus[deId + '-' + cogId].error = !success;
    };
    
    $scope.saveDataValue = function( deId, ocId, cog, saveMultiple ){
        
        var dataElement = $scope.desById[deId];
        
        if( !dataElement || !$scope.dataValues[deId] ){
            return;
        }
            
        var dataValue = {ou: $scope.selectedOrgUnit.id, pe: $scope.model.selectedPeriod.id, de: deId};
        var status = {saved: false, pending: true, error: false};
        
        if( $scope.model.selectedAttributeCategoryCombo && !$scope.model.selectedAttributeCategoryCombo.isDefault ){
            dataValue.cc = $scope.model.selectedAttributeCategoryCombo.id;
            dataValue.cp = ActionMappingUtils.getOptionIds($scope.model.selectedOptions);
        }
        
        $scope.saveStatus[deId + '-' + cog.id ] = status;
        
        if( saveMultiple ){
            var dataValueSet = {
                                dataSet: $scope.model.selectedDataSet.id,
                                period: $scope.model.selectedPeriod.id,
                                orgUnit: $scope.selectedOrgUnit.id,
                                dataValues: []
                              };
            
            var oldValues = angular.copy( $scope.dataValuesCopy[deId] );
            var processedCos = [];
            angular.forEach($scope.model.mappedCategoryCombos[dataElement.categoryCombo.id].categoryOptionCombos, function(oco){
                
                var val = {dataElement: deId, categoryOptionCombo: oco.id, attributeOptionCombo: $scope.model.selectedAttributeOptionCombo, value: ''};
                
                if( $scope.dataValues[deId] && $scope.dataValues[deId][cog.id] && $scope.dataValues[deId][cog.id].length ){
                    
                    for( var i=0; i<$scope.dataValues[deId][cog.id].length; i++){
                        if( $scope.dataValues[deId][cog.id][i] && $scope.dataValues[deId][cog.id][i].id === oco.id ){
                            val.value = 1;
                            dataValueSet.dataValues.push( val );
                            processedCos.push( oco.id );
                            break;
                        }
                    }
                }
                    
                if( processedCos.indexOf( oco.id) === -1 ){
                    if( oldValues && oldValues[cog.id] && oldValues[cog.id].length ){                        
                        for( var i=0; i<oldValues[cog.id].length; i++){                            
                            if( oldValues[cog.id][i] && oldValues[cog.id][i].id === oco.id ){                                    
                                dataValueSet.dataValues.push( val );
                                processedCos.push( oco.id );                                
                                break;
                            }
                        }
                    }
                }
            });            
            
            DataValueService.saveDataValueSet( dataValueSet, $scope.model.selectedAttributeCategoryCombo.id, ActionMappingUtils.getOptionIds($scope.model.selectedOptions) ).then(function(){
                $scope.dataValuesCopy[deId] = angular.copy( $scope.dataValues[deId] );
                statusNotifier( deId, cog.id, true );
            }, function(){
                statusNotifier( deId, cog.id, false );
            });
        }
        else{            
            if( $scope.dataValues[deId] && $scope.dataValues[deId][cog.id] ){                
                dataValue.value = 1;                
                dataValue.co = ocId;                
                var oldValue = $scope.dataValuesCopy[deId] && $scope.dataValuesCopy[deId][cog.id] ? $scope.dataValuesCopy[deId][cog.id] : null;
                if( oldValue && oldValue.id ){
                    var _dataValue = {value: '', co: oldValue.id, ou: $scope.selectedOrgUnit.id, pe: $scope.model.selectedPeriod.id, de: deId};                    
                    if( dataValue.cc && dataValue.cp ){
                        _dataValue.cc = dataValue.cc;
                        _dataValue.cp = dataValue.cp;
                    }
                    
                    DataValueService.deleteDataValue( _dataValue ).then(function(){
                        $scope.dataValuesCopy[deId] = angular.copy( $scope.dataValues[deId] );
                        statusNotifier( deId, cog.id, true );
                    }, function(){
                        statusNotifier( deId, cog.id, false );
                    });
                }                
            }
            else{
                if( $scope.dataValuesCopy[deId] && $scope.dataValuesCopy[deId][cog.id] ){
                    dataValue.co = $scope.dataValuesCopy[deId][cog.id].id;
                    DataValueService.deleteDataValue( dataValue ).then(function(){
                        $scope.dataValuesCopy[deId] = angular.copy( $scope.dataValues[deId] );
                        statusNotifier( deId, cog.id, true );
                    }, function(){
                        statusNotifier( deId, cog.id, false );
                    });
                }                
            }
            
            if( $scope.dataValues[deId] && $scope.dataValues[deId][cog.id] ){                
                dataValue.value = 1;
                dataValue.co = ocId;
                DataValueService.saveDataValue( dataValue, $scope.dataValuesCopy, dataElement, $scope.model.mappedOptionCombosById ).then(function(){
                    $scope.dataValuesCopy[deId] = angular.copy( $scope.dataValues[deId] );                    
                    statusNotifier( deId, cog.id, true );
                }, function(){
                    statusNotifier( deId, cog.id, false );
                });
            }
        }
    };
    
    $scope.dataValueExists = function(){
        return !angular.equals( {}, $scope.dataValues );
    };
    
    $scope.showDataCopyDialog = function(){
        
        var selectedDataElement = $scope.model.selectedDataSet.dataElements[0];
        
        var modalInstance = $modal.open({
            templateUrl: 'components/copydata/copy-data.html',
            controller: 'CopyDataController',
            resolve: {
                dataValues: function(){
                    return angular.copy( $scope.dataValues[selectedDataElement.id] ) ;
                },
                selectedOrgUnitId: function(){
                    return $scope.selectedOrgUnit.id;
                },
                selectedDataSet: function(){
                    return $scope.model.selectedDataSet;
                },
                selectedDataElement: function () {
                    return selectedDataElement;
                },
                selectedPeriod: function(){
                    return $scope.model.selectedPeriod;
                },
                attributeOptionCombo: function(){
                    return $scope.model.selectedAttributeOptionCombo;
                },
                selectedCategoryCombo: function(){
                    return $scope.model.mappedCategoryCombos[selectedDataElement.categoryCombo.id];
                }
            }
        });

        modalInstance.result.then(function () {
        });
    };
    
    $scope.getInputNotifcationClass = function(deId, cogId){        

        var currentElement = $scope.saveStatus[deId + '-' + cogId];
        
        if( currentElement ){
            if(currentElement.pending){
                return 'input-pending';
            }

            if(currentElement.saved){
                return 'input-success';
            }            
            else{
                return 'input-error';
            }
        }
        
        return '';
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
                    return $scope.dataValues[de.id] && $scope.dataValues[de.id][oco.id] && $scope.dataValues[de.id][oco.id].value ? $scope.dataValues[de.id][oco.id].value : '';
                },
                comment: function(){
                    return $scope.dataValues[de.id] && $scope.dataValues[de.id][oco.id] && $scope.dataValues[de.id][oco.id].comment ? $scope.dataValues[de.id][oco.id].comment : '';
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
    
    $scope.displayReport = function(){
        console.log('need to display country report');
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
        
        //check for form validity
        var invalidFields = [];
        angular.forEach($scope.model.selectedDataSet.dataElements, function(dataElement){            
            if( dataElement.dataElementGroup && 
                    $scope.model.dataElementGroupsById[dataElement.dataElementGroup.id] &&
                    !$scope.isHidden( dataElement, $scope.model.dataElementGroupsById[dataElement.dataElementGroup.id] ) ){                
                if( !$scope.dataValues[dataElement.id] || $scope.dataValues[dataElement.id] === ''){
                    invalidFields.push( $scope.desById[dataElement.id] );
                }
            }
        });
        
        if( invalidFields.length > 0 ){
            
            var modalInstance = $modal.open({
                templateUrl: 'components/dataentry/validation-dialog.html',
                controller: 'ValidationDialogController',
                windowClass: 'modal-full-window',
                resolve: {
                    invalidFields: function(){
                        return invalidFields;
                    },
                    dataElementGroupSets: function(){
                        return $scope.model.dataElementGroupSets;
                    }
                }
            });

            modalInstance.result.then(function () {
            });            
        }
        else{
            var modalOptions = {
                closeButtonText: 'no',
                actionButtonText: 'yes',
                headerText: 'mark_complete',
                bodyText: 'are_you_sure_to_mark_complete'
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
        }
    };
    
    $scope.deleteCompletness = function(){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'mark_not_complete',
            bodyText: 'are_you_sure_to_mark_not_complete'
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
    
    $scope.getOptionComboByName = function(option1, option2, cc){        
        return ActionMappingUtils.getOptionComboIdFromOptionNames($scope.model.mappedOptionCombos, [option1, option2], cc);
    };
    
    $scope.joinOnProperty = function( objs, prop){
        var result = [];
        angular.forEach(objs, function(obj){
            result.push( obj[prop] );
        });
        return result.join(', ');
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        var reportName = $scope.selectedOrgUnit.n + '-' + $scope.model.selectedPeriod.name + '.xls';
        saveAs(blob, reportName);
    };
});
