/* global angular, _ */

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
                    mappedOptionCombosById: []};
    
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
                    if( cog.dataSetDomain === 'SURVEY' ){
                        angular.forEach(cog.categoryOptions, function(co){
                            optionGroupByMembers[co.displayName] = cog;
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
                        }                        
                        
                        if( cc.code === 'JointProgrammeDimensions' ){                            
                            for(var i=0; i< cc.categoryOptionCombos.length; i++){
                                //$scope.model.mappedOptionCombos[cc.categoryOptionCombos[i].displayName] = cc.categoryOptionCombos[i];
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
                        
                        angular.forEach(cc.categoryOptionCombos, function(oco){
                            $scope.model.mappedOptionCombos[oco.displayName] = oco;
                            $scope.model.mappedOptionCombosById[oco.id] = oco;
                        });
                        
                        $scope.model.mappedCategoryCombos[cc.id] = cc;
                    });
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
        $scope.model.orgUnitsWithValues = [];
        $scope.dataValues = {};
        if (angular.isObject($scope.selectedOrgUnit)) {
            //get survey data sets
            DataSetFactory.getDataSetsByProperty( $scope.selectedOrgUnit, 'dataSetDomain', 'SURVEY' ).then(function(dataSets){
                $scope.model.dataSets = dataSets;                
                if($scope.model.dataElementGroupSets.length === 0){
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
                                        $scope.model.degs[de.id] = {displayName: degs.displayName, id: degs.id, code: degs.code};
                                        $scope.model.deg[de.id] = {displayName: deg.displayName, id: deg.id, code: deg.code};
                                    });
                                    
                                    deg.dataElements = orderByFilter(deg.dataElements, '-order').reverse(); 
                                }
                                $scope.model.dataElementGroupsById[deg.id] = deg;
                            });
                        });
                        
                        $scope.model.dataElementGroupSets = orderByFilter($scope.model.dataElementGroupSets, '-code').reverse();
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
                $scope.invalidCategoryDimensionConfiguration('error', 'missing_data_elements_indicators');
                return;
            }            
            
            loadOptionCombos();            
            
            $scope.model.selectedCategoryCombos = {};            
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
        $scope.dataSetCompleteness = {};
    };
    
    $scope.isHidden = function( dataElement, dataElementGroup ){
        
        if( dataElement.skipLogicParentId && 
                dataElementGroup && 
                dataElementGroup.dataElements &&
                dataElementGroup.dataElements[dataElement.skipLogicParentId] ){
            
            var index = dataElement.skipLogicParentId - 1;
            
            if( index >= 0 ){
                var skipParent = dataElementGroup.dataElements[index];
                
                if( skipParent && skipParent.id && $scope.desById[skipParent.id] ) {
                    
                    var de = $scope.desById[skipParent.id];
                    
                    if( de ){
                        var value = '';

                        if( de.dimensionAsOptionSet ){
                            value = $scope.dataValues[skipParent.id];
                            if( value ){
                                if( value.displayName === 'Yes' || value.displayName === 'Oui' ){
                                    return false;
                                }                                
                                else{
                                    if( dataElement.skipValue && dataElement.skipValue !== ''){
                                        if( value && value.displayName === dataElement.skipValue ){                                    
                                            return false;
                                        }
                                    }
                                }
                            }                            
                        }
                        else if( de.dimensionAsMultiOptionSet ){
                            value = $scope.dataValues[skipParent.id];
                            if( value && value.length > 1 ){
                                return false;
                            }
                        }
                        else{                            
                            if( $scope.model.defaultCategoryCombo && de.categoryCombo &&
                                $scope.model.defaultOptionCombo && $scope.model.defaultOptionCombo.id &&
                                de.categoryCombo.id === $scope.model.defaultCategoryCombo.id && 
                                $scope.dataValues[skipParent.id] ){ 

                                value = $scope.dataValues[skipParent.id][$scope.model.defaultOptionCombo.id];

                                if( de.valueType === 'NUMBER' ){
                                    if( dataElement.skipValue === 0 || (dataElement.skipValue && dataElement.skipValue !== '')){                                        
                                        dataElement.skipValue = parseInt( dataElement.skipValue );                                        
                                        if( value.value === dataElement.skipValue ){
                                            return false;
                                        }
                                    }
                                    else{
                                        if( value.value > 0 ){
                                            return false;
                                        }
                                    }
                                }
                                else{
                                    if( !value || value.value !== 'undefined' || value.value !== ''){
                                        return false;
                                    }
                                }
                            }
                        }                      
                    }
                }
            }
            
            // need to hide / remove exsiting value
            if( $scope.dataValues[dataElement.id] ){                
                if( dataElement.displayMode === 'TABULAR'){                    
                    angular.forEach($scope.model.categoryOptionGroups, function(cog){
                        if( $scope.dataValues[dataElement.id] && $scope.dataValues[dataElement.id][cog.id]){
                            delete $scope.dataValues[dataElement.id];
                            $scope.saveDataValue(dataElement.id,null,false,cog.id);
                        }
                    });
                }                
                else{
                    if( dataElement.dimensionAsOptionSet ){                    
                        var oldValue = angular.copy($scope.dataValues[dataElement.id]);                    
                        delete $scope.dataValues[dataElement.id];
                        $scope.saveDataValue(dataElement.id, oldValue.id, true);
                    }
                    else if( dataElement.dimensionAsMultiOptionSet ){
                        delete $scope.dataValues[dataElement.id];
                        $scope.saveDataValue(dataElement.id);
                    }
                    else{
                        var props = Object.getOwnPropertyNames($scope.dataValues[dataElement.id]);

                        if( props[0] && $scope.dataValues[dataElement.id][props[0]] ){
                            delete $scope.dataValues[dataElement.id][props[0]];
                            $scope.saveDataValue(dataElement.id, props[0], false);
                        }
                    }
                }                
            }            
            return true;
        }
        return false;
    };    
    
    $scope.loadDataEntryForm = function(){
        
        resetParams();
        if( angular.isObject( $scope.selectedOrgUnit ) && $scope.selectedOrgUnit.id &&
                angular.isObject( $scope.model.selectedDataSet ) && $scope.model.selectedDataSet.id &&
                angular.isObject( $scope.model.selectedPeriod) && $scope.model.selectedPeriod.id &&                
                $scope.model.categoryOptionsReady ){
            
            var dataValueSetUrl = 'dataSet=' + $scope.model.selectedDataSet.id + '&period=' + $scope.model.selectedPeriod.id + '&orgUnit=' + $scope.selectedOrgUnit.id;            
            
            $scope.model.selectedAttributeOptionCombo = ActionMappingUtils.getOptionComboIdFromOptionNames($scope.model.selectedAttributeOptionCombos, $scope.model.selectedOptions, $scope.model.selectedAttributeCategoryCombo);

            console.log('$scope.model.mappedCategoryCombos:  ', $scope.model.mappedCategoryCombos );
            
            //fetch data values...
            DataValueService.getDataValueSet( dataValueSetUrl ).then(function(response){
                if( response && response.dataValues && response.dataValues.length > 0 ){                    
                    response.dataValues = $filter('filter')(response.dataValues, {attributeOptionCombo: $scope.model.selectedAttributeOptionCombo});
                    if( response.dataValues.length > 0 ){
                        angular.forEach(response.dataValues, function(dv){
                            if( dv && dv.value ){
                                dv.value = ActionMappingUtils.formatDataValue( dv, $scope.desById[dv.dataElement], $scope.model.mappedCategoryCombos );
                                
                                if($scope.desById[dv.dataElement].displayMode === 'TABULAR'){
                                    if( !$scope.dataValues[dv.dataElement] ){
                                        $scope.dataValues[dv.dataElement] = {};
                                    }                                    
                                    for(var i=0; i<$scope.model.mappedCategoryCombos[$scope.desById[dv.dataElement].categoryCombo.id].categoryOptionCombos.length;i++){
                                        if( $scope.model.mappedCategoryCombos[$scope.desById[dv.dataElement].categoryCombo.id].categoryOptionCombos[i].id === dv.categoryOptionCombo ){
                                            var cog = $scope.model.mappedCategoryCombos[$scope.desById[dv.dataElement].categoryCombo.id].categoryOptionCombos[i].categoryOptionGroup;
                                            if( cog && cog.id ){
                                                if( !$scope.dataValues[dv.dataElement][cog.id] ){
                                                    $scope.dataValues[dv.dataElement][cog.id] = [];
                                                }
                                                
                                                for( var j=0; j<cog.categoryOptions.length; j++){                                                    
                                                    if( cog.categoryOptions[j].displayName === $scope.model.mappedCategoryCombos[$scope.desById[dv.dataElement].categoryCombo.id].categoryOptionCombos[i].displayName ){
                                                        $scope.dataValues[dv.dataElement][cog.id].push( $scope.model.mappedCategoryCombos[$scope.desById[dv.dataElement].categoryCombo.id].categoryOptionCombos[i] );
                                                        break;
                                                    }
                                                }                                                
                                            }
                                            break;
                                        }
                                    }                                    
                                }
                                else{
                                    if( $scope.desById[dv.dataElement].dimensionAsMultiOptionSet ){
                                        if( !$scope.dataValues[dv.dataElement] ){
                                            $scope.dataValues[dv.dataElement] = [];
                                        }

                                        for(var i=0; i<$scope.model.mappedCategoryCombos[$scope.desById[dv.dataElement].categoryCombo.id].categoryOptionCombos.length;i++){
                                            if( $scope.model.mappedCategoryCombos[$scope.desById[dv.dataElement].categoryCombo.id].categoryOptionCombos[i].id === dv.categoryOptionCombo ){
                                                $scope.dataValues[dv.dataElement].push({id: dv.categoryOptionCombo, displayName: $scope.model.mappedCategoryCombos[$scope.desById[dv.dataElement].categoryCombo.id].categoryOptionCombos[i].displayName});
                                                break;
                                            }
                                        }
                                    }
                                    if( $scope.desById[dv.dataElement].dimensionAsOptionSet ){
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
                                    $scope.model.selectedPeriod.id,
                                    $scope.model.allowMultiOrgUnitEntry).then(function(response){                
                if( response && 
                        response.completeDataSetRegistrations && 
                        response.completeDataSetRegistrations.length &&
                        response.completeDataSetRegistrations.length > 0){
                    
                    angular.forEach(response.completeDataSetRegistrations, function(cdr){
                        $scope.dataSetCompleteness[cdr.attributeOptionCombo] = true;
                    });
                }
            });
            
            angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                de.dataElementGroupSet = $scope.model.degs[de.id];
                de.dataElementGroup = $scope.model.deg[de.id];
            });            
            
            if( $scope.model.dataElementGroupSets.length > 0 ){                
                angular.forEach($scope.model.dataElementGroupSets, function(degs){
                    degs.active = false;
                });
                $scope.model.dataElementGroupSets[0].active = true;
                $scope.setCurrentDataElementGroupSet( $scope.model.dataElementGroupSets[0] );
            }            
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
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset, $scope.model.selectedDataSet.openFuturePeriods);
        }
        else{
            $scope.periodOffset = $scope.periodOffset - 1;
            $scope.model.selectedPeriod = null;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset, $scope.model.selectedDataSet.openFuturePeriods);
        }
    };
    
    $scope.saveDataValue = function( deId, ocId, dimensionAsOptionSet, cogId ){
        
        var dataElement = $scope.desById[deId];
        
        if( !dataElement ){
            return;
        }
        
        //check for form validity
        $scope.outerForm.submitted = true;        
        if( $scope.outerForm.$invalid ){
            return false;
        }
            
        var dataValue = {ou: $scope.selectedOrgUnit.id, pe: $scope.model.selectedPeriod.id, de: deId};
        var status = {saved: false, pending: true, error: false};
        
        if( $scope.model.selectedAttributeCategoryCombo && !$scope.model.selectedAttributeCategoryCombo.isDefault ){
            dataValue.cc = $scope.model.selectedAttributeCategoryCombo.id;
            dataValue.cp = ActionMappingUtils.getOptionIds($scope.model.selectedOptions);
        }
        
        if( ocId ){
            $scope.saveStatus[deId + '-' + ocId ] = status;
        }
        
        if( $scope.desById[deId].displayMode === 'TABULAR'){
            if( cogId ){                
                var dataValueSet = {
                                    dataSet: $scope.model.selectedDataSet.id,
                                    period: $scope.model.selectedPeriod.id,
                                    orgUnit: $scope.selectedOrgUnit.id,
                                    dataValues: []
                                  };

                var oldValues = angular.copy( $scope.dataValuesCopy[deId] );
                var processedCos = [];
                angular.forEach($scope.model.mappedCategoryCombos[dataElement.categoryCombo.id].categoryOptionCombos, function(oco){                

                    var val = {dataElement: deId, categoryOptionCombo: oco.id, value: ''};

                    if( $scope.dataValues[deId] && $scope.dataValues[deId][cogId] && $scope.dataValues[deId][cogId].length ){

                        for( var i=0; i<$scope.dataValues[deId][cogId].length; i++){
                            if( $scope.dataValues[deId][cogId][i] && $scope.dataValues[deId][cogId][i].id === oco.id ){
                                val.value = 1;
                                dataValueSet.dataValues.push( val );
                                processedCos.push( oco.id );
                                break;
                            }
                        }
                    }

                    if( processedCos.indexOf( oco.id) === -1 ){
                        if( oldValues && oldValues[cogId] && oldValues[cogId].length ){                        
                            for( var i=0; i<oldValues[cogId].length; i++){                            
                                if( oldValues[cogId][i] && oldValues[cogId][i].id === oco.id ){                                    
                                    dataValueSet.dataValues.push( val );
                                    processedCos.push( oco.id );                                
                                    break;
                                }
                            }
                        }
                    }
                });

                DataValueService.saveDataValueSet( dataValueSet, angular.copy( $scope.dataValuesCopy ), dataElement, $scope.model.mappedOptionCombosById, $scope.model.selectedDataSet.id, $scope.model.selectedAttributeOptionCombo ).then(function(){                
                    $scope.dataValuesCopy[deId] = angular.copy( $scope.dataValues[deId] );
                });
            }
        }
        else{
            if( $scope.desById[deId].dimensionAsMultiOptionSet ){ 
                var dataValueSet = {
                                    dataSet: $scope.model.selectedDataSet.id,
                                    period: $scope.model.selectedPeriod.id,
                                    orgUnit: $scope.selectedOrgUnit.id,
                                    dataValues: []
                                  };

                angular.forEach($scope.model.mappedCategoryCombos[dataElement.categoryCombo.id].categoryOptionCombos, function(oco){
                    var val = {dataElement: deId, categoryOptionCombo: oco.id, value: ''};
                    if( $scope.dataValues[deId] && $scope.dataValues[deId].length ){
                        for( var i=0; i<$scope.dataValues[deId].length; i++){
                            if( $scope.dataValues[deId][i] && $scope.dataValues[deId][i].id === oco.id ){
                                val.value = 1;
                                break;
                            }
                        }
                    }

                    dataValueSet.dataValues.push( val );
                });            

                DataValueService.saveDataValueSet( dataValueSet, $scope.dataValuesCopy, dataElement, $scope.model.mappedOptionCombosById, $scope.model.selectedDataSet.id, $scope.model.selectedAttributeOptionCombo ).then(function(){                    
                    $scope.dataValuesCopy[deId] = angular.copy( $scope.dataValues[deId] );
                });
            }
            else{
                if( !dimensionAsOptionSet ){
                    dataValue.co = ocId;
                    dataValue.value = '';            
                    if( $scope.dataValues[deId] && $scope.dataValues[deId][ocId] ){
                        dataValue.value = $scope.dataValues[deId][ocId].value;
                    }
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
                            DataValueService.saveDataValue( _dataValue, $scope.dataValuesCopy, dataElement, $scope.model.mappedOptionCombosById, $scope.model.selectedDataSet.id, $scope.model.selectedAttributeOptionCombo ).then(function(){
                                $scope.dataValuesCopy[deId] = angular.copy( $scope.dataValues[deId] );
                            });
                        }                
                    }
                    else{                
                        dataValue.co = $scope.dataValuesCopy[deId].id;
                        dataValue.value = '';
                    }
                }
                
                DataValueService.saveDataValue( dataValue, $scope.dataValuesCopy, dataElement, $scope.model.mappedOptionCombosById, $scope.model.selectedDataSet.id, $scope.model.selectedAttributeOptionCombo ).then(function(){
                    if( ocId ){
                        $scope.saveStatus[deId + '-' + ocId].saved = true;
                        $scope.saveStatus[deId + '-' + ocId].pending = false;
                        $scope.saveStatus[deId + '-' + ocId].error = false;
                    }
                    $scope.dataValuesCopy[deId] = angular.copy( $scope.dataValues[deId] );

                }, function(){
                    if( ocId ){
                        $scope.saveStatus[deId + '-' + ocId].saved = false;
                        $scope.saveStatus[deId + '-' + ocId].pending = false;
                        $scope.saveStatus[deId + '-' + ocId].error = true;
                    }                
                });
            }
        }
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
    
    $scope.getMainQuestionTableStyle = function( de ){
        if( !de.skipLogicParentId || de.skipLogicParentId === ""){
            return "main-question";
        }        
        return "sub-question";
    };

    function processCompleteness( isSave ){
        if( isSave ){
            $scope.dataSetCompleteness[$scope.model.selectedAttributeOptionCombo] = true;
        }
        else{
            delete $scope.dataSetCompleteness[$scope.model.selectedAttributeOptionCombo];
        }
    };
    
    $scope.saveCompleteness = function(){
        
        var tabularElements = $filter('filter')($scope.model.selectedDataSet.dataElements, {displayMode: 'TABULAR'});
        
        //check for form validity        
        var invalidFields = [];
        angular.forEach($scope.model.selectedDataSet.dataElements, function(dataElement){            
            if( dataElement.displayMode !== 'TABULAR' &&
                    dataElement.dataElementGroup && 
                    $scope.model.dataElementGroupsById[dataElement.dataElementGroup.id] &&
                    !$scope.isHidden( dataElement, $scope.model.dataElementGroupsById[dataElement.dataElementGroup.id] ) ){                
                if( !$scope.dataValues[dataElement.id] || $scope.dataValues[dataElement.id] === ''){
                    invalidFields.push( $scope.desById[dataElement.id] );
                }
            }
        });
        
        var tableIsEmpty = true;
        for(var i=0; i<tabularElements.length; i++){            
            var dataElement = tabularElements[i];            
            if( dataElement.dataElementGroup && 
                    $scope.model.dataElementGroupsById[dataElement.dataElementGroup.id] &&
                    !$scope.isHidden( dataElement, $scope.model.dataElementGroupsById[dataElement.dataElementGroup.id] ) ){                
                if( $scope.dataValues[dataElement.id] && $scope.dataValues[dataElement.id] !== ''){
                    tableIsEmpty = false;
                    break;
                }
            }
        }
        
        if( tableIsEmpty ){
            tabularElements = orderByFilter(tabularElements, '-order').reverse();            
            var dataElement = tabularElements[0];
            if( dataElement.dataElementGroup && $scope.model.dataElementGroupsById[dataElement.dataElementGroup.id]  ){
                if( !$scope.isHidden( dataElement, $scope.model.dataElementGroupsById[dataElement.dataElementGroup.id] ) ){
                    invalidFields.push( $scope.desById[tabularElements[0].id] );
                }
            }
        }
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
                
                var dsr = {completeDataSetRegistrations: [{dataSet: $scope.model.selectedDataSet.id, organisationUnit: $scope.selectedOrgUnit.id, period: $scope.model.selectedPeriod.id, attributeOptionCombo: $scope.model.selectedAttributeOptionCombo}]};                

                CompletenessService.save( dsr ).then(function(response){                
                    if( response && response.status === 'SUCCESS' ){
                        var dialogOptions = {
                            headerText: 'success',
                            bodyText: 'marked_complete'
                        };
                        DialogService.showDialog({}, dialogOptions);
                        processCompleteness( true );
                    }

                }, function(response){
                    ActionMappingUtils.errorNotifier( response );
                });
            });
        }
    };
    
    $scope.deleteCompleteness = function(){
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
                $scope.model.selectedAttributeCategoryCombo.isDefault ? null : $scope.model.selectedAttributeCategoryCombo,
                $scope.model.selectedAttributeCategoryCombo.isDefault ? null : ActionMappingUtils.getOptionIds($scope.model.selectedOptions),
                false).then(function(response){
                
                var dialogOptions = {
                    headerText: 'success',
                    bodyText: 'marked_not_complete'
                };
                DialogService.showDialog({}, dialogOptions);
                processCompleteness(false);
                
            }, function(response){
                ActionMappingUtils.errorNotifier( response );
            });
        });        
    };
    
    $scope.setCurrentDataElementGroupSet = function( degs ){
        $scope.setCurrentDataElementGroup( degs.dataElementGroups[0] );
    };
    
    $scope.setCurrentDataElementGroup = function(deg){
        $scope.currentDataElementGroup = deg;
    };
    
    $scope.setCurrentDataElement = function(de){
        $scope.currentDataElement = de;
    };
    
    $scope.getOptionComboId = function(option1, option2, cc){        
        return ActionMappingUtils.getOptionComboIdFromOptionNames($scope.model.mappedOptionCombos, [option1, option2], cc);;
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
    
    $scope.getFormattedText = function( txt ){        
        if( txt ){            
            if( dhis2.validation.isNumber( txt ) ){
                txt = txt.toString();
            }
            return txt.replace(/\r?\n/g,'<br />');
        }
        return txt;
    };
    
    $scope.interacted = function(field) {
        var status = false;
        if(field){            
            status = $scope.outerForm.submitted || field.$dirty;
        }
        return status;
    };
});
