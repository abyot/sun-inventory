/* global angular */

'use strict';

var sunInventory = angular.module('sunInventory');

//Controller for settings page
sunInventory.controller('dataEntryController',
        function($scope,
                $filter,
                $modal,
                $translate,
                orderByFilter,
                DataSetFactory,
                PeriodService,
                MetaDataFactory,
                ActionMappingUtils,
                DataValueService,
                CompletenessService,
                OrgUnitFactory,
                ModalService,
                DialogService,
                ReportService) {
    $scope.periodOffset = 0;
    $scope.saveStatus = {};
    $scope.dataValues = {};
    $scope.selectedOrgUnit = {};
    $scope.searchOuTree = {open: false};
    $scope.showReportDiv = false;
    
    $scope.model = {invalidDimensions: false,
                    selectedAttributeCategoryCombo: null,
                    multiDataSets: [],
                    dataSets: [],
                    categoryOptionsReady: false,
                    selectedOptions: [],
                    dataValues: {},
                    selectedDataSet: null,                    
                    selectedAttributeOptionCombo: null,
                    selectedDataElementGroupSet: null,
                    selectedThematicArea: null,
                    selectedSupportType: null,
                    attributeCategoryUrl: null,
                    dataElementGroupSets: [],
                    mappedOptionSets: {},
                    mappedCategoryCombos: [],
                    mappedOptionCombos: [],
                    mappedOptionCombosById: [],
                    mappedOptionComboIds: [],
                    metaDataCached: false,
                    actionConductedKey: null};
    
    //Get orgunits for the logged in user
    //Get orgunits for the logged in user
    OrgUnitFactory.getCaptureTreeRoot().then(function(response) {
        $scope.orgUnits = response.organisationUnits;
        angular.forEach($scope.orgUnits, function(ou){
            ou.show = true;
            angular.forEach(ou.children, function(o){
                o.hasChildren = o.children && o.children.length > 0 ? true : false;
            });
        });
        $scope.selectedOrgUnit = $scope.orgUnits[0] ? $scope.orgUnits[0] : null;
    });
    
    
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
    
    $scope.showOrgUnitTree = function(){
        var modalInstance = $modal.open({
            templateUrl: 'components/outree/orgunit-tree.html',
            controller: 'OuTreeController',
            resolve: {
                orgUnits: function(){
                    return $scope.orgUnits;
                },
                selectedOrgUnit: function(){
                    return $scope.selectedOrgUnit;
                }
            }
        });

        modalInstance.result.then(function ( selectedOu ) {
            if( selectedOu && selectedOu.id ){
                $scope.selectedOrgUnit = selectedOu;
            }
        }); 
    };
    
    //Download metadata
    downloadMetaData().then(function(){
        $scope.model.periods = [];
        $scope.model.dataSets = [];
        $scope.model.selectedDataSet = null;
        $scope.model.selectedPeriod = null;
        $scope.model.selectedAttributeCategoryCombo = null;        
        $scope.model.selectedAttributeOptionCombo = null;
        $scope.dataValues = {};
        $scope.model.basicAuditInfo = {};        
        $scope.model.categoryOptionsReady = false;        
        $scope.dataElementLocation = {};
        
        MetaDataFactory.getAll( 'optionSets' ).then(function( optionSets ){
            
            angular.forEach(optionSets, function(ops){
                if( ops.optionType === 'SUBACTION' && ops.code !== "" ){
                    $scope.model.mappedOptionSets[ops.code] = ops;
                }
            });            
        
            MetaDataFactory.getAll('dataElementGroupSets').then(function(dataElementGroupSets){                        

                $scope.model.dataElementGroupSets = [];
                $scope.model.supportTypes = [];
                $scope.model.thematicAreas = [];

                angular.forEach(dataElementGroupSets, function(degs){
                    var idx = degs.displayName.indexOf(' - Category');
                    if( idx !== -1 ){                    
                        angular.forEach(degs.dataElementGroups, function(deg){
                            deg = dhis2.metadata.processMetaDataAttribute( deg );                                
                            if( deg.groupType && ( deg.groupType === 'thematicArea' || deg.groupType === 'enablingEnvironment' || deg.groupType === 'procurementLogisticsSupply') ){
                                if( $scope.model.dataElementGroupSets.indexOf( degs ) === -1 ){
                                    degs.displayName = degs.displayName.split(' - ')[0];
                                    $scope.model.dataElementGroupSets.push( degs );
                                }

                                angular.forEach(deg.dataElements, function(de){
                                    if( !$scope.dataElementLocation[de.id] ){
                                        $scope.dataElementLocation[de.id] = {};
                                    }

                                    if( deg.groupType === "thematicArea" ){
                                        var ta = {id: deg.id, displayName: deg.displayName, category: degs.displayName};
                                        if( ActionMappingUtils.indexOf( $scope.model.thematicAreas, ta, 'id') === -1){
                                            $scope.model.thematicAreas.push( ta );
                                        }
                                        angular.extend($scope.dataElementLocation[de.id], {thematicArea: deg.displayName, category: degs.displayName});
                                    }
                                    else{
                                        var names = deg.displayName && deg.displayName.split(' - ') ? deg.displayName.split(' - ') : [];                                     
                                        if( names.length === 2 ){                                    
                                            var st = {id: deg.groupType, displayName: names[1], thematicArea: [names[0]], category: [degs.displayName]};
                                            var index = ActionMappingUtils.indexOf( $scope.model.supportTypes, st, 'id');
                                            if( index === -1 ){
                                                $scope.model.supportTypes.push( st );
                                            }
                                            else{
                                                if( $scope.model.supportTypes[index].thematicArea.indexOf( names[0] ) === -1 ){
                                                    $scope.model.supportTypes[index].thematicArea.push( names[0] );
                                                }
                                                if( $scope.model.supportTypes[index].category.indexOf( degs.displayName ) === -1 ){
                                                    $scope.model.supportTypes[index].category.push( degs.displayName );
                                                }
                                            }
                                            angular.extend($scope.dataElementLocation[de.id], {supportType: names[1], thematicArea: names[0], category: degs.displayName});
                                        }
                                    }
                                });
                            }
                        });
                    }
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

                            if( cog.actionConducted ){
                                $scope.model.actionConductedKey = cog;
                            }
                        }                     
                    });

                    var orderedOptionGroup = {};                            
                    MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                        angular.forEach(ccs, function(cc){
                            if( cc.isDefault ){
                                $scope.model.defaultCategoryCombo = cc;
                                $scope.model.defaultOptionCombo = cc.categoryOptionCombos[0];
                            }
                            //$scope.pushedOptions[cc.id] = [];

                            if( cc.categories && cc.categories.length === 1 && cc.categories[0].categoryOptions ){

                                var sortedOptions = [];
                                angular.forEach(cc.categories[0].categoryOptions, function(co){
                                    sortedOptions.push( co.displayName );
                                });

                                cc.categoryOptionCombos = _.sortBy( cc.categoryOptionCombos, function(coc){
                                    return sortedOptions.indexOf( coc.displayName );
                                });

                                if( cc.code && cc.code === 'ActionInventoryDimensions' ){
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

                                    /*angular.forEach($scope.model.categoryOptionGroups, function(cog){
                                        cog.order = orderedOptionGroup[cog.id];
                                    });*/
                                }
                            }

                            else{
                                angular.forEach(cc.categoryOptionCombos, function(oco){
                                    $scope.model.mappedOptionComboIds[oco.displayName] = oco.id;
                                    $scope.model.mappedOptionCombosById[oco.id] = oco;
                                });
                            }

                            $scope.model.mappedCategoryCombos[cc.id] = cc;
                        });
                        
                        
                        DataSetFactory.getDataSetsByProperty( 'dataSetDomain', 'INVENTORY' ).then(function(dataSets){            
                            $scope.model.dataSets = dataSets;                
                            angular.forEach($scope.model.dataSets, function(ds){
                                if( ds.dataElements && ds.dataElements.length === 1 ){
                                    if( ds.dataElements[0] ){                            
                                        if( $scope.dataElementLocation[ds.dataElements[0].id] ){
                                            angular.extend(ds, $scope.dataElementLocation[ds.dataElements[0].id]);                                
                                        }
                                    }
                                }

                                if( ds.displayName.split(' - ').length === 2 ){
                                    ds.displayName = ds.displayName.split(' - ')[0];
                                }
                            });

                            $scope.model.metaDataCached = true;
                            
                            
                            
                            if( $scope.model.dataSets.length > 0 ){
                                
                                $scope.model.reportDataSet = $scope.model.dataSets[0];
                            
                                $scope.model.reportAttributeCombo = $scope.model.selectedAttributeCategoryCombo = $scope.model.mappedCategoryCombos[$scope.model.reportDataSet.categoryCombo.id];

                                for(var i=0; i<$scope.model.reportAttributeCombo.categories.length; i++ ){
                                    if( $scope.model.reportAttributeCombo.categories[i].displayName === 'Agency' ){
                                        $scope.model.agencyCategory = $scope.model.reportAttributeCombo.categories[i];                                        
                                    }                                    
                                    if( $scope.model.reportAttributeCombo.categories[i].displayName === 'Action Instance' ){
                                        $scope.model.instanceCategory = $scope.model.reportAttributeCombo.categories[i];                                        
                                    }
                                }

                                $scope.model.reportPeriods = $scope.model.periods = PeriodService.getPeriods($scope.model.reportDataSet.periodType, $scope.periodOffset, $scope.model.reportDataSet.openFuturePeriods);

                                $scope.model.staticHeaders = [];
                                $scope.model.staticHeaders.push($translate.instant('category'));
                                $scope.model.staticHeaders.push($translate.instant('thematic_area'));
                                $scope.model.staticHeaders.push($translate.instant('support_type'));
                                $scope.model.staticHeaders.push($translate.instant('action'));
                                
                            }                            

                            console.log( 'Finished downloading meta-data' );
                        });
                    });                
                });
            });
        });
    });
    
    $scope.$watchGroup(['model.selectedPeriod', 'selectedOrgUnit'], function(){
        $scope.loadDataEntryForm();
    });
    
    //watch for selection of data set
    $scope.$watch('model.selectedDataSet', function() {        
        $scope.model.periods = [];
        $scope.dataValues = {};
        if( angular.isObject($scope.model.selectedDataSet) && $scope.model.selectedDataSet.id ){
            
            if( $scope.model.selectedDataSet.category ){
                if( !$scope.model.selectedDataElementGroupSet || angular.isUndefined( $scope.model.selectedDataElementGroupSet ) ){
                    var degs = $filter('filter')($scope.model.dataElementGroupSets, {displayName: $scope.model.selectedDataSet.category}, true);
                    if( degs && degs.length ){
                        $scope.model.selectedDataElementGroupSet = degs[0];
                    }
                }
            }
            
            if( $scope.model.selectedDataSet.thematicArea ){
                if( !$scope.model.selectedThematicArea || angular.isUndefined( $scope.model.selectedThematicArea ) ){
                    var tas = $filter('filter')($scope.model.thematicAreas, {displayName: $scope.model.selectedDataSet.thematicArea}, true);
                    if( tas && tas.length ){
                        $scope.model.selectedThematicArea = tas[0];
                    }
                }
            }
            
            if( $scope.model.selectedDataSet.supportType ){
                if( !$scope.model.selectedSupportType || angular.isUndefined( $scope.model.selectedSupportType ) ){
                    var sts = $filter('filter')($scope.model.supportTypes, {displayName: $scope.model.selectedDataSet.supportType}, true);
                    if( sts && sts.length ){
                        $scope.model.selectedSupportType = sts[0];
                    }
                }
            }
            
            $scope.loadDataSetDetails();
        }
    });
    
    //make sure CAN is classification is respected
    $scope.$watchGroup(['model.selectedDataElementGroupSet', 'model.selectedThematicArea', 'model.selectedSupportType'], function(){
        
        if( $scope.model.selectedDataElementGroupSet && 
                $scope.model.selectedDataElementGroupSet.displayName ){
            
            if( $scope.model.selectedThematicArea && 
                    $scope.model.selectedThematicArea.category ){
                if( $scope.model.selectedDataElementGroupSet.displayName !== $scope.model.selectedThematicArea.category ){
                    $scope.model.selectedThematicArea = null;
                }
            }
            
            if( $scope.model.selectedSupportType ){
                if( $scope.model.selectedSupportType.category && 
                        $scope.model.selectedSupportType.category.length && 
                        $scope.model.selectedSupportType.category.indexOf( $scope.model.selectedDataElementGroupSet.displayName ) === -1 ){
                    $scope.model.selectedSupportType = null;
                }                
            }
            
            if( $scope.model.selectedDataSet && 
                    $scope.model.selectedDataSet.category ){
                if( $scope.model.selectedDataElementGroupSet.displayName !== $scope.model.selectedDataSet.category ){
                    $scope.model.selectedDataSet = null;
                }
            }
        }
        
        if( $scope.model.selectedThematicArea && 
                $scope.model.selectedThematicArea.displayName ){
            
            if( $scope.model.selectedSupportType ){
                if( $scope.model.selectedSupportType.category && 
                        $scope.model.selectedSupportType.thematicArea.length && 
                        $scope.model.selectedSupportType.thematicArea.indexOf( $scope.model.selectedThematicArea.displayName ) === -1 ){
                    $scope.model.selectedSupportType = null;
                }
            }
            
            if( $scope.model.selectedDataSet && 
                    $scope.model.selectedDataSet.thematicArea ){
                if( $scope.model.selectedThematicArea.displayName !== $scope.model.selectedDataSet.thematicArea ){
                    $scope.model.selectedDataSet = null;
                }
            }
        }
        
        if( $scope.model.selectedSupportType && 
                $scope.model.selectedSupportType.displayName ){            
            if( $scope.model.selectedDataSet && 
                    $scope.model.selectedDataSet.supportType ){
                if( $scope.model.selectedSupportType.displayName !== $scope.model.selectedDataSet.supportType ){
                    $scope.model.selectedDataSet = null;
                }
            }
        }        
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
    
    $scope.getInputNotifcationClass = function( field ){
        return field.$dirty ? 'input-pending' : '';
    };
    
    $scope.loadDataSetDetails = function(){
        if( $scope.model.selectedDataSet && $scope.model.selectedDataSet.id && $scope.model.selectedDataSet.periodType ){            
            
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedDataSet.periodType, $scope.periodOffset, $scope.model.selectedDataSet.openFuturePeriods);
        
            if(!$scope.model.selectedDataSet.dataElements || $scope.model.selectedDataSet.dataElements.length !== 1){
                ActionMappingUtils.notificationDialog('error', 'missing_data_elements');
                return;
            }            
                        
            if( $scope.model.selectedDataSet.categoryCombo && $scope.model.selectedDataSet.categoryCombo.id ){
                //$scope.model.selectedAttributeCategoryCombo = angular.copy( $scope.model.mappedCategoryCombos[$scope.model.selectedDataSet.categoryCombo.id] );
                $scope.model.selectedAttributeCategoryCombo = $scope.model.mappedCategoryCombos[$scope.model.selectedDataSet.categoryCombo.id];
                if( $scope.model.selectedAttributeCategoryCombo.categories && 
                        $scope.model.selectedAttributeCategoryCombo.categories.length && 
                        $scope.model.selectedAttributeCategoryCombo.categories.length > 0 ){                
                    for( var i=0; i<$scope.model.selectedAttributeCategoryCombo.categories.length; i++){
                        if( $scope.model.selectedAttributeCategoryCombo.categories[i].displayName === 'Action Instance' ){
                            if( $scope.model.selectedAttributeCategoryCombo.categories[i].categoryOptions &&
                                    $scope.model.selectedAttributeCategoryCombo.categories[i].categoryOptions.length && 
                                    $scope.model.selectedAttributeCategoryCombo.categories[i].categoryOptions.length > 0){
                                
                                $scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption = $scope.model.selectedAttributeCategoryCombo.categories[i].categoryOptions[0];
                            }                            
                            break;
                        }
                    }
                }
            }
            
            $scope.model.selectedDataElement = $scope.model.selectedDataSet.dataElements[0];
            $scope.model.dataElements = [];
            $scope.dataValues = {};
            $scope.desById = {};
            angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                $scope.desById[de.id] = de;
                if( de.order ){
                    de.order = parseInt(de.order);
                }
            });
            
            if( $scope.model.selectedPeriod !== null && ActionMappingUtils.indexOf( $scope.model.periods, $scope.model.selectedPeriod, 'id' ) !== -1 ) {                
                $scope.loadDataEntryForm();
            }
            
            if( !$scope.model.actionConductedKey 
                    || !$scope.model.mappedCategoryCombos[$scope.model.selectedDataElement.categoryCombo.id] 
                    || !$scope.model.mappedCategoryCombos[$scope.model.selectedDataElement.categoryCombo.id].categoryOptionCombos 
                    || $scope.model.mappedCategoryCombos[$scope.model.selectedDataElement.categoryCombo.id].categoryOptionCombos.length === 0){
                ActionMappingUtils.notificationDialog('error', 'missing_action_conduted_key');
                return;
            }
            
            var keys = $filter('filter')($scope.model.mappedCategoryCombos[$scope.model.selectedDataElement.categoryCombo.id].categoryOptionCombos, {categoryOptionGroup: {id: $scope.model.actionConductedKey.id}});
            if( !keys || keys.length !== 1 ){
                ActionMappingUtils.notificationDialog('error', 'missing_action_conduted_dimension_key');
                return;
            }
            
            $scope.model.actionConductedDimensionKey = keys[0];
            
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
                            
                            if( dv.categoryOptionCombo === $scope.model.actionConductedDimensionKey.id ){
                                if( dv.comment && dv.comment !== "" ){
                                    $scope.dataValues[dv.dataElement].comment = dv.comment;
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
                                    false).then(function(response){                
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
        if( $scope.model.selectedDataSet && $scope.model.selectedDataSet.periodType ){
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
        }        
    };
    
    $scope.saveData = function(){
        
        //check for form validity
        $scope.outerForm.submitted = true;        
        if( $scope.outerForm.$invalid ){
            ActionMappingUtils.notificationDialog('error', 'check_required_questions');
            return false;
        }
        
        //form is valid
        var dataValueSet = {
                            dataSet: $scope.model.selectedDataSet.id,
                            period: $scope.model.selectedPeriod.id,
                            orgUnit: $scope.selectedOrgUnit.id,
                            dataValues: []
                          };
        var dataElement = $scope.model.selectedDataElement;
        var oldValues = angular.copy( $scope.dataValuesCopy[dataElement.id] );
        var processedCos = [];
        angular.forEach($scope.model.mappedCategoryCombos[dataElement.categoryCombo.id].categoryOptionCombos, function(oco){

            var cog = oco.categoryOptionGroup;
            var val = {dataElement: dataElement.id, categoryOptionCombo: oco.id, attributeOptionCombo: $scope.model.selectedAttributeOptionCombo, value: ''};
            
            if( oco.id === $scope.model.actionConductedDimensionKey.id ){
                val.value = 1;
                val.comment = $scope.dataValues[dataElement.id].comment ? $scope.dataValues[dataElement.id].comment : "";
                dataValueSet.dataValues.push( val );
                processedCos.push( oco.id );
            }            
            else{
                if( cog.dimensionEntryMode === 'MULTIPLE' ){                
                    if( $scope.dataValues[dataElement.id] && $scope.dataValues[dataElement.id][cog.id] && $scope.dataValues[dataElement.id][cog.id].length ){
                        for( var i=0; i<$scope.dataValues[dataElement.id][cog.id].length; i++){
                            if( $scope.dataValues[dataElement.id][cog.id][i] && $scope.dataValues[dataElement.id][cog.id][i].id === oco.id ){
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
                }
                else{
                    if( $scope.dataValues[dataElement.id] && $scope.dataValues[dataElement.id][cog.id] ){
                        if( $scope.dataValues[dataElement.id][cog.id].id === oco.id ){                    
                            val.value = 1;                            
                            dataValueSet.dataValues.push( val );
                            processedCos.push( oco.id );                            
                        }                        
                    }
                    
                    if( oldValues && oldValues[cog.id] && oldValues[cog.id].id !== oco.id && processedCos.indexOf(oldValues[cog.id].id) === -1){                        
                        val.categoryOptionCombo = oldValues[cog.id].id;
                        dataValueSet.dataValues.push( val );
                        processedCos.push(oldValues[cog.id].id );
                    }                    
                }
            }
        });
        
        DataValueService.saveDataValueSet( dataValueSet, $scope.model.selectedAttributeCategoryCombo.id, ActionMappingUtils.getOptionIds($scope.model.selectedOptions) ).then(function(){
            $scope.dataValuesCopy[dataElement.id] = angular.copy( $scope.dataValues[dataElement.id] );
            ActionMappingUtils.notificationDialog('success', 'data_saved');
            $scope.outerForm.$setPristine();
        });
    };
    
    $scope.deleteData = function(){
        
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'delete',
            bodyText: 'are_you_sure_to_delete'
        };

        ModalService.showModal({}, modalOptions).then(function(result){

            var dataValueSet = {
                                dataSet: $scope.model.selectedDataSet.id,
                                period: $scope.model.selectedPeriod.id,
                                orgUnit: $scope.selectedOrgUnit.id,
                                dataValues: []
                              };

            var dataElement = $scope.model.selectedDataElement;
            if( $scope.dataValuesCopy[dataElement.id] ){
                angular.forEach($scope.model.categoryOptionGroups, function(deg){            
                    if( $scope.dataValuesCopy[dataElement.id][deg.id] ){
                        if( deg.dimensionEntryMode === 'MULTIPLE'){
                            angular.forEach($scope.dataValuesCopy[dataElement.id][deg.id], function(dv){                        
                                dataValueSet.dataValues.push( {dataElement: dataElement.id, categoryOptionCombo: dv.id, attributeOptionCombo: $scope.model.selectedAttributeOptionCombo, value: ''} ); 
                            });
                        }
                        else{
                            dataValueSet.dataValues.push( {dataElement: dataElement.id, categoryOptionCombo: $scope.dataValuesCopy[dataElement.id][deg.id].id, attributeOptionCombo: $scope.model.selectedAttributeOptionCombo, value: ''} ); 
                        }
                    }
                });

                DataValueService.saveDataValueSet( dataValueSet, $scope.model.selectedAttributeCategoryCombo.id, ActionMappingUtils.getOptionIds($scope.model.selectedOptions) ).then(function(){
                    $scope.dataValues[dataElement.id] = {};
                    $scope.dataValuesCopy[dataElement.id] = angular.copy( $scope.dataValues[dataElement.id] );
                });
            }            
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
        
        //check for form validity
        var invalidFields = [];
        angular.forEach($scope.model.selectedDataSet.dataElements, function(dataElement){            
            if( dataElement.dataElementGroup && $scope.model.dataElementGroupsById[dataElement.dataElementGroup.id] ){                
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
        return ActionMappingUtils.joinOnProperty(objs, prop);
    };
    
    $scope.paramsReady = function(){        
        if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id &&
                $scope.model.selectedDataSet && $scope.model.selectedDataSet.id &&
                $scope.model.selectedPeriod && $scope.model.selectedPeriod.id && 
                $scope.model.categoryOptionsReady){
            return true;
        }
        return false;
    };
    
    $scope.reportParamsReady = function(){        
        if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id &&
                $scope.model.selectedPeriod && $scope.model.selectedPeriod.id && 
                $scope.model.agencyCategory && $scope.model.agencyCategory.selectedOption){
            return true;
        }
        return false;
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        var reportName = $scope.selectedOrgUnit.n + '-' + $scope.model.selectedPeriod.name + '.xls';
        saveAs(blob, reportName);
    };
    
    var checkForEmpty = function( obj ){
        if( !obj || angular.equals({}, obj) || angular.equals([], obj)){
            return true;
        }        
        return false;
    };
    
    $scope.isEmpty = function( oldValue ){
        if( oldValue ){
            return $scope.dataValuesCopy[$scope.model.selectedDataElement.id] ? false : true;
        }
        
        if( angular.equals({}, $scope.dataValues) ){
            return true;
        }      
        
        var empty = true;
        for( var i=0; i< $scope.model.categoryOptionGroups.length; i++ ){            
            if( !checkForEmpty( $scope.dataValues[$scope.model.selectedDataElement.id][$scope.model.categoryOptionGroups[i].id] ) ){                
                empty = false;
            }
        }        
        return empty;
    }; 
    
    $scope.interacted = function(field) {
        var status = false;
        if(field){            
            status = $scope.outerForm.submitted || field.$dirty;
        }
        return status;
    };
    
    $scope.showReport = function(){        
        $scope.showReportDiv = true;
        
        console.log('instance category:  ', $scope.model.instanceCategory);
        
        DataSetFactory.getDataSetsByProperty( 'dataSetDomain', 'REPORT' ).then(function(dataSets){
            if( dataSets && dataSets[0] && dataSets[0].dataSetDomain === 'REPORT' ){
                var reportUrl = 'orgUnit=' + $scope.selectedOrgUnit.id;
                reportUrl += '&period=' + $scope.model.selectedPeriod.id;
                reportUrl += '&dataSet=' + dataSets[0].id;
                
                var reportParams = {orgUnit: $scope.selectedOrgUnit.id,
                        period: $scope.model.selectedPeriod, 
                        url: reportUrl};
                var reportData = {};
                reportData.mappedOptionCombosById = $scope.model.mappedOptionCombosById;
                if( $scope.model.agencyCategory && $scope.model.agencyCategory.selectedOption && $scope.model.agencyCategory.selectedOption.displayName ){
                    reportData.agency = $scope.model.agencyCategory.selectedOption;
                }
                
                ReportService.getReportData( reportParams, reportData ).then(function(response){
                });                
            }
        });
    };
});
