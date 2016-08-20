package org.hisp.dhis.predictor;

/*
 * Copyright (c) 2004-2016, University of Oslo
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 * Neither the name of the HISP project nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.hisp.dhis.common.BaseDimensionalItemObject;
import org.hisp.dhis.common.ListMap;
import org.hisp.dhis.common.MapMap;
import org.hisp.dhis.constant.ConstantService;
import org.hisp.dhis.dataelement.DataElement;
import org.hisp.dhis.dataelement.DataElementCategoryService;
import org.hisp.dhis.dataelement.DataElementOperand;
import org.hisp.dhis.datavalue.DataValue;
import org.hisp.dhis.datavalue.DataValueService;
import org.hisp.dhis.expression.Expression;
import org.hisp.dhis.expression.ExpressionService;
import org.hisp.dhis.i18n.I18nService;
import org.hisp.dhis.organisationunit.OrganisationUnit;
import org.hisp.dhis.organisationunit.OrganisationUnitService;
import org.hisp.dhis.period.Period;
import org.hisp.dhis.period.PeriodType;
import org.springframework.beans.factory.annotation.Autowired;

import com.google.common.collect.Lists;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.hisp.dhis.i18n.I18nUtils.i18n;

/**
 * Created by haase on 6/12/16.
 */
public class DefaultPredictorService
    implements PredictorService
{
    private static final Log log = LogFactory.getLog( DefaultPredictorService.class );

    @Autowired
    private PredictorStore predictorStore;
    
    @Autowired
    private I18nService i18nService;

    @Autowired
    private ConstantService constantService;

    @Autowired
    private ExpressionService expressionService;

    @Autowired
    private DataValueService dataValueService;

    @Autowired
    private DataElementCategoryService categoryService;

    @Autowired
    private OrganisationUnitService organisationUnitService;

    // -------------------------------------------------------------------------
    // Predictor
    // -------------------------------------------------------------------------

    @Override
    public int addPredictor( Predictor predictor )
    {
        return predictorStore.save( predictor );
    }

    @Override
    public void updatePredictor( Predictor predictor )
    {
        predictorStore.update( predictor );
    }

    @Override
    public void deletePredictor( Predictor predictor )
    {
        predictorStore.delete( predictor );
    }

    @Override
    public Predictor getPredictor( int id )
    {
        return i18n( i18nService, predictorStore.get( id ) );
    }

    @Override
    public Predictor getPredictor( String uid )
    {
        return i18n( i18nService, predictorStore.getByUid( uid ) );
    }

    @Override
    public List<Predictor> getAllPredictors()
    {
        return i18n( i18nService, predictorStore.getAll() );
    }

    @Override
    public List<Predictor> getPredictorsByUid( Collection<String> uids )
    {
        return i18n( i18nService, predictorStore.getByUid( uids ) );
    }

    @Override
    public List<Predictor> getPredictorsByName( String name )
    {
        return new ArrayList<>( i18n( i18nService, predictorStore.getAllEqName( name ) ) );
    }

    @Override
    public int getPredictorCount()
    {
        return predictorStore.getCount();
    }

    private Set<BaseDimensionalItemObject> getExpressionInputs( String expr_string )
    {
        return expressionService.getDataInputsInExpression( expr_string );
    }

    @Override
    public Collection<DataValue> getPredictions( Predictor p, Date start, Date end )
    {
        // Is end inclusive or exclusive? And what if end is in the middle of a
        // period? Does the period get included?
        List<DataValue> results = new ArrayList<DataValue>();
        Expression generator = p.getGenerator();
        Expression skipTest = p.getSampleSkipTest();
        DataElement output = p.getOutput();
        Set<BaseDimensionalItemObject> datarefs = getExpressionInputs( generator.getExpression() );
        Set<BaseDimensionalItemObject> skiprefs = (skipTest == null) ? (null)
            : getExpressionInputs( skipTest.getExpression() );
        Set<BaseDimensionalItemObject> samplerefs = new HashSet<BaseDimensionalItemObject>();
        Set<String> aggregates = expressionService.getAggregatesInExpression( generator.getExpression() );
        Map<String, Double> constantMap = constantService.getConstantMap();

        ListMap<Period, Period> periodMaps = getSamplePeriods( p.getPeriodType(), start, end,
            p.getSequentialSkipCount(), p.getSequentialSampleCount(), p.getAnnualSampleCount() );

        List<OrganisationUnit> sources = new ArrayList<OrganisationUnit>();
        for ( Integer level : p.getOrganisationUnitLevels() )
            sources.addAll( organisationUnitService.getOrganisationUnitsAtLevel( level ) );

        Set<Period> base_periods = periodMaps.keySet();
        Set<Period> sample_periods = periodMaps.uniqueValues();

        for ( String aggregate : aggregates )
        {
            samplerefs.addAll( expressionService.getDataInputsInExpression( aggregate ) );
        }

        for ( OrganisationUnit source : sources )
        {
            MapMap<OrganisationUnit, Period, MapMap<Integer, BaseDimensionalItemObject, Double>> valueMaps = getDataValues(
                datarefs, sourceList( source ), base_periods );
            Map<Period, MapMap<Integer, BaseDimensionalItemObject, Double>> skipdata = (skipTest == null) ? (null)
                : getDataValues( skiprefs, sourceList( source ), sample_periods ).get( source );

            for ( Period period : base_periods )
            {
                MapMap<Integer, BaseDimensionalItemObject, Double> valueMap = valueMaps.getValue( source, period );
                Map<Integer, ListMap<String, Double>> sampleMap = getSampleMaps( aggregates, samplerefs, source,
                    periodMaps.get( period ), skipTest, skipdata, constantMap );

                if ( valueMap != null )
                {
                    for ( Integer aoc : valueMap.keySet() )
                    {
                        Map<? extends BaseDimensionalItemObject, Double> bindings = valueMap.get( aoc );
                        Double value = null;
                        
                        if ( sampleMap == null )
                        {
                            value = expressionService.getExpressionValue( generator, bindings, constantMap, null, 0, null );
                        }
                        else
                        {
                            value = expressionService.getExpressionValue( generator, bindings, constantMap, null, 0, null, sampleMap.get( aoc ) );
                        }

                        if ( ( value != null ) && ( !( value.isNaN() ) ) && ( !( ( value.isInfinite() ) ) ) )
                        {
                            DataValue dv = new DataValue( output, period, source,
                                categoryService.getDefaultDataElementCategoryOptionCombo(),
                                categoryService.getDataElementCategoryOptionCombo( aoc ) );
                            
                            dv.setValue( value.toString() );
                            results.add( dv );
                        }
                    }
                }
            }
        }

        return results;
    }

    private Map<Integer, ListMap<String, Double>> getSampleMaps( Collection<String> aggregate_exprs,
        Set<BaseDimensionalItemObject> samplerefs, OrganisationUnit source, Collection<Period> periods,
        Expression skipTest, Map<Period, MapMap<Integer, BaseDimensionalItemObject, Double>> skipdata,
        Map<String, Double> constantMap )
    {
        Map<Integer, ListMap<String, Double>> result = new HashMap<Integer, ListMap<String, Double>>();
        
        MapMap<OrganisationUnit, Period, MapMap<Integer, BaseDimensionalItemObject, Double>> dataMaps = getDataValues(
            samplerefs, sourceList( source ), periods );
        
        Map<Period, MapMap<Integer, BaseDimensionalItemObject, Double>> dataMap = dataMaps.get( source );

        if ( dataMap != null )
        {
            if ( skipTest != null )
            {
                for ( Period period : periods )
                {
                    MapMap<Integer, BaseDimensionalItemObject, Double> period_data = skipdata.get( period );
                    
                    if ( period_data != null )
                    {
                        for ( Integer aoc : period_data.keySet() )
                        {
                            Map<BaseDimensionalItemObject, Double> bindings = period_data.get( aoc );
                            Double test_value = expressionService.getExpressionValue( skipTest, bindings, constantMap, null, 0 );
                            
                            log.info( "skipTest " + skipTest.getExpression() + " yielded " + test_value );
                            
                            if ( ( test_value != null ) && ( !( test_value.equals( 0 ) ) ) )
                            {
                                MapMap<Integer, BaseDimensionalItemObject, Double> inperiod = dataMap.get( period );
                                log.info( "Removing sample for aoc=" + aoc + " at " + period + " from " + source );
                                inperiod.remove( aoc );
                            }
                        }
                    }
                }
            }
            
            for ( String aggregate : aggregate_exprs )
            {
                Expression exp = new Expression( aggregate, "aggregated",
                    expressionService.getDataElementsInExpression( aggregate ) );
                
                for ( Period period : periods )
                {
                    MapMap<Integer, BaseDimensionalItemObject, Double> inperiod = dataMap.get( period );
                    
                    if ( inperiod != null )
                    {
                        for ( Integer aoc : inperiod.keySet() )
                        {
                            Double value = expressionService.getExpressionValue( exp, inperiod.get( aoc ), constantMap, null, 0 );
                            ListMap<String, Double> samplemap = result.get( aoc );
                            
                            if ( samplemap == null )
                            {
                                samplemap = new ListMap<String, Double>();
                                result.put( aoc, samplemap );
                            }
                            
                            samplemap.putValue( aggregate, value );
                        }
                    }
                }
            }
        }

        return result;
    }

    private List<DataValue> readDataValues( BaseDimensionalItemObject input, Collection<OrganisationUnit> orgs,
        Collection<Period> periods )
    {
        List<DataValue> result;
        
        if ( input instanceof DataElement )
        {
            DataElement de = (DataElement) input;
            result = dataValueService.getDataValues( de, periods, orgs );
        }
        else if ( input instanceof DataElementOperand )
        {
            DataElementOperand deo = (DataElementOperand) input;
            result = dataValueService.getDataValues( deo.getDataElement(), deo.getCategoryOptionCombo(), periods, orgs );
        }
        else
        {
            result = new ArrayList<>();
        }
        
        return result;
    }

    private void gatherDataValues( BaseDimensionalItemObject input, Collection<OrganisationUnit> orgs,
        Collection<Period> periods,
        MapMap<OrganisationUnit, Period, MapMap<Integer, BaseDimensionalItemObject, Double>> result )
    {
        List<DataValue> values = readDataValues( input, orgs, periods );

        for ( DataValue v : values )
        {
            Period pe = v.getPeriod();
            OrganisationUnit ou = v.getSource();
            Integer aoc = v.getAttributeOptionCombo().getId();
            MapMap<Integer, BaseDimensionalItemObject, Double> valuemap = result.getValue( ou, pe );
            Map<BaseDimensionalItemObject, Double> deomap = (valuemap == null) ? (null) : (valuemap.get( aoc ));

            if ( valuemap == null )
            {
                Map<Period, MapMap<Integer, BaseDimensionalItemObject, Double>> periodSubMap = result.get( ou );
                
                if ( periodSubMap == null )
                {
                    periodSubMap = new HashMap<Period, MapMap<Integer, BaseDimensionalItemObject, Double>>();
                    result.put( ou, periodSubMap );
                }

                valuemap = new MapMap<Integer, BaseDimensionalItemObject, Double>();

                periodSubMap.put( pe, valuemap );
            }
            
            if ( deomap == null )
            {
                deomap = new HashMap<BaseDimensionalItemObject, Double>();
                valuemap.put( aoc, deomap );
            }
                        
            deomap.put( input, Double.valueOf( v.getValue() ) );
        }
    }

    private MapMap<OrganisationUnit, Period, MapMap<Integer, BaseDimensionalItemObject, Double>> getDataValues(
        Collection<BaseDimensionalItemObject> inputs, Collection<OrganisationUnit> orgs, Collection<Period> periods )
    {
        MapMap<OrganisationUnit, Period, MapMap<Integer, BaseDimensionalItemObject, Double>> result = 
            new MapMap<OrganisationUnit, Period, MapMap<Integer, BaseDimensionalItemObject, Double>>();
        
        for ( BaseDimensionalItemObject input : inputs )
        {
            gatherDataValues( input, orgs, periods, result );
        }
        
        return result;
    }

    private ArrayList<OrganisationUnit> sourceList( OrganisationUnit source )
    {
        return Lists.newArrayList( source );
    }
    
    private ListMap<Period, Period> getSamplePeriods( PeriodType ptype, Date first, Date last, int skip_count,
        int sequential_count, int annual_count )
    {
        // Is end inclusive or exclusive? And what if end is in the middle of a
        // period? Does the period get included?
        
        Period period = ptype.createPeriod( first );
        ListMap<Period, Period> results = new ListMap<Period, Period>();
        
        while ( ( period != null ) && ( !(period.getStartDate().after( last ) ) ) )
        {
            results.put( period, new ArrayList<Period>() );
            
            if ( sequential_count > 0 )
            {
                Period sample_period = ptype.getPreviousPeriod( period );
                int i = 0, j = 0;
                
                while ( j < skip_count )
                {
                    sample_period = ptype.getPreviousPeriod( sample_period );
                    j++;
                }
                
                while ( i < sequential_count )
                {
                    results.putValue( period, sample_period );
                    sample_period = ptype.getPreviousPeriod( sample_period );
                    i++;
                }
            }

            if ( annual_count > 0 )
            {
                int year_count = 0;
                Calendar yearly_calendar = PeriodType.createCalendarInstance( period.getStartDate() );

                // Move to the previous year
                yearly_calendar.set( Calendar.YEAR, yearly_calendar.get( Calendar.YEAR ) - 1 );

                while ( year_count < annual_count )
                {
                    // Defensive copy because createPeriod mutates Calendar
                    Calendar past_year = PeriodType.createCalendarInstance( yearly_calendar.getTime() );
                    
                    Period past_period = ptype.createPeriod( past_year );
                    
                    if ( sequential_count == 0 )
                    {
                        results.putValue( period, past_period );
                    }
                    else
                    {
                        Period sample_period = ptype.getNextPeriod( past_period, -sequential_count );
                        int period_count = 0, limit = sequential_count * 2 + 1;
                        
                        while ( period_count < limit )
                        {
                            results.putValue( period, sample_period );
                            sample_period = ptype.getNextPeriod( sample_period );
                            period_count++;
                        }
                    }
                    
                    // Move to the previous year
                    yearly_calendar.set( Calendar.YEAR, yearly_calendar.get( Calendar.YEAR ) - 1 );
                    year_count++;
                }
            }

            // Advance to the next period
            period = ptype.getNextPeriod( period );
        }

        return results;
    }

    @Override
    public int predict( Predictor p, Date start, Date end )
    {
        Collection<DataValue> values = getPredictions( p, start, end );
        
        for ( DataValue v : values )
        {
            if ( dataValueService.addDataValue( v ) )
            {
                log.info( "Saving succeeded for " + v );
            }
            else
            {
                log.warn( "Saving failed for " + v );
            }
        }
        
        return values.size();
    }
}
