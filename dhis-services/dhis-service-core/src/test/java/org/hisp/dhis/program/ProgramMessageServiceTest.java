package org.hisp.dhis.program;

import java.util.Date;

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

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.hisp.dhis.DhisSpringTest;
import org.hisp.dhis.common.CodeGenerator;
import org.hisp.dhis.organisationunit.OrganisationUnit;
import org.hisp.dhis.organisationunit.OrganisationUnitService;
import org.hisp.dhis.program.message.DeliveryChannel;
import org.hisp.dhis.program.message.ProgramMessage;
import org.hisp.dhis.program.message.ProgramMessageQueryParams;
import org.hisp.dhis.program.message.ProgramMessageRecipients;
import org.hisp.dhis.program.message.ProgramMessageService;
import org.hisp.dhis.program.message.ProgramMessageStatus;
import org.hisp.dhis.trackedentity.TrackedEntityInstance;
import org.hisp.dhis.trackedentity.TrackedEntityInstanceService;

import org.junit.Test;
import org.mockito.internal.util.collections.Sets;

import static org.junit.Assert.*;

import org.springframework.beans.factory.annotation.Autowired;

/**
 * @author Zubair <rajazubair.asghar@gmail.com>
 */

public class ProgramMessageServiceTest
    extends DhisSpringTest
{
    private OrganisationUnit ouA;

    private OrganisationUnit ouB;

    private ProgramInstance piA;

    private TrackedEntityInstance teiA;

    private ProgramMessageStatus messageStatus = ProgramMessageStatus.OUTBOUND;

    private Set<DeliveryChannel> channels = new HashSet<>();

    private ProgramMessageQueryParams params;

    private ProgramMessage pmsgA;

    private ProgramMessage pmsgB;

    private ProgramMessage pmsgC;

    private ProgramMessageRecipients recipientsA;

    private ProgramMessageRecipients recipientsB;

    private ProgramMessageRecipients recipientsC;

    private String uidA;

    private String uidB;

    private String uidC;

    private String text = "Hi";

    private String msisdn = "4740332255";

    private String subject = "subjectText";

    // -------------------------------------------------------------------------
    // Dependencies
    // -------------------------------------------------------------------------

    @Autowired
    private ProgramMessageService programMessageService;

    @Autowired
    private OrganisationUnitService orgUnitService;

    @Autowired
    private TrackedEntityInstanceService teiService;

    @Autowired
    private ProgramInstanceService programInstanceService;

    @Autowired
    private ProgramService programService;

    // -------------------------------------------------------------------------
    // Prerequisite
    // -------------------------------------------------------------------------

    @Override
    public void setUpTest()
    {
        ouA = createOrganisationUnit( 'A' );
        ouB = createOrganisationUnit( 'B' );
        orgUnitService.addOrganisationUnit( ouA );
        orgUnitService.addOrganisationUnit( ouB );

        Program program = new Program();
        program.setAutoFields();
        program.setOrganisationUnits( Sets.newSet( ouA, ouB ) );
        program.setName( "programA" );
        program.setDisplayShortName( "programAshortname" );
        program.setProgramType( ProgramType.WITHOUT_REGISTRATION );

        programService.addProgram( program );

        piA = new ProgramInstance();
        piA.setProgram( program );
        piA.setOrganisationUnit( ouA );
        piA.setName( "programInstanceA" );
        piA.setEnrollmentDate( new Date() );
        piA.setAutoFields();

        programInstanceService.addProgramInstance( piA );

        Set<OrganisationUnit> ouSet = new HashSet<>();
        ouSet.add( ouA );

        Set<String> ouUids = new HashSet<>();
        ouUids.add( ouA.getUid() );

        // ouSet.add( ouB );

        teiA = createTrackedEntityInstance( 'Z', ouA );
        teiService.addTrackedEntityInstance( teiA );

        recipientsA = new ProgramMessageRecipients();
        recipientsA.setOrganisationUnit( ouA );
        recipientsA.setTrackedEntityInstance( teiA );

        recipientsB = new ProgramMessageRecipients();
        recipientsB.setOrganisationUnit( ouA );
        recipientsB.setTrackedEntityInstance( teiA );

        recipientsC = new ProgramMessageRecipients();
        recipientsC.setOrganisationUnit( ouA );
        recipientsC.setTrackedEntityInstance( teiA );

        Set<String> phoneNumberListA = new HashSet<>();
        phoneNumberListA.add( msisdn );
        recipientsA.setPhoneNumbers( phoneNumberListA );

        Set<String> phoneNumberListB = new HashSet<>();
        phoneNumberListB.add( msisdn );
        recipientsB.setPhoneNumbers( phoneNumberListB );

        Set<String> phoneNumberListC = new HashSet<>();
        phoneNumberListC.add( msisdn );
        recipientsC.setPhoneNumbers( phoneNumberListC );

        channels.add( DeliveryChannel.SMS );

        pmsgA = new ProgramMessage();
        pmsgA.setText( text );
        pmsgA.setSubject( subject );
        pmsgA.setRecipients( recipientsA );
        pmsgA.setMessageStatus( messageStatus );
        pmsgA.setDeliveryChannels( channels );
        pmsgA.setProgramInstance( piA );
        pmsgA.setStoreCopy( false );

        pmsgB = new ProgramMessage();
        pmsgB.setText( text );
        pmsgB.setSubject( subject );
        pmsgB.setRecipients( recipientsB );
        pmsgB.setMessageStatus( messageStatus );
        pmsgB.setProgramInstance( piA );
        pmsgB.setDeliveryChannels( channels );

        pmsgC = new ProgramMessage();
        pmsgC.setText( text );
        pmsgC.setSubject( subject );
        pmsgC.setRecipients( recipientsC );
        pmsgC.setMessageStatus( messageStatus );
        pmsgC.setDeliveryChannels( channels );

        uidA = CodeGenerator.generateCode( 10 );
        uidB = CodeGenerator.generateCode( 10 );
        uidC = CodeGenerator.generateCode( 10 );

        pmsgA.setUid( uidA );
        pmsgB.setUid( uidB );
        pmsgC.setUid( uidC );

        params = new ProgramMessageQueryParams();
        params.setOrganisationUnit( ouUids );
        params.setProgramInstance( piA );
        params.setMessageStatus( messageStatus );

    }

    // -------------------------------------------------------------------------
    // Tests
    // -------------------------------------------------------------------------

    @Test
    public void testDeleteProgramMessage()
    {
        Integer pmsgAId = null;

        pmsgAId = programMessageService.saveProgramMessage( pmsgA );

        assertNotNull( pmsgAId );

        programMessageService.deleteProgramMessage( pmsgA );

        ProgramMessage programMessage = programMessageService.getProgramMessage( pmsgAId.intValue() );

        assertNull( programMessage );
    }

    @Test
    public void testExists()
    {
        programMessageService.saveProgramMessage( pmsgA );

        boolean exists = programMessageService.exists( uidA );

        assertTrue( exists );
    }

    @Test
    public void testGetAllProgramMessages()
    {
        programMessageService.saveProgramMessage( pmsgA );
        programMessageService.saveProgramMessage( pmsgB );
        programMessageService.saveProgramMessage( pmsgC );

        List<ProgramMessage> programMessages = programMessageService.getAllProgramMessages();

        assertNotNull( programMessages );
        assertTrue( !programMessages.isEmpty() );
        assertTrue( equals( programMessages, pmsgA, pmsgB, pmsgC ) );
    }

    @Test
    public void testGetProgramMessageById()
    {
        int pmsgAId = programMessageService.saveProgramMessage( pmsgA );

        ProgramMessage programMessage = programMessageService.getProgramMessage( pmsgAId );

        assertNotNull( programMessage );
        assertTrue( pmsgA.equals( programMessage ) );
    }

    @Test
    public void testGetProgramMessageByUid()
    {
        programMessageService.saveProgramMessage( pmsgA );

        ProgramMessage programMessage = programMessageService.getProgramMessage( uidA );

        assertNotNull( programMessage );
        assertTrue( pmsgA.equals( programMessage ) );
    }

    @Test
    public void testGetProgramMessageByQuery()
    {
        programMessageService.saveProgramMessage( pmsgA );
        programMessageService.saveProgramMessage( pmsgB );

        List<ProgramMessage> list = programMessageService.getProgramMessages( params );

        assertNotNull( list );
        assertTrue( equals( list, pmsgA, pmsgB ) );
        assertTrue( channels.equals( list.get( 0 ).getDeliveryChannels() ) );
    }

    @Test
    public void testSaveProgramMessage()
    {
        Integer pmsgAId = null;

        pmsgAId = programMessageService.saveProgramMessage( pmsgA );

        assertNotNull( pmsgAId );

        ProgramMessage programMessage = programMessageService.getProgramMessage( pmsgAId.intValue() );

        assertTrue( programMessage.equals( pmsgA ) );
    }

    @Test
    public void testUpdateProgramMessage()
    {
        Integer pmsgAId = programMessageService.saveProgramMessage( pmsgA );

        ProgramMessage programMessage = programMessageService.getProgramMessage( pmsgAId.intValue() );

        programMessage.setText( "hello" );

        programMessageService.updateProgramMessage( programMessage );

        ProgramMessage programMessageUpdated = programMessageService.getProgramMessage( pmsgAId.intValue() );

        assertNotNull( programMessageUpdated );
        assertTrue( programMessageUpdated.getText().equals( "hello" ) );
    }
}
