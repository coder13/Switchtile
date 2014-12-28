function loadCSS() {
    var styleName = 'css/' + ((a = getCookie('style')) === null ? 'dark' : a) + '.css';
    console.log(styleName);
    $('#stylesheet').attr('href', styleName);
}

/* setCookie and getCookie functions originally from http://www.quirksmode.org/js/cookies.html */
function setCookie(name,value) {
    if (window.localStorage !== undefined) {
       window.localStorage.setItem(name,value);
       return;
    }
    var expires = "; expires=" + new Date(3000, 0, 01).toGMTString() + "; path=/";
    var cookies = document.cookie.split(';');
    var x = "switchtile=";
    var found = false;
    for (var i=0; i < cookies.length; i++) {
        var c = cookies[i];
        while (c.charAt(0) == ' ') c = c.substring(1,c.length);
        if (c.indexOf(x) === 0) { // this is the switchtile cookie
            found = true;
            var str = c.substring(x.length,c.length);
            var options = str.split('.');
            var good = false;
            for (var j = 0; j < options.length; j++) {
                if (options[j].split(',')[0] == name) {
                    good = true;
                    options[j] = name + "," + value;
                }
            }
            if (!good) {
                options[options.length] = name + "," + value;
            }
            var s = x;
            for (j = 0; j < options.length; j++) {
                if (j > 0) s += ".";
                s += options[j];
            }
            document.cookie = s + expires;
        }
    }
    if (!found) {
        document.cookie = x + name + "," + value + expires;
    }
}

function getCookie(name) {
    if (window.localStorage !== undefined) {
        var value = window.localStorage.getItem(name);
        if (value !== null) return value;
    }
 
    var cookies = document.cookie.split(';');
    var x = "switchtile=";
    for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(x) === 0) { // this is the switchtile cookie
            var str = c.substring(x.length,c.length);
            var options = str.split('.');
            for (var j=0; j < options.length; j++) {
                if (options[j].split(',')[0] == name) {
                    return options[j].split(',')[1];
                }
            }
        }
    }
    return null;
}

function getBrowser() {
    // http://www.quirksmode.org/js/detect.html
    var versionSearchString;
    var dataBrowser = [
        {string:navigator.userAgent, subString:"Chrome", identity:"Chrome"},
        {string:navigator.userAgent, subString:"Safari", identity:"Chrome"},
        {string:navigator.userAgent, subString:"Firefox", identity:"Firefox"},
        {string:navigator.userAgent, subString:"MSIE", identity:"IE", versionSearch:"MSIE"}];

    function searchString(data) {
        for (var i=0;i<data.length;i++) {
        var dataString = data[i].string;
        var dataProp = data[i].prop;
        if (dataString) {
            if (dataString.indexOf(data[i].subString) != -1)
                return data[i].identity;
            } else if (dataProp)
                return data[i].identity;
        }
    }
 
    return searchString(dataBrowser) || "An unknown browser";
}