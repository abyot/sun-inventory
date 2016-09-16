/* global angular */

'use strict';

var sunSurvey = angular.module('sunSurvey');

//Controller for settings page
sunSurvey.controller('DataEntryHistoryController',
        function($scope,
                $modalInstance,
                $translate,
                $filter,
                value,
                comment,
                period,
                dataElement,
                orgUnitId,
                attributeCategoryCombo,
                attributeCategoryOptions,
                attributeOptionCombo,
                optionCombo,
                program,
                DataValueService,
                DataValueAuditService) {    
    $scope.commentSaveStarted = false;
    $scope.dataElement = dataElement;
    $scope.program = program;
    $scope.historyUrl = "../api/charts/history/data.png?";
    $scope.historyUrl += 'de=' + dataElement.id;
    $scope.historyUrl += '&co=' + optionCombo.id;
    $scope.historyUrl += '&ou=' + orgUnitId;
    $scope.historyUrl += '&pe=' + period.id;
    $scope.historyUrl += '&cp=' + attributeOptionCombo;
    
    var dataValueAudit = {de: dataElement.id, pe: period.id, ou: orgUnitId, co: optionCombo.id};    
    $scope.dataValue = {de: dataElement.id, pe: period.id, ou: orgUnitId, co: optionCombo.id, value: value, comment: comment};    
    
    if( attributeCategoryCombo && !attributeCategoryCombo.isDefault ){
        dataValueAudit.cc = $scope.model.selectedAttributeCategoryCombo.id;        
        $scope.dataValue.cc = $scope.model.selectedAttributeCategoryCombo.id;
        $scope.dataValue.cp = attributeCategoryOptions;
    }
        
    $scope.auditColumns = [{id: 'created', name: $translate.instant('created')},
                           {id: 'modifiedBy', name: $translate.instant('modified_by')},
                           {id: 'value', name: $translate.instant('value')},
                           {id: 'auditType', name: $translate.instant('audit_type')}];
    
    $scope.dataValueAudits = [];        
    DataValueAuditService.getDataValueAudit( dataValueAudit ).then(function( response ){
        $scope.dataValueAudits = response && response.dataValueAudits ? response.dataValueAudits : [];
        $scope.dataValueAudits = $filter('filter')($scope.dataValueAudits, {period: {id: period.id}});
    });  
    
    $scope.saveComment = function(){
        $scope.commentSaveStarted = true;
        $scope.commentSaved = false;
        DataValueService.saveDataValue( $scope.dataValue ).then(function(response){
           $scope.commentSaved = true;
        }, function(){
            $scope.commentSaved = false;
        });
    };
    
    $scope.getCommentNotifcationClass = function(){
        if( $scope.commentSaveStarted ){
            if($scope.commentSaved){
                return 'form-control input-success';
            }
            else{
                return 'form-control input-error';
            }
        }        
        return 'form-control';
    };
    
    $scope.close = function(status) {        
        $modalInstance.close( status );
    };
});