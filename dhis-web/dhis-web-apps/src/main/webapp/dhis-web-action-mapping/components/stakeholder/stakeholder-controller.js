/* global angular */

'use strict';

var sunPMT = angular.module('sunPMT');

//Controller for settings page
sunPMT.controller('StakeholderController',
        function($scope,
                $modalInstance,
                categoryCombo,
                category,
                optionSet,
                MetaDataFactory,
                StakeholderService) {            
    
    $scope.stakeholderAdded = false;
    $scope.stakeholderAddStarted = false;
    $scope.model = {newStakeholder:{}};
    $scope.categoryCombo = categoryCombo;
    $scope.category = category;
    $scope.optionSet = optionSet;
    
    $scope.interacted = function(field) {        
        var status = false;
        if(field){            
            status = $scope.stakeholderForm.submitted || field.$dirty;
        }
        return status;        
    };
    
    $scope.addStakeholder = function(){
        
        //check for form validity
        $scope.stakeholderForm.submitted = true;        
        if( $scope.stakeholderForm.$invalid ){
            return false;
        }       
       
        $scope.stakeholderAddStarted = true;
        
        //form is valid
        //add category option
        $scope.model.newStakeholder.code = $scope.model.newStakeholder.shortName;
        StakeholderService.addCategoryOption( $scope.model.newStakeholder ).then(function( json ){
            
            if( json && json.response && json.response.lastImported ){
                var cat = angular.copy($scope.category);
                cat.categoryOptions = [];
                delete cat.selectedOption;
                
                angular.forEach($scope.category.categoryOptions, function(o){
                    if( o.id !== 'ADD_NEW_OPTION' ){
                        cat.categoryOptions.push( o );
                    }
                });
                cat.categoryOptions.push( {id: json.response.lastImported, name: $scope.model.newStakeholder.name, code: $scope.model.newStakeholder.code} );
                                
                //update category
                StakeholderService.updateCategory( cat ).then(function(){
                    
                    angular.forEach($scope.categoryCombo.categorories, function(c){
                        if( c.id === category.id ){
                            c = cat;
                        }
                    });
                    
                    StakeholderService.getCategoryCombo( $scope.categoryCombo.id ).then(function( response ){
                        
                        if( response && response.id ){
                            MetaDataFactory.set('categoryCombos', response).then(function(){
                                //add option
                                var opt = {name: $scope.model.newStakeholder.name, code: $scope.model.newStakeholder.code};
                                StakeholderService.addOption( opt ).then(function( jsn ){

                                    if( jsn && jsn.response && jsn.response.lastImported ){
                                        //update option set
                                        var os = angular.copy($scope.optionSet);
                                        
                                        if( os && os.organisationUnits ){
                                            delete os.organisationUnits;
                                        }                                        
                                        os.options.push( {id: jsn.response.lastImported, name: $scope.model.newStakeholder.name} );
                                        StakeholderService.updateOptionSet( os ).then(function(){                                            
                                            StakeholderService.getOptionSet( os.id ).then(function( response ){
                                                
                                                if( response && response.id ){        
                                                    var oss = dhis2.metadata.processMetaDataAttribute( response );
                                                    MetaDataFactory.set('optionSets', oss).then(function(){
                                                        $scope.stakeholderAdded = true;
                                                        $scope.close(true);
                                                    });
                                                }
                                            });                            
                                        });
                                    }
                                });
                            });
                        }                        
                    });                                        
                });
            }            
        });
    };
    
    $scope.close = function(status) {        
        $modalInstance.close( status );
    };
});