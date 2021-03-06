/* global dhis2, angular, selection, i18n_ajax_login_failed, _ */

dhis2.util.namespace('dhis2.sunpmt');
dhis2.util.namespace('dhis2.tc');

// whether current user has any organisation units
dhis2.sunpmt.emptyOrganisationUnits = false;

var i18n_no_orgunits = 'No organisation unit attached to current user, no data entry possible';
var i18n_offline_notification = 'You are offline';
var i18n_online_notification = 'You are online';
var i18n_ajax_login_failed = 'Login failed, check your username and password and try again';

var optionSetsInPromise = [];
var attributesInPromise = [];
var batchSize = 50;

dhis2.sunpmt.store = null;
dhis2.tc.metaDataCached = dhis2.sunpmt.metaDataCached || false;
dhis2.sunpmt.memoryOnly = $('html').hasClass('ie7') || $('html').hasClass('ie8');
var adapters = [];    
if( dhis2.sunpmt.memoryOnly ) {
    adapters = [ dhis2.storage.InMemoryAdapter ];
} else {
    adapters = [ dhis2.storage.IndexedDBAdapter, dhis2.storage.DomLocalStorageAdapter, dhis2.storage.InMemoryAdapter ];
}

dhis2.sunpmt.store = new dhis2.storage.Store({
    name: 'dhis2suninventory',
    adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
    objectStores: ['dataSets', 'dataElementGroupSets', 'optionSets', 'categoryCombos', 'categoryOptionGroups', 'programs', 'ouLevels', 'indicatorGroups']
});

(function($) {
    $.safeEach = function(arr, fn)
    {
        if (arr)
        {
            $.each(arr, fn);
        }
    };
})(jQuery);

/**
 * Page init. The order of events is:
 *
 * 1. Load ouwt 
 * 2. Load meta-data (and notify ouwt) 
 * 
 */
$(document).ready(function()
{
    $.ajaxSetup({
        type: 'POST',
        cache: false
    });

    $('#loaderSpan').show();
});

$(document).bind('dhis2.online', function(event, loggedIn)
{
    if (loggedIn)
    {
        if (dhis2.sunpmt.emptyOrganisationUnits) {
            setHeaderMessage(i18n_no_orgunits);
        }
        else {
            setHeaderDelayMessage(i18n_online_notification);
        }
    }
    else
    {
        var form = [
            '<form style="display:inline;">',
            '<label for="username">Username</label>',
            '<input name="username" id="username" type="text" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<label for="password">Password</label>',
            '<input name="password" id="password" type="password" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<button id="login_button" type="button">Login</button>',
            '</form>'
        ].join('');

        setHeaderMessage(form);
        ajax_login();
    }
});

$(document).bind('dhis2.offline', function()
{
    if (dhis2.sunpmt.emptyOrganisationUnits) {
        setHeaderMessage(i18n_no_orgunits);
    }
    else {
        setHeaderMessage(i18n_offline_notification);
    }
});

function ajax_login()
{
    $('#login_button').bind('click', function()
    {
        var username = $('#username').val();
        var password = $('#password').val();

        $.post('../dhis-web-commons-security/login.action', {
            'j_username': username,
            'j_password': password
        }).success(function()
        {
            var ret = dhis2.availability.syncCheckAvailability();

            if (!ret)
            {
                alert(i18n_ajax_login_failed);
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Metadata downloading
// -----------------------------------------------------------------------------

function downloadMetaData()
{
    console.log('Downloading required meta-data');
    
    return dhis2.sunpmt.store.open()
            .then( getUserRoles )
            .then( getOrgUnitLevels )
            .then( getOrgUnitLevels )
            .then( getSystemSetting )
            .then( getCalendarSetting )
    
            .then( getMetaCategoryCombos )
            .then( filterMissingCategoryCombos )
            .then( getCategoryCombos )
    
            .then( getMetaCategoryOptionGroups )
            .then( filterMissingCategoryOptionGroups )
            .then( getCategoryOptionGroups )
    
            .then( getMetaDataSets )
            .then( filterMissingDataSets )
            .then( getDataSets )
    
            .then( getMetaDataElementGroupSets )
            .then( filterMissingDataElementGroupSets )
            .then( getDataElementGroupSets )
    
            .then( getMetaOptionSets )
            .then( filterMissingOptionSets )
            .then( getOptionSets );
}
function getUserRoles(){
    var SessionStorageService = angular.element('body').injector().get('SessionStorageService');    
    if( SessionStorageService.get('USER_ROLES') ){
       return; 
    }    
    return dhis2.metadata.getMetaObject(null, 'USER_ROLES', '../api/me.json', 'fields=id,displayName,userCredentials[userRoles[id,authorities,dataSets]]', 'sessionStorage', dhis2.sunpmt.store);
}

function getOrgUnitLevels()
{
    dhis2.sunpmt.store.getKeys( 'ouLevels').done(function(res){
        if(res.length > 0){
            return;
        }        
        return dhis2.metadata.getMetaObjects('ouLevels', 'organisationUnitLevels', '../api/organisationUnitLevels.json', 'fields=id,displayName,level&paging=false', 'idb', dhis2.sunpmt.store);
    });
}

function getSystemSetting(){   
    if(localStorage['SYSTEM_SETTING']){
       return; 
    }    
    return dhis2.metadata.getMetaObject(null, 'SYSTEM_SETTING', '../api/systemSettings', '', 'localStorage', dhis2.sunpmt.store);
}

function getCalendarSetting(){   
    if(localStorage['CALENDAR_SETTING']){
       return; 
    }    
    return dhis2.metadata.getMetaObject(null, 'CALENDAR_SETTING', '../api/systemSettings', 'key=keyCalendar&key=keyDateFormat', 'localStorage', dhis2.sunpmt.store);
}

function getMetaCategoryCombos(){
    return dhis2.metadata.getMetaObjectIds('categoryCombos', '../api/categoryCombos.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryCombos( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryCombos', dhis2.sunpmt.store, objs);
}

function getCategoryCombos( ids ){    
    return dhis2.metadata.getBatches( ids, batchSize, 'categoryCombos', 'categoryCombos', '../api/categoryCombos.json', 'paging=false&fields=id,displayName,code,skipTotal,isDefault,categoryOptionCombos[id,displayName,categoryOptions[id,organisationUnits[id]]],categories[id,code,displayName,shortName,dimension,dataDimensionType,attributeValues[value,attribute[id,displayName,valueType,code]],categoryOptions[id,displayName,code,organisationUnits[id]]]', 'idb', dhis2.sunpmt.store);
}

function getMetaCategoryOptionGroups(){
    return dhis2.metadata.getMetaObjectIds('categoryOptionGroups', '../api/categoryOptionGroups.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryOptionGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryOptionGroups', dhis2.sunpmt.store, objs);
}

function getCategoryOptionGroups( ids ){    
    return dhis2.metadata.getBatches( ids, batchSize, 'categoryOptionGroups', 'categoryOptionGroups', '../api/categoryOptionGroups.json', 'paging=false&fields=id,displayName,code,shortName,attributeValues[value,attribute[id,displayName,code,valueType]],categoryOptions[id,displayName,code]', 'idb', dhis2.sunpmt.store);
}

function getMetaDataSets(){
    return dhis2.metadata.getMetaObjectIds('dataSets', '../api/dataSets.json', 'paging=false&fields=id,version');
}

function filterMissingDataSets( objs ){
    return dhis2.metadata.filterMissingObjIds('dataSets', dhis2.sunpmt.store, objs);
}

function getDataSets( ids ){    
    return dhis2.metadata.getBatches( ids, batchSize, 'dataSets', 'dataSets', '../api/dataSets.json', 'paging=false&fields=id,code,periodType,openFuturePeriods,displayName,version,categoryCombo[id],attributeValues[value,attribute[id,displayName,valueType,code]],organisationUnits[id,displayName],dataSetElements[id,dataElement[id,code,displayName,description,attributeValues[value,attribute[id,displayName,valueType,code]],description,formName,valueType,optionSetValue,optionSet[id],categoryCombo[id,isDefault,categories[id]]]]', 'idb', dhis2.sunpmt.store, dhis2.metadata.processObject);
}

function getMetaDataElementGroupSets(){
    return dhis2.metadata.getMetaObjectIds('dataElementGroupSets', '../api/dataElementGroupSets.json', 'paging=false&filter=dataDimension:eq:false&fields=id,version');
}

function filterMissingDataElementGroupSets( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElementGroupSets', dhis2.sunpmt.store, objs);
}

function getDataElementGroupSets( ids ){    
    return dhis2.metadata.getBatches( ids, batchSize, 'dataElementGroupSets', 'dataElementGroupSets', '../api/dataElementGroupSets.json', 'paging=false&filter=dataDimension:eq:false&fields=id,displayName,dataElementGroups[id,displayName,attributeValues[value,attribute[id,displayName,valueType,code]],dataElements[id]]', 'idb', dhis2.sunpmt.store, dhis2.metadata.processObject);
}

function getMetaOptionSets(){
    return dhis2.metadata.getMetaObjectIds('optionSets', '../api/optionSets.json', 'paging=false&fields=id,version');
}

function filterMissingOptionSets( objs ){
    return dhis2.metadata.filterMissingObjIds('optionSets', dhis2.sunpmt.store, objs);
}

function getOptionSets( ids ){    
    return dhis2.metadata.getBatches( ids, batchSize, 'optionSets', 'optionSets', '../api/optionSets.json', 'paging=false&fields=id,code,displayName,version,attributeValues[value,attribute[id,displayName,valueType,code]],options[id,displayName,code]', 'idb', dhis2.sunpmt.store, dhis2.metadata.processObject);
}

function getMetaPrograms(){
    return dhis2.metadata.getMetaObjectIds('programs', '../api/programs.json', 'filter=programType:eq:WITHOUT_REGISTRATION&paging=false&fields=id,version');
}

function filterMissingPrograms( objs ){
    return dhis2.metadata.filterMissingObjIds('programs', dhis2.sunpmt.store, objs);
}

function getPrograms( ids ){    
    return dhis2.metadata.getBatches( ids, batchSize, 'programs', 'programs', '../api/programs.json', 'paging=false&fields=id,displayName,attributeValues[value,attribute[id,displayName,valueType,code]],categoryCombo[id],organisationUnits[id,displayName],programStages[id,displayName,programStageDataElements[*,dataElement[*,optionSet[id]]]]', 'idb', dhis2.sunpmt.store, dhis2.metadata.processObject);
}

function getMetaIndicatorGroups(){
    return dhis2.metadata.getMetaObjectIds('indicatorGroups', '../api/indicatorGroups.json', 'paging=false&fields=id,version');
}

function filterMissingIndicatorGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('indicatorGroups', dhis2.sunpmt.store, objs);
}

function getIndicatorGroups( ids ){    
    return dhis2.metadata.getBatches( ids, batchSize, 'indicatorGroups', 'indicatorGroups', '../api/indicatorGroups.json', 'paging=false&fields=id,displayName,attributeValues[value,attribute[id,displayName,valueType,code]],indicators[id,displayName,denominatorDescription,numeratorDescription,dimensionItem,numerator,denominator,annualized,dimensionType,indicatorType[id,displayName,factor,number]]', 'idb', dhis2.sunpmt.store, dhis2.metadata.processObject);
}