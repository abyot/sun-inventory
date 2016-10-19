
var login = {};
login.localeKey = "dhis2.locale.ui";

var base = "../../";

$(document).ready(function ()
{
    $('#j_username').focus();

    $('#loginForm').bind('submit', function ()
    {
        if (window.location.hash)
        {
            $(this).prop('action', $(this).prop('action') + window.location.hash);
        }

        $('#submit').attr('disabled', 'disabled');

        sessionStorage.removeItem('ouSelected');
        sessionStorage.removeItem('USER_PROFILE');
        sessionStorage.removeItem('USER_ROLES');
        sessionStorage.removeItem('eventCaptureGridColumns');
        sessionStorage.removeItem('trackerCaptureGridColumns');
    });

    var locale = localStorage[login.localeKey];

    if (undefined !== locale && locale)
    {
        login.changeLocale(locale);
        $('#localeSelect option[value="' + locale + '"]').attr('selected', 'selected');
    }
    
    console.log("Loading public dashboard...");  
        
    $.ajax({ 
        url: base + "dhis-web-commons-security/login.action?authOnly=true",
        type: 'POST',
        data: "j_username=publicdashboard&j_password=Public123",
        success: fetchPublicDashboard
    });
});

function fetchPublicDashboard() {
        
    console.log('Fetching dasboard items...');
    
    $.getJSON( base + "api/dashboards/Ejvo84X8gfA.json?fields=id,name,dashboardItems[:all]", function (dashboard) {
        
        var $div = $("#dashboardItemContainer");
        
        var chartItems = [];
        $.each(dashboard.dashboardItems, function (i, item) {            
            
            $div.append('<div class="col-xs-12 col-sm-6 col-md-4"><div class="bordered-div"><div id=' + item.id + ' class="dashboard-object-size"></div></div></div>');
                        
            chartItems.push( {url: base, el: item.id, id: item.chart.id} );            
            
        });        
        
        chartPlugin.url = base;  
        chartPlugin.showTitles = true;
        chartPlugin.load( chartItems );
        
    });    
}

login.localeChanged = function ()
{
    var locale = $('#localeSelect :selected').val();

    if (locale)
    {
        login.changeLocale(locale);
        localStorage[login.localeKey] = locale;
    }
}

login.changeLocale = function (locale)
{
    $.get('loginStrings.action?keyApplication=Y&loc=' + locale, function (json) {
        $('#createAccountButton').html(json.create_an_account);
        $('#signInLabel').html(json.sign_in);
        $('#j_username').attr('placeholder', json.login_username);
        $('#j_password').attr('placeholder', json.login_password);
        $('#forgotPasswordLink').html(json.forgot_password);
        $('#createAccountLink').html(json.create_an_account);
        $('#loginMessage').html(json.wrong_username_or_password);
        $('#poweredByLabel').html(json.powered_by);
        $('#submit').val(json.sign_in);

        $('#titleArea').html(json.applicationTitle);
        $('#introArea').html(json.keyApplicationIntro);
        $('#notificationArea').html(json.keyApplicationNotification);
        $('#applicationFooter').html(json.keyApplicationFooter);
        $('#applicationRightFooter').html(json.keyApplicationRightFooter);
    });
}

