/* global angular, moment, dhis2, parseFloat */

'use strict';

/* Services */

var actionMappingServices = angular.module('actionMappingServices', ['ngResource'])

.factory('PMTStorageService', function(){
    var store = new dhis2.storage.Store({
        name: "dhis2suninventory",
        adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
        objectStores: ['dataSets', 'dataElementGroupSets', 'optionSets', 'categoryOptionGroups', 'categoryCombos', 'programs', 'ouLevels', 'indicatorGroups']
    });
    return{
        currentStore: store
    };
})

/* Period generator */
.service('PeriodService', function(DateUtils, CalendarService){
    
    this.getPeriods = function(periodType, periodOffset, futurePeriods){
        futurePeriods = 1;
        
        if(!periodType){
            return [];
        }
        
        var calendarSetting = CalendarService.getSetting();
                
        dhis2.period.format = calendarSetting.keyDateFormat;
        
        dhis2.period.calendar = $.calendars.instance( calendarSetting.keyCalendar );
                
        dhis2.period.generator = new dhis2.period.PeriodGenerator( dhis2.period.calendar, dhis2.period.format );
        
        dhis2.period.picker = new dhis2.period.DatePicker( dhis2.period.calendar, dhis2.period.format );
        
        var d2Periods = dhis2.period.generator.generateReversedPeriods( periodType, periodOffset );
                
        d2Periods = dhis2.period.generator.filterOpenPeriods( periodType, d2Periods, futurePeriods, null, null );
                
        angular.forEach(d2Periods, function(p){            
            p.endDate = DateUtils.formatFromApiToUser(p.endDate);
            p.startDate = DateUtils.formatFromApiToUser(p.startDate);
            p.displayName = p.name;
            p.id = p.iso;
        });
        
        return d2Periods;        
    };
})

/* Factory to fetch optionSets */
.factory('OptionSetService', function($q, $rootScope, PMTStorageService) { 
    return {
        getAll: function(){
            
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('optionSets').done(function(optionSets){
                    $rootScope.$apply(function(){
                        def.resolve(optionSets);
                    });                    
                });
            });            
            
            return def.promise;            
        },
        get: function(uid){            
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.get('optionSets', uid).done(function(optionSet){                    
                    $rootScope.$apply(function(){
                        def.resolve(optionSet);
                    });
                });
            });                        
            return def.promise;
        },
        getCode: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].displayName){
                        return options[i].code;
                    }
                }
            }            
            return key;
        },        
        getName: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){                    
                    if( key === options[i].code){
                        return options[i].displayName;
                    }
                }
            }            
            return key;
        }
    };
})

/* Service to fetch option combos */
.factory('OptionComboService', function($q, $rootScope, PMTStorageService) { 
    return {
        getAll: function(){            
            var def = $q.defer();            
            var optionCombos = [];
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
                    angular.forEach(categoryCombos, function(cc){
                        optionCombos = optionCombos.concat( cc.categoryOptionCombos );
                    });
                    $rootScope.$apply(function(){
                        def.resolve(optionCombos);
                    });                    
                });
            });            
            
            return def.promise;            
        },
        getMappedOptionCombos: function(uid){            
            var def = $q.defer();            
            var optionCombos = [];
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
                    angular.forEach(categoryCombos, function(cc){
                        angular.forEach(cc.categoryOptionCombos, function(oco){
                            oco.categories = [];
                            angular.forEach(cc.categories, function(c){
                                oco.categories.push({id: c.id, displayName: c.displayName});
                            });
                            optionCombos[oco.id] = oco;
                        });
                    });
                    $rootScope.$apply(function(){
                        def.resolve(optionCombos);
                    });                    
                });
            });            
            
            return def.promise;            
        }
    };
})

/* Factory to fetch programs */
.factory('DataSetFactory', function($q, $rootScope, SessionStorageService, ActionMappingUtils, PMTStorageService, orderByFilter, CommonUtils) { 
    
    return {        
        getDataSets: function( ou ){                
            var roles = SessionStorageService.get('USER_ROLES');
            var userRoles = roles && roles.userCredentials && roles.userCredentials.userRoles ? roles.userCredentials.userRoles : [];
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];                    
                    angular.forEach(dss, function(ds){
                        if( CommonUtils.userHasValidRole(ds, 'dataSets', userRoles ) && ds.organisationUnits.hasOwnProperty( ou.id ) ){                                                    
                            ds = ActionMappingUtils.processDataSet( ds );
                            dataSets.push(ds);
                        }
                    });
                    
                    $rootScope.$apply(function(){
                        def.resolve(dataSets);
                    });
                });
            });            
            return def.promise;            
        },
        getDataSetsByProperty: function( property, value ){
            var roles = SessionStorageService.get('USER_ROLES');
            var userRoles = roles && roles.userCredentials && roles.userCredentials.userRoles ? roles.userCredentials.userRoles : [];
            
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];                    
                    angular.forEach(dss, function(ds){
                        if( CommonUtils.userHasValidRole(ds, 'dataSets', userRoles ) && ds[property] && ds[property] === value ){                            
                            ds = ActionMappingUtils.processDataSet( ds );
                            dataSets.push(ds);
                        }
                    });                    
                    
                    $rootScope.$apply(function(){
                        def.resolve(dataSets);
                    });
                });
            });            
            return def.promise;            
        },
        get: function(uid){            
            var def = $q.defer();            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.get('dataSets', uid).done(function(ds){                    
                    $rootScope.$apply(function(){
                        ds = ActionMappingUtils.processDataSet( ds );
                        def.resolve(ds);
                    });
                });
            });                        
            return def.promise;            
        },
        getByOu: function(ou, selectedDataSet){
            var roles = SessionStorageService.get('USER_ROLES');
            var userRoles = roles && roles.userCredentials && roles.userCredentials.userRoles ? roles.userCredentials.userRoles : [];
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];
                    angular.forEach(dss, function(ds){                            
                        if(ds.organisationUnits.hasOwnProperty( ou.id ) && CommonUtils.userHasValidRole(ds,'dataSets', userRoles)){
                            ds = ActionMappingUtils.processDataSet( ds );
                            dataSets.push(ds);
                        }
                    });
                    
                    dataSets = orderByFilter(dataSets, '-displayName').reverse();
                    
                    if(dataSets.length === 0){
                        selectedDataSet = null;
                    }
                    else if(dataSets.length === 1){
                        selectedDataSet = dataSets[0];
                    } 
                    else{
                        if(selectedDataSet){
                            var continueLoop = true;
                            for(var i=0; i<dataSets.length && continueLoop; i++){
                                if(dataSets[i].id === selectedDataSet.id){                                
                                    selectedDataSet = dataSets[i];
                                    continueLoop = false;
                                }
                            }
                            if(continueLoop){
                                selectedDataSet = null;
                            }
                        }
                    }
                                        
                    if(!selectedDataSet || angular.isUndefined(selectedDataSet) && dataSets.legth > 0){
                        selectedDataSet = dataSets[0];
                    }
                    
                    $rootScope.$apply(function(){
                        def.resolve({dataSets: dataSets, selectedDataSet: selectedDataSet});
                    });                      
                });
            });            
            return def.promise;
        }
    };
})

/* factory to fetch and process programValidations */
.factory('MetaDataFactory', function($q, $rootScope, PMTStorageService, orderByFilter) {  
    
    return {        
        get: function(store, uid){            
            var def = $q.defer();            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.get(store, uid).done(function(obj){                    
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });                        
            return def.promise;
        },
        set: function(store, obj){            
            var def = $q.defer();            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.set(store, obj).done(function(obj){                    
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });                        
            return def.promise;
        },
        getAll: function(store){
            var def = $q.defer();
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll(store).done(function(objs){                    
                    objs = orderByFilter(objs, '-name').reverse();                    
                    $rootScope.$apply(function(){
                        def.resolve(objs);
                    });
                });                
            });            
            return def.promise;
        }
    };        
})

.service('DataValueService', function($q, $http, ActionMappingUtils) {   
    
    return {        
        deleteDataValue: function( dv ){            
            var url = '?de='+dv.de + '&ou='+dv.ou + '&pe='+dv.pe + '&co='+dv.co;
            
            if( dv.cc && dv.cp ){
                url += '&cc='+dv.cc + '&cp='+dv.cp;
            }
            
            var promise = $http.delete('../api/dataValues.json' + url).then(function(response){
                return response.data;
            });
            return promise;
        },        
        getDataValue: function( dv ){
            var promise = $http.get('../api/dataValues.json?de='+dv.de+'&ou='+dv.ou+'&pe='+dv.pe).then(function(response){
                return response.data;
            });
            return promise;
        },
        saveDataValue: function( dv ){            
            var url = '?de='+dv.de + '&ou='+dv.ou + '&pe='+dv.pe + '&co='+dv.co + '&value='+dv.value;
            
            if( dv.cc && dv.cp ){
                url += '&cc='+dv.cc + '&cp='+dv.cp;
            }            
            if( dv.comment ){
                url += '&comment=' + dv.comment; 
            }
            
            var promise = $http.post('../api/dataValues.json' + url).then(function(response){
                return response.data;
            });
            return promise;
        },
        saveDataValueSets: function(dvs){
            var promise = $http.post('../api/dataValueSets.json?', dvs ).then(function(response){               
                return response.data;
            });            
            return promise;            
        },
        saveDataValueSet: function(dvs, cc, cp){
            var def = $q.defer();            
            var promises = [], toBeSaved = [];
            
            angular.forEach(dvs.dataValues, function(dv){                
                if( dv.value === "" || dv.value === null ){
                    //deleting...                    
                    var url = '?de='+dv.dataElement + '&ou='+dvs.orgUnit + '&pe='+dvs.period + '&co='+dv.categoryOptionCombo;
                    
                    if( cc && cp ){
                        url += '&cc='+cc + '&cp='+cp;
                    }                    
                    promises.push( $http.delete('../api/dataValues.json' + url) );
                }
                else{
                    //saving...
                    toBeSaved.push( dv );
                }                
            });
            
            if( toBeSaved.length > 0 ){
                dvs.dataValues = toBeSaved;
                promises.push( $http.post('../api/dataValueSets.json', dvs) );
            }
            
            $q.all(promises).then(function(){                
                def.resolve();
            });
            return def.promise;
        },
        getDataValueSet: function( params ){            
            var promise = $http.get('../api/dataValueSets.json?' + params ).then(function(response){               
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });            
            return promise;
        }
    };    
})

.service('CompletenessService', function($http, ActionMappingUtils) {   
    
    return {        
        get: function( ds, ou, period, children ){
            var promise = $http.get('../api/completeDataSetRegistrations?dataSet='+ds+'&orgUnit='+ou+'&period='+period+'&children='+children).then(function(response){
                return response.data;
            }, function(response){                
                ActionMappingUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        save: function( dsr ){
            var promise = $http.post('../api/completeDataSetRegistrations', dsr ).then(function(response){
                return response.data;
            }, function(response){                
                ActionMappingUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        delete: function( ds, pe, ou, cc, cp, multiOu){
            var promise = $http.delete('../api/completeDataSetRegistrations?ds='+ ds + '&pe=' + pe + '&ou=' + ou + '&cc=' + cc + '&cp=' + cp + '&multiOu=' + multiOu ).then(function(response){
                return response.data;
            }, function(response){                
                ActionMappingUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        }
    };
})

.service('DataValueAuditService', function($http, ActionMappingUtils) {   
    
    return {        
        getDataValueAudit: function( dv ){
            var promise = $http.get('../api/audits/dataValue.json?paging=false&de='+dv.de+'&ou='+dv.ou+'&pe='+dv.pe+'&co='+dv.co+'&cc='+dv.cc).then(function(response){
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });
            return promise;
        }
    };
})

.service('EventValueAuditService', function($http, ActionMappingUtils) {   
    
    return {        
        getEventValueAudit: function( event ){
            var promise = $http.get('../api/audits/trackedEntityDataValue.json?paging=false&psi='+event).then(function(response){
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });
            return promise;
        }
    };
})

.service('OrgUnitService', function($http){
    var orgUnit, orgUnitPromise;
    return {
        get: function( uid ){
            if( orgUnit !== uid ){
                var url = '../api/organisationUnits.json?filter=path:like:/' + uid + '&fields=id,displayName,path,level,parent[id]&paging=false';
                orgUnitPromise = $http.get( encodeURI(url) ).then(function(response){
                    orgUnit = response.data.id;
                    return response.data;
                });
            }
            return orgUnitPromise;
        }
    };
})

.service('ActionMappingUtils', function($q, $translate, $filter, DialogService, OrgUnitService){
    return {
        getSum: function( op1, op2 ){
            op1 = dhis2.validation.isNumber(op1) ? parseInt(op1) : 0;
            op2 = dhis2.validation.isNumber(op2) ? parseInt(op2) : 0;        
            return op1 + op2;
        },
        getPercent: function(op1, op2){        
            op1 = dhis2.validation.isNumber(op1) ? parseInt(op1) : 0;
            op2 = dhis2.validation.isNumber(op2) ? parseInt(op2) : 0;        
            if( op2 === 0 || op1 === 0){
                return 0;
            }        
            return parseFloat((op1 / op2)*100).toFixed(2) + '%';
        },
        getRoleHeaders: function(){
            var headers = [];            
            headers.push({id: 'catalyst', displayName: $translate.instant('catalyst')});
            headers.push({id: 'funder', displayName: $translate.instant('funder')});
            headers.push({id: 'responsibleMinistry', displayName: $translate.instant('responsible_ministry')});
            
            return headers;
        },
        getOptionComboIdFromOptionNames: function(optionComboMap, options, categoryCombo){
            if( categoryCombo && categoryCombo.isDefault ){
                return categoryCombo.categoryOptionCombos[0].id;
            }            
            
            var optionNames = [];
            angular.forEach(options, function(op){
                optionNames.push(op.displayName);
            });
            
            var selectedOptionComboName = optionNames.toString();
            selectedOptionComboName =  selectedOptionComboName.replace(/\,/g, ', ');
            
            var selectedAttributeOptionCombo = optionComboMap[selectedOptionComboName];
            
            if( !selectedAttributeOptionCombo || angular.isUndefined( selectedAttributeOptionCombo ) ){
                selectedOptionComboName = optionNames.reverse().toString();
                selectedOptionComboName = selectedOptionComboName.replace(",", ", ");
                selectedAttributeOptionCombo = optionComboMap[selectedOptionComboName];
            }
            
            return selectedAttributeOptionCombo;
        },
        splitRoles: function( roles ){
            return roles.split(","); 
        },
        pushRoles: function(existingRoles, roles){
            var newRoles = roles.split(",");
            angular.forEach(newRoles, function(r){
                if( existingRoles.indexOf(r) === -1 ){
                    existingRoles.push(r);
                }
            });            
            return existingRoles;
        },
        getOptionIds: function(options){            
            var optionNames = '';
            angular.forEach(options, function(o){
                optionNames += o.id + ';';
            });            
            
            return optionNames.slice(0,-1);
        },
        errorNotifier: function(response){
            if( response && response.data && response.data.status === 'ERROR'){
                var dialogOptions = {
                    headerText: response.data.status,
                    bodyText: response.data.message ? response.data.message : $translate.instant('unable_to_fetch_data_from_server')
                };		
                DialogService.showDialog({}, dialogOptions);
            }
        },
        notificationDialog: function(headerText, bodyText){
            var dialogOptions = {
                headerText: headerText,
                bodyText: bodyText
            };		
            DialogService.showDialog({}, dialogOptions);
        },
        getNumeratorAndDenominatorIds: function( ind ){            
            var num = ind.numerator.substring(2,ind.numerator.length-1);
            num = num.split('.');            
            var den = ind.denominator.substring(2,ind.numerator.length-1);
            den = den.split('.');            
            return {numerator: num[0], numeratorOptionCombo: num[1], denominator: den[0], denominatorOptionCombo: den[1]};
        },
        getRequiredCols: function(availableRoles, selectedRole){
            var cols = [];
            for (var k in availableRoles[selectedRole.id]){
                if ( availableRoles[selectedRole.id].hasOwnProperty(k) ) {
                    angular.forEach(availableRoles[selectedRole.id][k], function(c){
                        c = c.trim();
                        if( cols.indexOf( c ) === -1 ){
                            c = c.trim();
                            if( selectedRole.domain === 'CA' ){
                                if( selectedRole.categoryOptions && selectedRole.categoryOptions.indexOf( c ) !== -1){
                                    cols.push( c );
                                }
                            }
                            else{
                                cols.push( c );
                            }                        
                        }
                    });                
                }
            }
            return cols.sort();
        },
        populateOuLevels: function( orgUnit, ouLevels ){
            var ouModes = [{displayName: $translate.instant('selected_level') , value: 'SELECTED', level: orgUnit.l}];
            var limit = orgUnit.l === 1 ? 2 : 3;
            for( var i=orgUnit.l+1; i<=limit; i++ ){
                var lvl = ouLevels[i];
                ouModes.push({value: lvl, displayName: lvl + ' ' + $translate.instant('level'), level: i});
            }
            var selectedOuMode = ouModes[0];            
            return {ouModes: ouModes, selectedOuMode: selectedOuMode};
        },
        getChildrenIds: function( orgUnit ){
            var def = $q.defer();
            OrgUnitService.get( orgUnit.id ).then(function( json ){
                var childrenIds = [];
                var children = json.organisationUnits;
                var childrenByIds = [];
                
                angular.forEach(children, function(c){
                    c.path = c.path.substring(1, c.path.length);
                    c.path = c.path.split("/");
                    childrenByIds[c.id] = c;
                });                    
                
                if( orgUnit.l === 1 ){
                    angular.forEach($filter('filter')(children, {level: 3}), function(c){
                        childrenIds.push(c.id);                        
                    });
                }
                else if ( orgUnit.l === 2 ){
                    childrenIds = orgUnit.c;
                }
                else {
                    childrenIds = [orgUnit.id];
                }

                def.resolve( {childrenIds: childrenIds, children: $filter('filter')(children, {parent: {id: orgUnit.id}}), descendants: $filter('filter')(children, {level: 3}), childrenByIds: childrenByIds } );
            });
            
            return def.promise;
        },
        formatDataValue: function(dv, de, ccs){
            
            if(!dv || !dv.value || !de || !de.valueType){
                return;
            }            
            
            if( de.dimensionAsOptionSet ){                
                for( var i=0; i<ccs[de.categoryCombo.id].categoryOptionCombos.length; i++ ){
                    if( dv.categoryOptionCombo === ccs[de.categoryCombo.id].categoryOptionCombos[i].id ){
                        dv.value = ccs[de.categoryCombo.id].categoryOptionCombos[i];
                    }
                }                
            }            
            else{
                if( de.valueType === 'NUMBER' ){
                    dv.value = parseFloat( dv.value );
                }
                else if(de.valueType === 'INTEGER' ||
                        de.valueType === 'INTEGER_POSITIVE' ||
                        de.valueType === 'INTEGER_NEGATIVE' ||
                        de.valueType === 'INTEGER_ZERO_OR_POSITIVE' ){
                    dv.value = parseInt( dv.value );
                }
            }
                        
            return dv.value;
        },
        processDataSet: function( ds ){
            var dataElements = [];
            angular.forEach(ds.dataSetElements, function(dse){
                if( dse.dataElement ){
                    dataElements.push( dhis2.metadata.processMetaDataAttribute( dse.dataElement ) );
                }                            
            });
            ds.dataElements = dataElements;
            delete ds.dataSetElements;
            
            return ds;
        },
        indexOf: function( objs, obj, prop ){
            if( !objs || !objs.length || objs.length === 0 || !obj || !prop ){
                return -1;
            }
            
            for( var i=0; i< objs.length; i++ ){
                if( objs[i][prop] === obj[prop] ){
                    return i;
                }
            }
            
            return -1;
        },
        joinOnProperty: function( objs, prop){
            var result = [];
            angular.forEach(objs, function(obj){
                result.push( obj[prop] );
            });
            return result.join(', ');
        },
        getIcons: function(){
            var icons = [];
            
            icons.push({
                href: 'http://www.reachpartnership.org/documents/312104/647fc812-274b-4028-a36e-bf78a4e7c008',
                src: 'images/food_agriculture_and_healthy_diets.jpg',
                alt: 'food_agriculture_and_healthy_diets',
                cls: 'can-1-container'
            });
            
            icons.push({
                href: 'http://www.reachpartnership.org/documents/312104/b58a5c8e-4989-4f1a-81fb-57ae850abd63',
                src: 'images/maternal_and_child_care.jpg',
                alt: 'maternal_and_child_care',
                cls: 'can-2-container'
            });
            
            icons.push({
                href: 'http://www.reachpartnership.org/documents/312104/0c8e3dfd-a1f2-4678-a340-0050ef54290d',
                src: 'images/health.jpg',
                alt: 'health',
                cls: 'can-3-container'
            });
            
            icons.push({
                href: 'http://www.reachpartnership.org/documents/312104/8df9b5e7-1452-4e40-ae83-b8b4e6cc9e23',
                src: 'images/social_protection.jpg',
                alt: 'social_protection',
                cls: 'can-4-container'
            });
            
            icons.push({
                href: 'http://www.reachpartnership.org/documents/312104/7ce1820e-cdbd-42ad-84a8-24872d8db2cd',
                src: 'images/facilitation_of_multisectoral_nutrition_governance.jpg',
                alt: 'facilitation_of_multisectoral_nutrition_governance',
                cls: 'can-5-container'
            });
            
            return icons;
        }
    };
})

.service('ReportService', function($q, $sce, DataValueService){
    
    var getSummaryReport = function( rawData, reportData, mappedOptionCombosById ){
        var mappedValues = {};
        angular.forEach(rawData.dataValues, function(dv){
            var aoco = mappedOptionCombosById[dv.attributeOptionCombo];
            if( dv.value === "1" && reportData.agency && reportData.agency.displayName && aoco && aoco.displayName ){
                aoco = aoco.displayName.split(", ");
                if( aoco.indexOf( reportData.agency.displayName ) !== -1 && aoco.length === 2 ){
                    reportData.noDataExists = false;
                    if( !mappedValues[dv.dataElement] ){
                        mappedValues[dv.dataElement] = {};
                    }

                    if( !mappedValues[dv.dataElement][aoco[1]] ){
                        mappedValues[dv.dataElement][aoco[1]] = {};
                    }

                    var coco = mappedOptionCombosById[dv.categoryOptionCombo];                                
                    if ( coco && coco.categoryOptionGroup && coco.categoryOptionGroup.id ){                                    
                        if( coco.categoryOptionGroup.actionConducted ){
                            if( !reportData.comments[dv.dataElement] ){
                                reportData.comments[dv.dataElement] = {};
                                reportData.comments[dv.dataElement][aoco[1]] = {};
                            }
                            else{
                                if( !reportData.comments[dv.dataElement][aoco[1]] ){
                                    reportData.comments[dv.dataElement][aoco[1]] = {};
                                }
                            }                                        
                            reportData.comments[dv.dataElement][aoco[1]].comment = dv.comment ? $sce.trustAsHtml(dv.comment.replace(/\r?\n/g,'<br />')) : "";
                        }
                        else{
                            if( coco.categoryOptionGroup.dimensionEntryMode ){
                                if( coco.categoryOptionGroup.dimensionEntryMode === 'SINGLE'){
                                    mappedValues[dv.dataElement][aoco[1]][coco.categoryOptionGroup.id] = coco.displayName;
                                }
                                else{
                                    if( !mappedValues[dv.dataElement][aoco[1]][coco.categoryOptionGroup.id] ){
                                        mappedValues[dv.dataElement][aoco[1]][coco.categoryOptionGroup.id] = [];
                                    }                                        
                                    mappedValues[dv.dataElement][aoco[1]][coco.categoryOptionGroup.id].push( coco.displayName );
                                }
                            }
                        }
                    }
                }
            }
        });
        
        reportData.mappedValues = mappedValues;
        return reportData;
    };
    
    var getCnaReport = function( rawData, reportData, mappedOptionCombosById ){
        angular.forEach(rawData.dataValues, function(dv){
            var aoco = mappedOptionCombosById[dv.attributeOptionCombo];
            if( dv.value === "1" && aoco && aoco.displayName ){
                aoco = aoco.displayName.split(", ");
                if( aoco.length === 2 ){
                    var coco = mappedOptionCombosById[dv.categoryOptionCombo];                                
                    if ( coco && coco.categoryOptionGroup && coco.categoryOptionGroup.id ){                                    
                        if( coco.categoryOptionGroup.actionConducted ){
                            reportData.noDataExists = false;
                            /*if( !reportData.comments[dv.dataElement] ){
                                reportData.comments[dv.dataElement] = {};
                                reportData.comments[dv.dataElement][aoco[0]] = {};
                                reportData.comments[dv.dataElement][aoco[0]][aoco[1]] = {};
                            }
                            else{
                                if( !reportData.comments[dv.dataElement][aoco[0]] ){
                                    reportData.comments[dv.dataElement][aoco[0]] = {};
                                    reportData.comments[dv.dataElement][aoco[0]][aoco[1]] = {};
                                }
                                else{
                                   if( !reportData.comments[dv.dataElement][aoco[0]][aoco[1]] ){                                                    
                                        reportData.comments[dv.dataElement][aoco[0]][aoco[1]] = {};
                                    } 
                                }
                            }                                        
                            reportData.comments[dv.dataElement][aoco[0]][aoco[1]].comment = dv.comment ? $sce.trustAsHtml(dv.comment.replace(/\r?\n/g,'<br />')) : "";*/
                        }
                        else{
                            if( coco.categoryOptionGroup.dimensionEntryMode ){
                                reportData.noDataExists = false;
                                if( coco.categoryOptionGroup.dimensionEntryMode === 'SINGLE'){
                                    reportData.allValues[dv.dataElement][aoco[0]][aoco[1]][coco.categoryOptionGroup.id] = coco.displayName;
                                }
                                else{
                                    if( !reportData.allValues[dv.dataElement][aoco[0]][aoco[1]][coco.categoryOptionGroup.id] ){
                                        reportData.allValues[dv.dataElement][aoco[0]][aoco[1]][coco.categoryOptionGroup.id] = [];
                                    }                                        
                                    reportData.allValues[dv.dataElement][aoco[0]][aoco[1]][coco.categoryOptionGroup.id].push( coco.displayName );
                                }
                            }
                        }                                    
                    }
                }
            }
        });
        return reportData;
    };
    return {        
        getReportData: function(reportParams, reportData, mappedOptionCombosById){            
            var def = $q.defer();            
            reportData.comments = {};
            DataValueService.getDataValueSet( reportParams.url ).then(function( response ){
                reportData.noDataExists = true;
                if( response && response.dataValues && reportData.reportType ){                    
                    if( reportData.reportType.id === 'SUMMARY' || reportData.reportType.id  === 'AGENCY_COMPLETENESS' ){
                        reportData = getSummaryReport( response, reportData, mappedOptionCombosById );
                    }
                    else /*if( reportData.reportType.id === 'CNA' || reportData.reportType.id === 'ALIGNED_INVESTMENT' )*/{
                        reportData = getCnaReport( response, reportData, mappedOptionCombosById );
                    }
                }
                else{                    
                    reportData.showReportFilters = false;
                }  

                reportData.reportReady = true;
                reportData.reportStarted = false;

                def.resolve(reportData);
            });
            return def.promise;
        }
    };
});