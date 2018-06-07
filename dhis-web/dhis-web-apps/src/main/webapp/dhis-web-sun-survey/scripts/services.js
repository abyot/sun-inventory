/* global angular, moment, dhis2, parseFloat */

'use strict';

/* Services */

var actionMappingServices = angular.module('actionMappingServices', ['ngResource'])

.factory('PMTStorageService', function(){
    var store = new dhis2.storage.Store({
        name: "dhis2sunSurvey",
        adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
        objectStores: ['dataSets', 'dataElementGroupSets', 'optionSets', 'categoryOptionGroups', 'categoryCombos']
    });
    return{
        currentStore: store
    };
})

/* current selections */
.service('PeriodService', function(DateUtils){
    
    this.getPeriods = function(periodType, periodOffset, futurePeriod){
        periodOffset = angular.isUndefined(periodOffset) ? 0 : periodOffset;
        periodOffset += futurePeriod;
        
        var availablePeriods = [];
        if(!periodType){
            return availablePeriods;
        }        

        var pt = new PeriodType();
        var d2Periods = pt.get(periodType).generatePeriods({offset: periodOffset, filterFuturePeriods: false, reversePeriods: true});
        
        if( !d2Periods || d2Periods.length && d2Periods.length < 1 ){
            return availablePeriods;
        }
        
        var currentPeriod = null, lastPeriod = {};
        for( var i=0; i<d2Periods.length; i++){            
            d2Periods[i].endDate = DateUtils.formatFromApiToUser(d2Periods[i].endDate);
            d2Periods[i].startDate = DateUtils.formatFromApiToUser(d2Periods[i].startDate);
            
            if( moment(DateUtils.getToday()).isAfter(d2Periods[i].endDate) ){                    
                currentPeriod = d2Periods[i];
                break;
            }
        }        
        
        if( currentPeriod ){            
            lastPeriod.startDate = DateUtils.formatFromApiToUser( moment(currentPeriod.startDate).add(futurePeriod, 'years') );
            lastPeriod.endDate = DateUtils.formatFromApiToUser( moment(currentPeriod.endDate).add(futurePeriod, 'years') );
        }
        
        var startingDate = DateUtils.formatFromApiToUser( moment('2016-01-01') );        
            
        angular.forEach(d2Periods, function(p){
            
            p.endDate = DateUtils.formatFromApiToUser(p.endDate);
            p.startDate = DateUtils.formatFromApiToUser(p.startDate);
            
            if( !moment(p.startDate).isAfter(lastPeriod.startDate) &&
                moment(p.endDate).isAfter(startingDate) ){
                availablePeriods.push( p );
            }
        });        
        
        return availablePeriods;
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
        getDataSetsByProperty: function( ou, property, value ){
            var roles = SessionStorageService.get('USER_ROLES');
            var userRoles = roles && roles.userCredentials && roles.userCredentials.userRoles ? roles.userCredentials.userRoles : [];
            
            var def = $q.defer();
            
            PMTStorageService.currentStore.open().done(function(){
                PMTStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];                    
                    angular.forEach(dss, function(ds){
                        if( CommonUtils.userHasValidRole(ds, 'dataSets', userRoles ) && ds.organisationUnits.hasOwnProperty( ou.id ) && ds[property] && ds[property] === value ){                            
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
    var getDataValueSet = function( dv, dataSetId, aocId){
        if( !dv || !dv.pe || !dv.ou || !dv.de || !dv.co || !dataSetId || !aocId){
            return null;
        }
        var dataValueSet = {dataSet: dataSetId,
                        period: dv.pe,
                        orgUnit: dv.ou,
                        dataValues: []};
        dataValueSet.dataValues.push({dataElement: dv.de, categoryOptionCombo: dv.co, attributeOptionCombo: aocId, value: dv.value});
        return dataValueSet;
    };
                              
    return {
        getDataValue: function( dv ){
            var promise = $http.get('../api/dataValues.json?de='+dv.de+'&ou='+dv.ou+'&pe='+dv.pe).then(function(response){
                return response.data;
            });
            return promise;
        },        
        getDataValueSet: function( params ){            
            var promise = $http.get('../api/dataValueSets.json?' + params ).then(function(response){               
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });            
            return promise;
        },
        saveDataValue: function( dv, oldValues, dataElement, optionCombos, dataSetId, aocId ){
            var url = '?de='+dv.de + '&ou='+dv.ou + '&pe='+dv.pe + '&co='+dv.co + '&value='+dv.value;
            var promise;
            if( dv.cc && dv.cp ){
                url += '&cc='+dv.cc + '&cp='+dv.cp;
            }            
            if( dv.comment ){
                url += '&comment=' + dv.comment; 
            }
            
            if( dv.value === '' || dv.value === null ){
                if( oldValues[dv.de] ){
                    if( dataElement ){
                        if( dataElement.displayMode === 'TABULAR' ){                            
                            var oco = optionCombos[dv.co];
                        }
                        else{
                            if( dataElement.dimensionAsMultiOptionSet && oldValues[dv.dataElement].length ){
                                var deleteMe = false;
                                for( var i=0; i<oldValues[dv.de].length && !deleteMe; i++ ){
                                    if( oldValues[dv.de][i].id === dv.co ){
                                        deleteMe = true;
                                    }
                                }                                
                                if( deleteMe ){
                                    promise = $http.delete('../api/dataValues.json' + url).then(function(){
                                        return [{de: dv.de, co: dv.co, dm: 'MULTIOPTIONSET'}];
                                    });
                                }
                            }
                            else{
                                if( !dataElement.dimensionAsOptionSet ){
                                    if( oldValues[dv.de][dv.co] ){
                                        promise = $http.delete('../api/dataValues.json' + url).then(function(){
                                            return [{de: dv.de, co: dv.co, dm: 'DEFAULT'}];
                                        });
                                    }
                                }
                                else{
                                    promise = $http.delete('../api/dataValues.json' + url).then(function(){
                                        return [{de: dv.de, co: dv.co, dm: 'OPTIONSET'}];
                                    });
                                }
                            }
                        }
                    }
                }
                else{                    
                    promise = $q.when(function(){
                        return []; 
                    });
                }
            }            
            else{
                var dataValueSet = getDataValueSet( dv, dataSetId, aocId );                
                promise = $http.post('../api/dataValueSets.json', dataValueSet).then(function(){
                    return [];
                });
            }            
            return promise;
        },        
        saveDataValueSet: function(dvs, oldValues, dataElement, optionCombos){
            var def = $q.defer();            
            var promises = [], toBeSaved = [], removed = [];
            angular.forEach(dvs.dataValues, function(dv){
                var oco = optionCombos[dv.categoryOptionCombo];
                if( dv.value === '' || dv.value === null ){                    
                    if( oldValues[dv.dataElement] ){
                        if( dataElement ){
                            if( dataElement.displayMode === 'TABULAR' ){
                                if( oldValues[dv.dataElement][oco.categoryOptionGroup.id] && oldValues[dv.dataElement][oco.categoryOptionGroup.id].length ){
                                    var deleteMe = false;
                                    for( var i=0; i<oldValues[dv.dataElement][oco.categoryOptionGroup.id].length && !deleteMe; i++ ){
                                        if( oldValues[dv.dataElement][oco.categoryOptionGroup.id][i].id === dv.categoryOptionCombo ){
                                            deleteMe = true;
                                        }
                                    }
                                    if( deleteMe ){
                                        var url = '?de='+dv.dataElement + '&ou='+dvs.orgUnit + '&pe='+dvs.period + '&co='+dv.categoryOptionCombo;
                                        removed.push( {de: dv.dataElement, co: dv.categoryOptionCombo, dm: 'TABULAR'} );
                                        promises.push( $http.delete('../api/dataValues.json' + url) );
                                    }
                                }
                            }
                            else{                                
                                if( dataElement.dimensionAsMultiOptionSet && oldValues[dv.dataElement].length ){
                                    var deleteMe = false;
                                    for( var i=0; i<oldValues[dv.dataElement].length && !deleteMe; i++ ){
                                        if( oldValues[dv.dataElement][i].id === dv.categoryOptionCombo ){
                                            deleteMe = true;
                                        }
                                    }                                
                                    if( deleteMe ){
                                        var url = '?de='+dv.dataElement + '&ou='+dvs.orgUnit + '&pe='+dvs.period + '&co='+dv.categoryOptionCombo;
                                        removed.push( {de: dv.dataElement, co: dv.categoryOptionCombo, dm: 'MULTIOPTIONSET'} );
                                        promises.push( $http.delete('../api/dataValues.json' + url) );
                                    }
                                }
                                else{
                                    if( !dataElement.dimensionAsOptionSet ){
                                        if( oldValues[dv.dataElement][dv.categoryOptionCombo] ){
                                            var url = '?de='+dv.dataElement + '&ou='+dvs.orgUnit + '&pe='+dvs.period + '&co='+dv.categoryOptionCombo;
                                            removed.push( {de: dv.dataElement, co: dv.categoryOptionCombo, dm: 'DEFAULT'} );
                                            promises.push( $http.delete('../api/dataValues.json' + url) );
                                        }
                                    }
                                    else{
                                        var url = '?de='+dv.dataElement + '&ou='+dvs.orgUnit + '&pe='+dvs.period + '&co='+dv.categoryOptionCombo;
                                        removed.push( {de: dv.dataElement, co: dv.categoryOptionCombo, dm: 'OPTIONSET'} );
                                        promises.push( $http.delete('../api/dataValues.json' + url) );
                                    }
                                }
                            }
                        }
                    }
                }
                else{                    
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
            var url = 'ds='+ ds + '&pe=' + pe + '&ou=' + ou;            
            if( cc && cp ){
                url += '&cc=' + cc + '&cp=' + cp;
            }
            
            var promise = $http.delete( '../api/completeDataSetRegistrations?' + url + '&multiOu=' + multiOu ).then(function(response){
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });
            return promise;
        }
    };
})

.service('DataValueAuditService', function($http, ActionMappingUtils) {   
    
    return {        
        getDataValueAudit: function( dv ){
            
            var url = 'de='+dv.de + '&ou='+dv.ou + '&pe='+dv.pe + '&co='+dv.co;
            
            if( dv.cc ){
                url += '&cc='+dv.cc;
            }            
            
            var promise = $http.get( '../api/audits/dataValue.json?' + url ).then(function(response){
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

.service('StakeholderService', function($http, ActionMappingUtils) {   
    
    return {        
        addCategoryOption: function( categoryOption ){
            var promise = $http.post('../api/categoryOptions.json' , categoryOption ).then(function(response){
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });
            return promise;
        },
        updateCategory: function( category ){
            var promise = $http.put('../api/categories/' + category.id + '.json&mergeMode=MERGE', category ).then(function(response){
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });
            return promise;
        },
        getCategoryCombo: function(uid){
            var url = '../api/categoryCombos/' + uid + '.json?fields=id,displayName,code,skipTotal,isDefault,categoryOptionCombos[id,displayName],categories[id,name,displayName,shortName,dimension,dataDimensionType,categoryOptions[id,name,displayName,code]]';
            var promise = $http.get( encodeURI(url) ).then(function(response){
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });
            return promise;
        },
        addOption: function( opt ){
            var promise = $http.post('../api/options.json' , opt ).then(function(response){
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });
            return promise;
        },
        updateOptionSet: function( optionSet ){
            var promise = $http.put('../api/optionSets/' + optionSet.id + '.json&mergeMode=MERGE', optionSet ).then(function(response){
                return response.data;
            }, function(response){
                ActionMappingUtils.errorNotifier(response);
            });
            return promise;
        },
        getOptionSet: function( uid ){
            var url = '../api/optionSets/' + uid + '.json?paging=false&fields=id,name,displayName,version,attributeValues[value,attribute[id,name,code]],options[id,name,displayName,code]';
            var promise = $http.get( encodeURI(url) ).then(function(response){
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
            headers.push({id: 'catalyst', name: $translate.instant('catalyst')});
            headers.push({id: 'funder', name: $translate.instant('funder')});
            headers.push({id: 'responsibleMinistry', name: $translate.instant('responsible_ministry')});
            
            return headers;
        },
        getOptionComboIdFromOptionNames: function(optionComboMap, options, categoryCombo){            
            if( categoryCombo && categoryCombo.isDefault ){
                return categoryCombo.categoryOptionCombos[0].id;
            }            
            
            var optionNames = [];
            angular.forEach(options, function(op){
                optionNames.push(op.displayName.trim());
            });
            
            var selectedOptionComboName = optionNames.join();
            
            var selectedAttributeOptionCombo = optionComboMap[selectedOptionComboName];
            
            if( !selectedAttributeOptionCombo || angular.isUndefined( selectedAttributeOptionCombo ) ){
                selectedOptionComboName = optionNames.reverse().join();
                selectedAttributeOptionCombo = optionComboMap[selectedOptionComboName];
            }
            
            if( !selectedAttributeOptionCombo || !selectedAttributeOptionCombo.id ){
                console.log('ERROR: Missing category option combo !');
                return null;
            }
            return selectedAttributeOptionCombo.id;
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
        getNumeratorAndDenominatorIds: function( ind ){            
            var num = ind.numerator.substring(2,ind.numerator.length-1);
            num = num.split('.');            
            var den = ind.denominator.substring(2,ind.numerator.length-1);
            den = den.split('.');            
            return {numerator: num[0], numeratorOptionCombo: num[1], denominator: den[0], denominatorOptionCombo: den[1]};
        },
        getStakeholderCategoryFromDataSet: function(dataSet, availableCombos, existingCategories, categoryIds){
            if( dataSet.categoryCombo && dataSet.categoryCombo.id){
                var cc = availableCombos[dataSet.categoryCombo.id];
                if( cc && cc.categories ){
                    angular.forEach(cc.categories, function(c){
                        if( c.displayName === 'Field Implementer' && categoryIds.indexOf( c.id )){
                            existingCategories.push( c );
                            categoryIds.push( c.id );
                        }
                    });
                }
            }
            return {categories: existingCategories, categoryIds: categoryIds};
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
            var ouModes = [{name: $translate.instant('selected_level') , value: 'SELECTED', level: orgUnit.l}];
            var limit = orgUnit.l === 1 ? 2 : 3;
            for( var i=orgUnit.l+1; i<=limit; i++ ){
                var lvl = ouLevels[i];
                ouModes.push({value: lvl, name: lvl + ' ' + $translate.instant('level'), level: i});
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
        cartesianProduct: function(){
            return _.reduce(arguments, function(a, b) {
                return _.flatten(_.map(a, function(x) {
                    return _.map(b, function(y) {
                        return x.concat([y]);
                    });
                }), true);
            }, [ [] ]);
        }
    };
})

/*Orgunit service for local db */
.service('IndexDBService', function($window, $q){
    
    var indexedDB = $window.indexedDB;
    var db = null;
    
    var open = function( dbName ){
        var deferred = $q.defer();
        
        var request = indexedDB.open( dbName );
        
        request.onsuccess = function(e) {
          db = e.target.result;
          deferred.resolve();
        };

        request.onerror = function(){
          deferred.reject();
        };

        return deferred.promise;
    };
    
    var get = function(storeName, uid){
        
        var deferred = $q.defer();
        
        if( db === null){
            deferred.reject("DB not opened");
        }
        else{
            var tx = db.transaction([storeName]);
            var store = tx.objectStore(storeName);
            var query = store.get(uid);
                
            query.onsuccess = function(e){
                deferred.resolve(e.target.result);           
            };
        }
        return deferred.promise;
    };
    
    return {
        open: open,
        get: get
    };
});