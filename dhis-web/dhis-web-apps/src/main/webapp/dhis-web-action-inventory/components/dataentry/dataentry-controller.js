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
                ReportService,
                SessionStorageService,
                AuthorityService) {
    $scope.periodOffset = 0;
    $scope.saveStatus = {};
    $scope.dataValues = {};
    $scope.selectedOrgUnit = {};
    $scope.searchOuTree = {open: false};
    $scope.showReportDiv = false;
    $scope.icons = ActionMappingUtils.getIcons();    
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
                    filterEmptyRows: false,
                    actionConductedKey: null};
    
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
        $scope.userAuthority = AuthorityService.getUserAuthorities(SessionStorageService.get('USER_ROLES'));
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
                    //if( degs.displayName.indexOf(' - Category') !== -1 ){
                        var ordr = 0;                        
                        angular.forEach(degs.dataElementGroups, function(deg){                            
                            deg = dhis2.metadata.processMetaDataAttribute( deg );
                            var idx = $scope.model.dataElementGroupSets.indexOf( degs );                            
                            if( deg.categoryOrder ){
                                if( idx !== -1 ){
                                    $scope.model.dataElementGroupSets[idx].order = deg.categoryOrder;
                                }
                                else{
                                    degs.order = deg.categoryOrder;
                                }
                            }
                            
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
                                        var ta = {id: deg.id, displayName: deg.displayName, category: degs.displayName, order: ordr, categoryOrder: degs.order};
                                        if( ActionMappingUtils.indexOf( $scope.model.thematicAreas, ta, 'id') === -1){
                                            $scope.model.thematicAreas.push( ta );
                                            ordr++;
                                        }
                                        angular.extend($scope.dataElementLocation[de.id], {thematicArea: deg.displayName, categoryOrder: degs.order, thematicAreaOrder: ordr, category: degs.displayName});
                                    }
                                    else{
                                        var names = deg.displayName && deg.displayName.split(' - ') ? deg.displayName.split(' - ') : [];                                     
                                        if( names.length === 2 ){
                                            var stOrder = deg.groupType === 'procurementLogisticsSupply' ? 1 : 2;
                                            var st = {id: deg.groupType, displayName: names[1], thematicArea: [names[0]], category: [degs.displayName], order: stOrder};
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
                                            angular.extend($scope.dataElementLocation[de.id], {supportType: names[1], thematicArea: names[0], thematicAreaOrder: ordr, categoryOrder: degs.order, category: degs.displayName, supportTypeOrder: st.order});
                                        }
                                    }
                                });
                            }
                        });
                    //}
                });
                
                var optionGroupByMembers = [];
                MetaDataFactory.getAll('categoryOptionGroups').then(function(categoryOptionGroups){
                    $scope.model.categoryOptionGroups = [];
                    angular.forEach(categoryOptionGroups, function(cog){                    
                        if( cog.dataSetDomain === 'INVENTORY' ){                        
                            angular.forEach(cog.categoryOptions, function(co){
                                optionGroupByMembers[co.displayName] = cog;
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

                                if( cc.code ){
                                    
                                    cc.code = cc.code.toLowerCase();
                                    
                                    if( cc.code === 'actioninventorydimensions' ){
                                        for(var i=0; i< cc.categoryOptionCombos.length; i++){
                                            cc.categoryOptionCombos[i].order = i;
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
                                            angular.forEach(cog.categoryOptions, function(o){                                            
                                                if( $scope.model.mappedOptionCombos[o.displayName] && $scope.model.mappedOptionCombos[o.displayName].order ){
                                                    o.order = $scope.model.mappedOptionCombos[o.displayName].order;
                                                } 
                                            });
                                        });
                                    }                                    
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

                                angular.forEach($scope.model.reportAttributeCombo.categories, function(cat){
                                    if( cat.code ){
                                        cat.code = cat.code.toLowerCase();
                                        if( cat.code === 'agency' ){
                                            $scope.model.agencyCategory = cat;
                                        }
                                        else if( cat.code === 'actioninstance' ){
                                            $scope.model.instanceCategory = cat;
                                        }
                                    }
                                });
                                
                                $scope.instanceCategoryOptions = {};
                                angular.forEach($scope.model.instanceCategory.categoryOptions, function(co){
                                    $scope.instanceCategoryOptions[co.displayName] = co;
                                });

                                $scope.model.reportPeriods = $scope.model.periods = PeriodService.getPeriods($scope.model.reportDataSet.periodType, $scope.periodOffset, $scope.model.reportDataSet.openFuturePeriods);
                                $scope.model.selectedPeriod = $scope.model.periods[0];

                                $scope.model.staticHeaders = [];
                                $scope.model.staticHeaders.push($translate.instant('section'));
                                $scope.model.staticHeaders.push($translate.instant('thematic_area'));
                                $scope.model.staticHeaders.push($translate.instant('support_type'));
                                $scope.model.staticHeaders.push($translate.instant('action'));
                                
                                $scope.model.reversedStaticHeaders = angular.copy( $scope.model.staticHeaders ).reverse();
                                
                            }
                            
                            $scope.model.reportTypes = [];
                            $scope.model.reportTypes.push({id: 'SUMMARY', displayName: $translate.instant('summary_report')});
                            $scope.model.reportTypes.push({id: 'NUM_AGENCIES', displayName: $translate.instant('number_of_agencies')});
                            $scope.model.reportTypes.push({id: 'LOGO_MAP', displayName: $translate.instant('logo_map_agencies')});                            
                            $scope.model.reportTypes.push({id: 'CNA', displayName: $translate.instant('cnas')});
                            $scope.model.reportTypes.push({id: 'ALIGNED_INVESTMENT', displayName: $translate.instant('align_invest')});
                            $scope.model.reportTypes.push({id: 'AGENCY_COMPLETENESS', displayName: $translate.instant('agency_completness')});                            
                            $scope.model.selectedReport = $scope.model.reportTypes[0];

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
    
    $scope.$watch('model.selectedReport', function(){
        $scope.showReportDiv = false;
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
    
    //make sure CAN classification is respected
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
            $scope.model.selectedPeriod = $scope.model.periods[0];
        
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
                        if( $scope.model.selectedAttributeCategoryCombo.categories[i].code ) {
                            $scope.model.selectedAttributeCategoryCombo.categories[i].code = $scope.model.selectedAttributeCategoryCombo.categories[i].code.toLowerCase()
                            if( $scope.model.selectedAttributeCategoryCombo.categories[i].code === 'actioninstance' ){
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
        $scope.dataSetCompleteness = {};
        $scope.showReportDiv = false;
        $scope.reportData = {};
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
                                    $scope.model.selectedPeriod.id,
                                    false).then(function(response){                
                if( response && 
                        response.completeDataSetRegistrations && 
                        response.completeDataSetRegistrations.length &&
                        response.completeDataSetRegistrations.length > 0){
                    
                    $scope.dataSetCompleteness[$scope.model.selectedDataSet.id] = {};
                    angular.forEach(response.completeDataSetRegistrations, function(cdr){
                        $scope.dataSetCompleteness[$scope.model.selectedDataSet.id][cdr.attributeOptionCombo] = true;
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
        
        angular.forEach($scope.model.categoryOptionGroups, function(cog){
            
            if( cog.actionConducted ){
                var val = {
                            dataElement: dataElement.id, 
                            categoryOptionCombo: $scope.model.actionConductedDimensionKey.id, 
                            attributeOptionCombo: $scope.model.selectedAttributeOptionCombo, 
                            value: ''
                        };
                val.value = 1;
                val.comment = $scope.dataValues[dataElement.id].comment ? $scope.dataValues[dataElement.id].comment : "";
                dataValueSet.dataValues.push( val );
            }
            else {
                
                switch( cog.dimensionEntryMode )
                {
                    case 'SINGLE':                        
                        var newVal = $scope.dataValues[dataElement.id][cog.id];
                        var oldVal = oldValues && oldValues[cog.id] ? oldValues[cog.id] : [];

                        if( newVal && newVal.id && $scope.model.mappedOptionCombosById[newVal.id] ){
                            var val = {
                                    dataElement: dataElement.id, 
                                    categoryOptionCombo: newVal.id, 
                                    attributeOptionCombo: $scope.model.selectedAttributeOptionCombo, 
                                    value: 1
                                };
                            dataValueSet.dataValues.push( val );
                            processedCos.push( newVal.id );
                        }

                        if( oldVal && oldVal.id && $scope.model.mappedOptionCombosById[oldVal.id] && processedCos.indexOf(oldVal.id) === -1){
                            var val = {
                                    dataElement: dataElement.id, 
                                    categoryOptionCombo: oldVal.id, 
                                    attributeOptionCombo: $scope.model.selectedAttributeOptionCombo, 
                                    value: ""
                                };                            
                            dataValueSet.dataValues.push( val );
                        }
                        break;
                    case 'MULTIPLE':
                        var newVals = $scope.dataValues[dataElement.id][cog.id];                        
                        var oldVals = oldValues && oldValues[cog.id] ? oldValues[cog.id] : [];

                        angular.forEach(newVals, function(newVal){                        
                            if( newVal.id && $scope.model.mappedOptionCombosById[newVal.id] ){
                                var val = {
                                        dataElement: dataElement.id, 
                                        categoryOptionCombo: newVal.id, 
                                        attributeOptionCombo: $scope.model.selectedAttributeOptionCombo, 
                                        value: 1
                                    };
                                dataValueSet.dataValues.push( val );
                                processedCos.push( newVal.id );
                            }
                        });

                        angular.forEach(oldVals, function(oldVal){                        
                            if( oldVal.id && $scope.model.mappedOptionCombosById[oldVal.id] && processedCos.indexOf(oldVal.id) === -1){
                                var val = {
                                        dataElement: dataElement.id, 
                                        categoryOptionCombo: oldVal.id, 
                                        attributeOptionCombo: $scope.model.selectedAttributeOptionCombo, 
                                        value: ""
                                    };
                                dataValueSet.dataValues.push( val );
                                processedCos.push( oldVal.id );
                            }
                        });
                        break;                    
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
        
    function processCompleteness( isSave, dataSet, attOc ){
        if( isSave ){            
            if( !$scope.dataSetCompleteness ){
                $scope.dataSetCompleteness = {};
            }
            if( !$scope.dataSetCompleteness[dataSet.id] ){
                $scope.dataSetCompleteness[dataSet.id] = {};
            }
            $scope.dataSetCompleteness[dataSet.id][attOc] = true;
        }
        else{            
            if( $scope.dataSetCompleteness[dataSet.id] && $scope.dataSetCompleteness[dataSet.id][attOc] ){
                delete $scope.dataSetCompleteness[dataSet.id][attOc];
            }
        }
    };
    
    $scope.getAttributeOptionCombo = function( instance ){
        return ActionMappingUtils.getOptionComboIdFromOptionNames($scope.model.mappedOptionComboIds, [instance,$scope.model.agencyCategory.selectedOption], $scope.model.reportAttributeCombo);        
    };
    
    $scope.saveDataSetCompleteness = function(dataSet, attOc){
        
        var modalOptions = {
                closeButtonText: 'no',
                actionButtonText: 'yes',
                headerText: 'mark_complete',
                bodyText: 'are_you_sure_to_save_completeness'
            };

        ModalService.showModal({}, modalOptions).then(function(result){
            
            var dsr = {completeDataSetRegistrations: [{dataSet: dataSet.id, organisationUnit: $scope.selectedOrgUnit.id, period: $scope.model.selectedPeriod.id, attributeOptionCombo: attOc}]};
            CompletenessService.save(dsr).then(function(response){                
                if( response && response.status === 'SUCCESS' ){
                    var dialogOptions = {
                        headerText: 'success',
                        bodyText: 'marked_complete'
                    };
                    DialogService.showDialog({}, dialogOptions);
                    processCompleteness(true, dataSet, attOc);
                }

            }, function(response){
                ActionMappingUtils.errorNotifier( response );
            });
        });
    };
    
    $scope.deleteDataSetCompleteness = function(dataSet, instance){
       
        if( $scope.userAuthority.canDeleteDataSetCompleteness ) {
            var attOc = ActionMappingUtils.getOptionComboIdFromOptionNames($scope.model.mappedOptionComboIds, [instance,$scope.model.agencyCategory.selectedOption], $scope.model.reportAttributeCombo);
        
            var modalOptions = {
                closeButtonText: 'no',
                actionButtonText: 'yes',
                headerText: 'mark_not_complete',
                bodyText: 'are_you_sure_to_delete_completeness'
            };

            ModalService.showModal({}, modalOptions).then(function(result){

                CompletenessService.delete(dataSet.id, 
                    $scope.model.selectedPeriod.id, 
                    $scope.selectedOrgUnit.id,
                    $scope.model.reportAttributeCombo.isDefault ? null : $scope.model.reportAttributeCombo.id,
                    $scope.model.reportAttributeCombo.isDefault ? null : ActionMappingUtils.getOptionIds([instance,$scope.model.agencyCategory.selectedOption]),
                    false).then(function(response){                
                    var dialogOptions = {
                        headerText: 'success',
                        bodyText: 'marked_not_complete'
                    };
                    DialogService.showDialog({}, dialogOptions);
                    processCompleteness(false, dataSet, attOc);                

                }, function(response){
                    ActionMappingUtils.errorNotifier( response );
                });
            });
        }
        else{
            var dialogOptions = {
                headerText: 'info',
                bodyText: 'missing_authority_delete_completeness'
            };
            DialogService.showDialog({}, dialogOptions);
        }                
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
        if( $scope.model.selectedReport && ( $scope.model.selectedReport.id === 'SUMMARY' || $scope.model.selectedReport.id === 'AGENCY_COMPLETENESS' ) ){
            if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id &&
                    $scope.model.selectedPeriod && $scope.model.selectedPeriod.id && 
                    $scope.model.agencyCategory && $scope.model.agencyCategory.selectedOption){
                return true;
            }
        }
        else if( $scope.model.selectedReport && ($scope.model.selectedReport.id === 'CNA' || 
                $scope.model.selectedReport.id === 'ALIGNED_INVESTMENT' || 
                $scope.model.selectedReport.id === 'LOGO_MAP' ||
                $scope.model.selectedReport.id === 'NUM_AGENCIES') ){
            if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id &&
                    $scope.model.selectedPeriod && $scope.model.selectedPeriod.id ){
                return true;
            }
        }
        
        return false;
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
    
    $scope.showReport = function( summaryReport ){
        $scope.showReportDiv = true;
        
        if( summaryReport ){
            $scope.model.selectedReport = $scope.model.reportTypes[0];
        }        
        
        $scope.locationHeader = $filter('filter')($scope.model.categoryOptionGroups, {actionInventoryDimensionType: 'geographicFocus'})[0];
        if( $scope.locationHeader && $scope.locationHeader.categoryOptions && $scope.locationHeader.categoryOptions.length ){
            $scope.locationHeader.categoryOptions = orderByFilter($scope.locationHeader.categoryOptions, '-order').reverse();
        }
        
        $scope.investmentHeader = $filter('filter')($scope.model.categoryOptionGroups, {actionInventoryDimensionType: 'investmentSize'})[0];
        if( $scope.investmentHeader && $scope.investmentHeader.categoryOptions && $scope.investmentHeader.categoryOptions.length ){
            $scope.investmentHeader.categoryOptions = orderByFilter($scope.investmentHeader.categoryOptions, '-order').reverse();
        }
        
        $scope.cnaRow = $filter('filter')($scope.model.categoryOptionGroups, {actionInventoryDimensionType: 'cna'})[0];
        if( $scope.cnaRow && $scope.cnaRow.categoryOptions && $scope.cnaRow.categoryOptions.length ){
            $scope.cnaRow.categoryOptions = orderByFilter($scope.cnaRow.categoryOptions, '-order').reverse();
        }
        
        $scope.nnpRow = $filter('filter')($scope.model.categoryOptionGroups, {actionInventoryDimensionType: 'nnp'})[0];
        if( $scope.nnpRow && $scope.nnpRow.categoryOptions && $scope.nnpRow.categoryOptions.length ){
            $scope.nnpRow.categoryOptions = orderByFilter($scope.nnpRow.categoryOptions, '-order').reverse();
        } 
        
        DataSetFactory.getDataSetsByProperty( 'dataSetDomain', 'REPORT' ).then(function(dataSets){
            if( dataSets && dataSets[0] && dataSets[0].dataSetDomain === 'REPORT' ){
                var reportUrl = 'orgUnit=' + $scope.selectedOrgUnit.id;
                reportUrl += '&period=' + $scope.model.selectedPeriod.id;
                reportUrl += '&dataSet=' + dataSets[0].id;
                
                var keys = $filter('filter')($scope.model.mappedCategoryCombos[dataSets[0].dataElements[0].categoryCombo.id].categoryOptionCombos, {categoryOptionGroup: {id: $scope.model.actionConductedKey.id}});
                  
                if( keys[0] ){                
                    var reportParams = {orgUnit: $scope.selectedOrgUnit.id, period: $scope.model.selectedPeriod, url: reportUrl};
                    $scope.reportData = {reportReady: false};
                    $scope.reportData.keyDimension = keys[0].id;
                    if( $scope.model.agencyCategory && $scope.model.agencyCategory.selectedOption && $scope.model.agencyCategory.selectedOption.displayName ){
                        $scope.reportData.agency = $scope.model.agencyCategory.selectedOption;
                    }
                    
                    $scope.reportData.reportType = $scope.model.selectedReport;
                    
                    $scope.reportData.allValues = {};                    
                    angular.forEach($scope.model.dataSets, function(ds){
                        var deId = ds.dataElements[0].id;
                        $scope.reportData.allValues[deId] = {};
                        angular.forEach($scope.model.agencyCategory.categoryOptions, function(o){
                            $scope.reportData.allValues[deId][o.displayName] = {};
                            angular.forEach($scope.model.instanceCategory.categoryOptions, function(i){
                                $scope.reportData.allValues[deId][o.displayName][i.displayName] = {};                                
                            });
                        });
                    });

                    ReportService.getReportData( reportParams, $scope.reportData, $scope.model.mappedOptionCombosById ).then(function(response){                        
                        $scope.reportData = response;
                        $scope.emptyRowExists = false;
                        $scope.dataSetCompletedBy = {};
                        $scope.completenessExists = false;
                        if( $scope.model.selectedReport ){
                            if( $scope.model.selectedReport.id === 'SUMMARY' || $scope.model.selectedReport.id === 'AGENCY_COMPLETENESS' ){
                                if( response && response.mappedValues ){
                                    $scope.filteredReportData = {};
                                    var dataSetsWithData = [];
                                    angular.forEach($scope.model.dataSets, function(ds){
                                        if( ds.dataElements && ds.dataElements.length === 1 ){
                                            var de = ds.dataElements[0];
                                            if( !$scope.reportData.mappedValues[de.id] ){
                                                $scope.reportData.mappedValues[de.id] = {};
                                                $scope.reportData.mappedValues[de.id][$scope.model.instanceCategory.categoryOptions[0].displayName] = {};
                                                $scope.emptyRowExists = true;
                                            }
                                            else{                                    
                                                $scope.filteredReportData[de.id] = $scope.reportData.mappedValues[de.id];
                                                dataSetsWithData.push( ds.id );
                                            }
                                        }                                    
                                    });
                                    
                                    if( dataSetsWithData.length > 0 ){
                                        CompletenessService.get( $.map(dataSetsWithData, function(ds){return ds;}).join(','), $scope.selectedOrgUnit.id, $scope.model.selectedPeriod.id, false).then(function(response){
                                            if( response && 
                                                    response.completeDataSetRegistrations && 
                                                    response.completeDataSetRegistrations.length &&
                                                    response.completeDataSetRegistrations.length > 0){

                                                angular.forEach(response.completeDataSetRegistrations, function(cdr){                                            
                                                    if( !$scope.dataSetCompleteness ){
                                                        $scope.dataSetCompleteness = {};
                                                    }
                                                    if( !$scope.dataSetCompleteness[cdr.dataSet] ){
                                                        $scope.dataSetCompleteness[cdr.dataSet] = {};
                                                    }

                                                    if( !$scope.dataSetCompletedBy ){
                                                        $scope.dataSetCompletedBy = {};
                                                    }
                                                    if( !$scope.dataSetCompletedBy[cdr.dataSet] ){
                                                        $scope.dataSetCompletedBy[cdr.dataSet] = {};
                                                    }
                                                    $scope.dataSetCompletedBy[cdr.dataSet][cdr.attributeOptionCombo] = cdr.storedBy;
                                                    $scope.dataSetCompleteness[cdr.dataSet][cdr.attributeOptionCombo] = true;
                                                });
                                                $scope.completenessExists = true;
                                            }
                                        });
                                    }
                                }
                            }                            
                            else if( $scope.model.selectedReport.id === 'CNA' ){
                                $scope.model.cnaCols = [];
                                angular.forEach($scope.locationHeader.categoryOptions, function(h){
                                    angular.forEach($scope.model.agencyCategory.categoryOptions, function(o){                                    
                                        $scope.model.cnaCols.push(angular.copy( angular.extend(o,{parent: h})));
                                    });
                                });

                                $scope.cnaData = {};
                                angular.forEach($scope.model.agencyCategory.categoryOptions, function(ag){
                                    $scope.cnaData[ag.displayName] = {};
                                    angular.forEach($scope.cnaRow.categoryOptions, function(op){
                                        $scope.cnaData[ag.displayName][op.displayName] = [];
                                    });
                                });

                                for( var k in $scope.reportData.allValues ){
                                    if( $scope.reportData.allValues.hasOwnProperty( k ) ){
                                        var obj = $scope.reportData.allValues[k];                                    
                                        angular.forEach($scope.model.agencyCategory.categoryOptions, function(ag){
                                            angular.forEach($scope.model.instanceCategory.categoryOptions, function(ins){                                            
                                                if( !angular.equals(obj[ag.displayName][ins.displayName], {}) ) {
                                                    if( $scope.cnaRow && $scope.cnaRow.categoryOptions && $scope.cnaRow.categoryOptions.length && obj[ag.displayName][ins.displayName][$scope.locationHeader.id] && obj[ag.displayName][ins.displayName][$scope.cnaRow.id]){                                                    
                                                        angular.forEach(obj[ag.displayName][ins.displayName][$scope.cnaRow.id], function(val){
                                                            $scope.cnaData[ag.displayName][val] = _.union($scope.cnaData[ag.displayName][val], obj[ag.displayName][ins.displayName][$scope.locationHeader.id]);
                                                        });
                                                    }
                                                }
                                            });
                                        });
                                    }
                                }
                            }
                            else if( $scope.model.selectedReport.id === 'ALIGNED_INVESTMENT' ){
                                $scope.cnaInvestData = {};
                                $scope.nnpInvestData = {};

                                angular.forEach($scope.cnaRow.categoryOptions, function(op){                                
                                    $scope.cnaInvestData[op.displayName] = {};
                                    angular.forEach($scope.investmentHeader.categoryOptions, function(h){                                
                                        $scope.cnaInvestData[op.displayName][h.displayName] = 0;
                                    });                                
                                });

                                angular.forEach($scope.nnpRow.categoryOptions, function(op){                                
                                    $scope.nnpInvestData[op.displayName] = {};
                                    angular.forEach($scope.investmentHeader.categoryOptions, function(h){                                
                                        $scope.nnpInvestData[op.displayName][h.displayName] = 0;
                                    });                                
                                });

                                for( var k in $scope.reportData.allValues ){
                                    if( $scope.reportData.allValues.hasOwnProperty( k ) ){
                                        var obj = $scope.reportData.allValues[k];                                    
                                        angular.forEach($scope.model.agencyCategory.categoryOptions, function(ag){
                                            angular.forEach($scope.model.instanceCategory.categoryOptions, function(ins){                                            
                                                if( !angular.equals(obj[ag.displayName][ins.displayName], {}) && obj[ag.displayName][ins.displayName][$scope.investmentHeader.id] ) {
                                                    var val = obj[ag.displayName][ins.displayName][$scope.investmentHeader.id];
                                                    if( obj[ag.displayName][ins.displayName][$scope.cnaRow.id] ){
                                                        angular.forEach(obj[ag.displayName][ins.displayName][$scope.cnaRow.id], function(v){
                                                            $scope.cnaInvestData[v][val]++;
                                                        });
                                                    }

                                                    if( obj[ag.displayName][ins.displayName][$scope.nnpRow.id] ){
                                                        angular.forEach(obj[ag.displayName][ins.displayName][$scope.nnpRow.id], function(v){
                                                            $scope.nnpInvestData[v][val]++;
                                                        });
                                                    }
                                                }
                                            });
                                        });
                                    }
                                }
                            }
                            else if( $scope.model.selectedReport.id === 'LOGO_MAP' ){                            
                                $scope.agencyData = {};
                                angular.forEach($scope.model.agencyCategory.categoryOptions, function(ag){
                                    $scope.agencyData[ag.displayName] = [];
                                });

                                for( var k in $scope.reportData.allValues ){
                                    if( $scope.reportData.allValues.hasOwnProperty( k ) ){                                    
                                        var obj = $scope.reportData.allValues[k];                                    
                                        angular.forEach($scope.model.agencyCategory.categoryOptions, function(ag){                                        
                                            angular.forEach($scope.model.instanceCategory.categoryOptions, function(ins){                                            
                                                if( !angular.equals(obj[ag.displayName][ins.displayName], {}) ) {                                                
                                                    if( $scope.locationHeader && $scope.locationHeader.id && $scope.locationHeader.categoryOptions.length && obj[ag.displayName][ins.displayName][$scope.locationHeader.id] ){
                                                        $scope.agencyData[ag.displayName] = _.union($scope.agencyData[ag.displayName], obj[ag.displayName][ins.displayName][$scope.locationHeader.id]);
                                                    }
                                                }
                                            });
                                        });
                                    }
                                }
                            }
                            else if( $scope.model.selectedReport.id === 'NUM_AGENCIES' ){                            
                                $scope.regionData = {};
                                angular.forEach($scope.locationHeader.categoryOptions, function(l){
                                    $scope.regionData[l.displayName] = [];
                                });

                                for( var k in $scope.reportData.allValues ){
                                    if( $scope.reportData.allValues.hasOwnProperty( k ) ){                                    
                                        var obj = $scope.reportData.allValues[k];                                    
                                        angular.forEach($scope.model.agencyCategory.categoryOptions, function(ag){                                        
                                            angular.forEach($scope.model.instanceCategory.categoryOptions, function(ins){                                            
                                                if( !angular.equals(obj[ag.displayName][ins.displayName], {}) ) {                                                
                                                    if( $scope.locationHeader && $scope.locationHeader.id && $scope.locationHeader.categoryOptions.length && obj[ag.displayName][ins.displayName][$scope.locationHeader.id] ){                                                    
                                                        angular.forEach(obj[ag.displayName][ins.displayName][$scope.locationHeader.id], function(r){                                                        
                                                            $scope.regionData[r] = _.union($scope.regionData[r], [ag.displayName]);
                                                        });
                                                    }
                                                }
                                            });
                                        });
                                    }
                                }
                            }
                        }
                    });
                }
            }
        });
    };
    
    $scope.getPropertyCount = function( obj ){
        var count = 0;
        for( var key in obj ){
            if( obj.hasOwnProperty( key ) ){
                count++;
            }
        }        
        return count;
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        
        var reportName = '';
        
        if( $scope.model.selectedReport ){
            if( $scope.model.selectedReport.id === 'SUMMARY' ){
                reportName = $scope.selectedOrgUnit.displayName + '-' + $scope.model.selectedPeriod.displayName + '-' +  $scope.model.agencyCategory.selectedOption.displayName +'.xls';
            }
            else{
                reportName = $scope.selectedOrgUnit.displayName + '-' + $scope.model.selectedPeriod.displayName + '-' +  $scope.model.selectedReport.displayName +'.xls';               
            }
        }
        
        saveAs(blob, reportName);
    };
    
    $scope.getSubActionName = function( str ){
        if( str.indexOf( ' - ') === - 1 ){
            return str;
        }
        var _str = str.split(' - ')[0];        
        return _str + ' - ' + $translate.instant('sub_actions');        
    };
    
    $scope.cnaDataExists = function(agency, cna, region){
        if( $scope.cnaData && 
                agency && 
                cna && 
                region && 
                $scope.cnaData[agency] && 
                $scope.cnaData[agency][cna] && 
                $scope.cnaData[agency][cna].length ){            
            return $scope.cnaData[agency][cna].indexOf( region ) !== -1 ? $translate.instant('yes') : $translate.instant('no');
        }        
        return $translate.instant('no');
    };
    
    $scope.agencyDataExists = function(agency, region){
        if( $scope.agencyData && 
                agency && 
                region && 
                $scope.agencyData[agency] &&  
                $scope.agencyData[agency].length ){            
            return $scope.agencyData[agency].indexOf( region ) !== -1 ? $translate.instant('yes') : $translate.instant('no');
        }        
        return $translate.instant('no');
    };
    
    $scope.getInvestTotal = function( obj ){
        var total = 0;        
        for( var k in obj ){
            if( obj.hasOwnProperty( k ) ){
                total += obj[k];
            }
        }        
        return total;
    };
    
    $scope.getIconClass = function(icon){
        return icon.cls;
    };
});
