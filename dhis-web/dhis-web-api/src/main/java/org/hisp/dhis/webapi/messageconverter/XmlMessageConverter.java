package org.hisp.dhis.webapi.messageconverter;

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

import com.google.common.collect.ImmutableList;
import org.hisp.dhis.node.NodeService;
import org.hisp.dhis.node.types.RootNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpOutputMessage;
import org.springframework.http.MediaType;
import org.springframework.http.converter.AbstractHttpMessageConverter;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.converter.HttpMessageNotWritableException;

import java.io.IOException;
import java.util.zip.GZIPOutputStream;

/**
 * @author Morten Olav Hansen <mortenoh@gmail.com>
 */
public class XmlMessageConverter extends AbstractHttpMessageConverter<RootNode>
{
    public static final ImmutableList<MediaType> SUPPORTED_MEDIA_TYPES = ImmutableList.<MediaType>builder()
        .add( new MediaType( "application", "xml" ) )
        .add( new MediaType( "text", "xml" ) )
        .build();

    public static final ImmutableList<MediaType> COMPRESSED_SUPPORTED_MEDIA_TYPES = ImmutableList.<MediaType>builder()
        .add( new MediaType( "application", "xml+gzip" ) )
        .add( new MediaType( "text", "xml+gzip" ) )
        .build();

    @Autowired
    private NodeService nodeService;

    private boolean compressed;

    public XmlMessageConverter( boolean compressed )
    {
        setSupportedMediaTypes( compressed ? COMPRESSED_SUPPORTED_MEDIA_TYPES : SUPPORTED_MEDIA_TYPES );
        this.compressed = compressed;
    }

    @Override
    protected boolean supports( Class<?> clazz )
    {
        return RootNode.class.equals( clazz );
    }

    @Override
    protected boolean canRead( MediaType mediaType )
    {
        return false;
    }

    @Override
    protected RootNode readInternal( Class<? extends RootNode> clazz, HttpInputMessage inputMessage ) throws IOException, HttpMessageNotReadableException
    {
        return null;
    }

    @Override
    protected void writeInternal( RootNode rootNode, HttpOutputMessage outputMessage ) throws IOException, HttpMessageNotWritableException
    {
        if ( compressed )
        {
            GZIPOutputStream outputStream = new GZIPOutputStream( outputMessage.getBody() );
            nodeService.serialize( rootNode, "application/xml", outputStream );
            outputStream.close();
        }
        else
        {
            nodeService.serialize( rootNode, "application/xml", outputMessage.getBody() );
        }
    }
}
