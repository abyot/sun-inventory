'use strict';

/* Filters */

var actionMappingFilters = angular.module('actionMappingFilters', [])

.filter('thematicAreaFilter', function( $filter ){    
    
    return function(actions, degs){
        
        if(!actions ){
            return;
        }
        
        var filteredActions = actions;
        if( degs && degs.displayName ){
            filteredActions = $filter('filter')(filteredActions, {category: degs.displayName});
        }
        
        return filteredActions;         
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
        
        if( st && st.id ){
            actions = $filter('filter')(actions, {supportType: st.id},true);
        }
        
        return actions;         
    };
});