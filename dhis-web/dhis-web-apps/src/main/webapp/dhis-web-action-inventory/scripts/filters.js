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
        
        if( st && st.id ){
            actions = $filter('filter')(actions, {supportType: st.id},true);
        }
        
        return actions;         
    };
});