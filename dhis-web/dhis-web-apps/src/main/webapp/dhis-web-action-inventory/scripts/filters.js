'use strict';

/* Filters */

var actionMappingFilters = angular.module('actionMappingFilters', [])

.filter('thematicAreaFilter', function( $filter ){    
    
    return function(thematicAreas, degs, ta, ac){
        
        if(!thematicAreas ){
            return;
        }
        
        if( degs && degs.displayName ){
            thematicAreas = $filter('filter')(thematicAreas, {category: degs.displayName}, true);
        }
        
        return thematicAreas;         
    };
})

.filter('supportTypeFilter', function( $filter ){    
    
    return function(supportTypes, degs, ta, ac){
        
        if(!supportTypes ){
            return;
        }
        
        if( degs && degs.displayName ){
            supportTypes = $filter('filter')(supportTypes, {category: degs.displayName},true);
        }
        
        if( ta && ta.displayName ){
            supportTypes = $filter('filter')(supportTypes, {thematicArea: ta.displayName},true);
        }
        
        return supportTypes;
    };
})

.filter('actionFilter', function( $filter ){    
    
    return function(actions, degs, ta, st){
        
        if(!actions ){
            return;
        }
        
        if( degs && degs.displayName ){
            actions = $filter('filter')(actions, {category: degs.displayName},true);
        }
        
        if( ta && ta.displayName ){
            actions = $filter('filter')(actions, {thematicArea: ta.displayName},true);
        }
        
        if( st && st.displayName ){
            actions = $filter('filter')(actions, {supportType: st.displayName},true);
        }
        
        return actions;         
    };
})

.filter('agencyInstanceOptionFilter', function(){
    
    return function( cos, ou ){
        
        var _cos = [];
        
        if( cos && ou && ou.id ){
            
            angular.forEach(cos, function(co){                
                if( co.mappedOrganisationUnits && co.mappedOrganisationUnits.length > 0 ){                    
                    if( co.mappedOrganisationUnits.indexOf( ou.id ) !== -1){
                        _cos.push( co );
                    }
                }
                else{
                    _cos.push( co );
                }
            });          
        }
        else{
            _cos = cos;
        }
        
        return _cos;
    };
})

.filter('dimensionOptionFilter', function(){
    
    return function( cocs, ou ){
        
        var _cocs = [];
        
        if( cocs && ou && ou.id ){
            
            angular.forEach(cocs, function(coc){                
                if( coc.categoryOptions && 
                        coc.categoryOptions.length === 1 && 
                        coc.categoryOptions[0].mappedOrganisationUnits &&
                        coc.categoryOptions[0].mappedOrganisationUnits.length > 0){
                    if( coc.categoryOptions[0].mappedOrganisationUnits.indexOf( ou.id ) !== -1){
                        _cocs.push( coc );
                    }
                }
                else{
                    _cocs.push( coc );
                }
            });          
        }
        else{
            _cocs = cocs;
        }
        
        return _cocs;
    };
});