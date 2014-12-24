
//HTML5 Canvas stuff based off a demo by Dan Gries, rectangleworld.com.
//The basic setup here, including the debugging code and window load listener, was copied from 'HTML5 Canvas' by Fulton & Fulton.

// Modified version of qqwref's switchtile browser port

document.addEventListener("touchmove", function(e){e.preventDefault();}, false);

var name = null;
var pEvent = "single";
var cnt = 0; // move count
var times = {};
var avgLengths = [5,12,100];
var bestAverages = [[],[],[]]; // best of 5, 12, 100
var nCurrent, nTotal; // for marathon and relay
var startTime;
var curTime;
var timerID;
var started = false;
var solving = false;
var dragging = false;
var relayData = "3,4,5", relayArr = [3,4,5];

var dragStartX, dragStartY;
var currentX, currentY;
var context;
var canvas;
var cwidth = 300,
    cheight= 300; // size of canvas

var n = 3;
var squares;
var solved;
var colors = ["white","white","#FF6","white","#48C","white","#5F8","white","#222","white"];

var browser = getBrowser(); // only want to call this once

$(document).ready(function () {
    $('#loginButton').prop('disabled', true);
    name = window.localStorage.getItem('username');
    console.log(name, typeof(name));

    if (name && name !== null && name !== 'null') {
        $("#loginform").hide();
    }
    init();
    console.log(times);
    displayTimes(true);
});

function login() {
    var username = $("#username")[0].value,
        password = $("#password")[0].value;

    $.post("login", {username: username, password: password}, function (data) {
        if (data) {
            name = username;
            //login succesful
            $("#loginform").hide();
            window.localStorage.setItem('username', username);

            getTimes();
            loadAll();
        }
    },'json');
}

/*******************************
 * CONTROLS AND MAIN FUNCTIONS *
 *******************************/

function init() {
    window.onkeydown = function(event){doKey(event);};

    loadStuff();
    document.bgColor = "black";
    document.fgColor = "white";
    changedEvent(false);
    changedHideStats();
    loadAll();
}
 
function loadAll() {
    document.getElementById('sizeText').value = n;
    document.getElementById('moves').innerHTML = "";
    document.getElementById('relayText').value = relayData;
    document.getElementById('zoomText').value = cwidth;
    showProgress();
 
    canvas = document.getElementById('c');
    context = canvas.getContext('2d');
    canvas.height = cheight;
    canvas.width = cwidth;
    document.getElementById('cube').height = cheight;
    document.getElementById('cube').width = cwidth;
 
    solved = solvedSquares();
    squares = solvedSquares();
 
    drawScreen();
    cnt = 0;
    saveStuff();
    displayTimes(true, 0);
     
    canvas.addEventListener("touchstart", mouseDownListener, false);
    canvas.addEventListener("mousedown", mouseDownListener, false);
    canvas.addEventListener("mousemove", mouseMoveListener, false);
    window.addEventListener("touchcancel", mouseUpListener, false);
    window.addEventListener("touchend", mouseUpListener, false);
    window.addEventListener("touchleave", mouseUpListener, false);
    window.addEventListener("mouseup", mouseUpListener, false);
}

// listen for a mouse-down event
function mouseDownListener(evt) {
    //getting mouse position correctly, being mindful of resizing that may have occurred in the browser:
    var bRect = canvas.getBoundingClientRect();
    if (evt.changedTouches == null) {
        dragStartX = (evt.clientX - bRect.left)*(canvas.width/bRect.width);
        dragStartY = (evt.clientY - bRect.top)*(canvas.height/bRect.height);
    } else {
        dragStartX = (evt.changedTouches[0].pageX - bRect.left)*(canvas.width/bRect.width);
        dragStartY = (evt.changedTouches[0].pageY - bRect.top)*(canvas.height/bRect.height);
    }
  
    dragging = true;

    //code below prevents the mouse down from having an effect on the main browser window:
    if (evt.preventDefault) {
        evt.preventDefault();
    } else if (evt.returnValue) { //standard
        evt.returnValue = false;
    } //older IE
    return false;
}

// listen for a mouse-up event (i.e. a completed drag)
function mouseUpListener(evt) {
    if (dragging) {
        dragging = false;
  
        // a drag is finished - get the ending position
        var bRect = canvas.getBoundingClientRect();
        var w = canvas.width, h = canvas.height;
        var dragEndX, dragEndY;
        if (evt.changedTouches == null) {
            dragEndX = (evt.clientX - bRect.left)*(canvas.width/bRect.width);
            dragEndY = (evt.clientY - bRect.top)*(canvas.height/bRect.height);
        } else {
            dragEndX = (evt.changedTouches[0].pageX - bRect.left)*(canvas.width/bRect.width);
            dragEndY = (evt.changedTouches[0].pageY - bRect.top)*(canvas.height/bRect.height);
        }
  
        // get position of starting cell
        var s = Math.min(w,h);
        var wgap = (w - s)/2;
        var hgap = (h - s)/2;
        var startX = Math.floor((dragStartX - wgap) * (n/s));
        var startY = Math.floor((dragStartY - hgap) * (n/s));
        if (startX < 0 || startY < 0 || startX >= n || startY >= n)
            return;

        // determined direction
        var diag1 = (dragEndX - dragStartX) + (dragEndY - dragStartY);
        var diag2 = (dragEndX - dragStartX) - (dragEndY - dragStartY);
        if (diag1 > 0 && diag2 > 0) {
            doMove(0, startY, true); // right
        } else if (diag1 > 0) {
            doMove(1, startX, true); // down
        } else if (diag2 > 0) {
            doMove(2, startX, true); // up
        } else {
            doMove(3, startY, true); // left
        }
    }
}

function mouseMoveListener(evt) {
    var bRect = canvas.getBoundingClientRect();
    var w = canvas.width, h = canvas.height;
    var s = Math.min(w,h);
    var wgap = (w - s)/2;
    var hgap = (h - s)/2;

    currentX = (evt.clientX - bRect.left)*(canvas.width/bRect.width);
    currentY = (evt.clientY - bRect.top)*(canvas.height/bRect.height);
    currentX = Math.floor((currentX - wgap) * (n/s));
    currentY = Math.floor((currentY - hgap) * (n/s));
}

function pressSpacebar(casual) {
    if (solving) {
        if (isSolved()) {
            finishSolve();
        }
    } else {
        if (pEvent == "relay") {
            n = relayArr[0];
            loadAll();
        }
        nCurrent = 0;
        showProgress();
        scramble();
        cnt = 0;
        started = casual;
        solving = !casual;
    }
}

function pressEscape() {
    if(solving) {
        var agree = confirm("Are you SURE? This will stop the timer!");
        if (!agree)
            return;
    }
    reset();
}

function changedZoom() {
    var newZoom = parseInt(document.getElementById('zoomText').value);
    changeDimensions(newZoom, newZoom);
    saveStuff();
}

function doKey(e) {
    if ($(':focus')[0]) {
        if ($(':focus')[0].id == 'username' || $(':focus')[0].id == 'password') {
            if ($('#username')[0].value && $('#password')[0].value.length >= 6) {
                $('#loginButton').prop('disabled', false);
            } else {
                $('#loginButton').prop('disabled', true);
            }
        }
    } else {

    var keyCode = 0;
    if (e.keyCode) {
        keyCode = e.keyCode;
    } else if (e.which) {
        keyCode = e.which;
    }
    var shift = e.shiftKey;
    var shmod = (shift ? 1 : 0); // shift modifier for layers
    if (keyCode == 32) { // prevent normal handling of space key
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        e.preventDefault();
    }

    // up: 87
    // down: 83
    // left: 65
    // right: 68

    if (keyCode == 68) {
        doMove(0, currentY, true); // right
        if (shift)
            doMove(0, currentY, true); // right
    } else if (keyCode == 83) {
        doMove(1, currentX, true); // down
        if (shift)
            doMove(1, currentX, true);
    } else if (keyCode == 87) {
        doMove(2, currentX, true); // up  
        if (shift)
            doMove(2, currentX, true); // up  
    } else if (keyCode == 65) {
        doMove(3, currentY, true); // left
        if (shift)
            doMove(3, currentY, true); // left
    }

    // space to scramble
    if (keyCode == 32) {
        pressSpacebar(shift);
    }

    //+ - for cube size
    else if (!shift && (keyCode == 107 || keyCode == 61 || ((browser == "Chrome" || browser == "IE") && keyCode == 187)))
        changeN(n+1);
    else if (!shift && n>2 && (keyCode == 109 || keyCode == 173 || ((browser == "Chrome" || browser == "IE") && keyCode == 189)))
        changeN(n-1);

    //shift + - for square size
    else if (shift && (keyCode == 107 || keyCode == 61 || ((browser == "Chrome" || browser == "IE") && keyCode == 187)))
        changeDimensions(parseInt(cwidth) + 20, parseInt(cwidth) + 20);
    else if (shift && (keyCode == 109 || keyCode == 173 || ((browser == "Chrome" || browser == "IE") && keyCode == 189)))
        changeDimensions(parseInt(cwidth) - 20, parseInt(cwidth) - 20);
 
    //< > for marathon length
    else if (keyCode == 188 && shift && nTotal>1 && pEvent=="marathon") {
        nTotal--; showProgress();
    } else if (keyCode == 190 && shift && pEvent=="marathon") {
        nTotal++; showProgress();
    }

    //escape to reset
    else if (keyCode == 27) {
        pressEscape();
    }
    

    }

}

function finishSolve() {
    if (pEvent == "single") {
        stopTimer(true);
        started = false;
        solving = false;
    } else if (pEvent == "marathon") {
        nCurrent++;
        showProgress();
        if (nCurrent >= nTotal) {
            stopTimer(true);
            started = false;
            solving = false;
        } else {
            scramble();
            started = true;
            solving = true;
        }
    } else if (pEvent == "relay") {
        nCurrent++;
        showProgress();
        if (nCurrent < nTotal) {
            n = relayArr[nCurrent];
            loadAll();
            scramble();
            started = true;
            solving = true;
        } else {
            stopTimer(true);
            started = false;
            solving = false;
        }
    }
    saveStuff();
}

function reset() {
    if (pEvent=="relay") {
        n = relayArr[relayArr.length - 1];
    }
    showProgress();
    nCurrent = 0;
    if (solving)
        clearTimes();
    stopTimer(false);
    solving = false;
    started = false;
    loadAll();
    saveStuff();
}

function changedEvent(clearTimes) {
    var obj = document.getElementById('pEvent');
    pEvent = obj.options[obj.selectedIndex].value;
    if (pEvent=="marathon") {
        nCurrent = 0;
        nTotal = 42; // default
    } else if (pEvent=="relay") {
        // parse relayData
        relayData = document.getElementById('relayText').value.split(/,| /);
        relayArr = [];
        for (i = 0; i < relayData.length; i++) {
            var solv = parseInt(relayData[i]);
            if (solv >= 2 && solv <= 1000) {
                relayArr.push(solv);
            }
        }
        if (relayArr.length === 0) relayArr = [3];
        nCurrent = 0;
        nTotal = relayArr.length;
        n = relayArr[relayArr.length - 1];
    }
    if (clearTimes)
        clearTimes();
    document.getElementById('relaydata').style.display = (pEvent=="relay") ? "" : "none";
    saveStuff();
}

function changedHideStats() {
    document.getElementById('stats').style.display = (document.getElementById('hideStats').checked) ? "none" : "";
    saveStuff();
}

function changedSize() {
    var newSize = parseInt(document.getElementById('sizeText').value);
    changeN(newSize);
    saveStuff();
}

function changeN(newN) {
    if(solving) {
        var agree = confirm("Are you SURE? This will stop the timer!");
        if (!agree)
            return;
    }
    if (newN < 2)
        newn = 2;
    if (newN == n)
        return;
 
    stopTimer(false);
    solving = false;
    n = newN;
    if (pEvent == "relay")
        nTotal = relayArr.length;
    loadAll();
    saveStuff();
}

function changeDimensions(newWidth, newHeight) {
    cwidth = newWidth;
    cheight = newHeight;
    c = document.getElementById('c').getContext('2d');
    document.getElementById('c').height = cheight;
    document.getElementById('c').width = cwidth;
    document.getElementById('cube').height = cheight;
    document.getElementById('cube').width = cwidth;
    document.getElementById('zoomText').value = cwidth;
    drawScreen();
    saveStuff();
}

function showProgress() {
    if (pEvent == "single") {
        document.getElementById('progress').innerHTML = "";
    } else if (pEvent == "marathon") {
        document.getElementById('progress').innerHTML = nCurrent + "/" + nTotal + " puzzle" + (nTotal==1?"":"s");
    } else if (pEvent == "relay") {
        document.getElementById('progress').innerHTML = nCurrent + "/" + nTotal + " puzzle" + (nTotal==1?"":"s");
    }
}

/************
 * GRAPHICS *
 ************/

// redraw everything
function drawScreen() {
    var w = canvas.width, h = canvas.height;
    context.fillStyle = "#999";
    context.fillRect(0, 0, w, h);
 
    var s = Math.min(w,h);
    var wgap = (w - s)/2;
    var hgap = (h - s)/2;
 
    for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
            drawTile(squares[i][j], wgap + s * j / n, hgap + s * i / n,
                wgap + s * (j+1) / n, hgap + s * (i+1) / n);
        }
    }
}
 
// draw one tile on the screen
// color = what type of tile it is, x1/y1/x2/y2 = coordinates of square
function drawTile(type, x1, y1, x2, y2) {
    context.strokeStyle = "#999";
    context.lineWidth = Math.max(1, Math.min(cwidth, cheight)/(n*10));
    if (type == 2 || type == 4 || type == 6 || type == 8) {
        context.fillStyle = colors[type];
        context.fillRect(x1, y1, x2-x1, y2-y1);
    } else if (type == 1) {
        drawTriangle(colors[2], x2,y1, x2,y2, x1,y2);
        drawTriangle(colors[4], x2,y1, x1,y1, x1,y2);
    } else if (type == 3) {
        drawTriangle(colors[2], x1,y1, x1,y2, x2,y2);
        drawTriangle(colors[6], x1,y1, x2,y1, x2,y2);
    } else if (type == 5) {
        drawTriangle(colors[2], x2,y2, x1,y2, (x2+x1)/2,(y2+y1)/2);
        drawTriangle(colors[4], x1,y1, x1,y2, (x2+x1)/2,(y2+y1)/2);
        drawTriangle(colors[6], x2,y2, x2,y1, (x2+x1)/2,(y2+y1)/2);
        drawTriangle(colors[8], x1,y1, x2,y1, (x2+x1)/2,(y2+y1)/2);
    } else if (type == 7) {
        drawTriangle(colors[4], x1,y1, x1,y2, x2,y2);
        drawTriangle(colors[8], x1,y1, x2,y1, x2,y2);
    } else if (type == 9) {
        drawTriangle(colors[6], x2,y1, x2,y2, x1,y2);
        drawTriangle(colors[8], x2,y1, x1,y1, x1,y2);
    }
    context.strokeRect(x1, y1, x2-x1, y2-y1);
}
 
// draw a triangle
// fillColor = color of triangle, x1/y1/x2/y2/x3/y3 = vertices
function drawTriangle(fillColor, x1, y1, x2, y2, x3, y3) {
    context.fillStyle = fillColor;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineTo(x3, y3);
    context.closePath();
    context.fill();
}

/******************
 * PUZZLE DETAILS *
 ******************/
 
// do a move
// direction = 0/1/2/3 (right/down/up/left), layer = layer from top/left (0 to n-1)
function doMove(direction, layer, redraw) {
    if (direction === 0) { // right
        var tmp = squares[layer][n-1];
        for (i=n-1; i>0; i--) {
            squares[layer][i] = squares[layer][i-1];
        }
        squares[layer][0] = tmp;
    } else if (direction == 1) { // down
        var tmp = squares[n-1][layer];
        for (i=n-1; i>0; i--) {
            squares[i][layer] = squares[i-1][layer];
        }
        squares[0][layer] = tmp;
    } else if (direction == 2) { // up
        var tmp = squares[0][layer];
        for (i=0; i<n-1; i++) {
            squares[i][layer] = squares[i+1][layer];
        }
        squares[n-1][layer] = tmp;
    } else { // left
        var tmp = squares[layer][0];
        for (i=0; i<n-1; i++) {
            squares[layer][i] = squares[layer][i+1];
        }
        squares[layer][n-1] = tmp;
    }
 
    if (redraw) 
        drawScreen();
    if (redraw && solving) {
        cnt++;
        startTimer();
        if (isSolved()) {
            finishSolve();
        }
    }
}
 
// get a solved array
function solvedSquares() {
    sqr = [];
    for (i=0; i<n; i++) {
        sqr[i] = [];
        for (j=0; j<n; j++) {
            // determine the "color" of a square. imagine the numpad
            if (i>j && i+j+1==n) {
                sqr[i][j] = 1;
            } else if (i>j && i+j+1>n) {
                sqr[i][j] = 2;
            } else if (i==j && i+j+1>n) {
                sqr[i][j] = 3;
            } else if (i>j && i+j+1<n) {
                sqr[i][j] = 4;
            } else if (i==j && i+j+1==n) {
                sqr[i][j] = 5;
            } else if (i<j && i+j+1>n) {
                sqr[i][j] = 6;
            } else if (i==j && i+j+1<n) {
                sqr[i][j] = 7;
            } else if (i<j && i+j+1<n) {
                sqr[i][j] = 8;
            } else if (i<j && i+j+1==n) {
                sqr[i][j] = 9;
            } else {
                sqr[i][j] = -1;
            }
        }
    }
    return sqr;
}

// check if our position is solved
function isSolved() {
    for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
            if (squares[i][j] != solved[i][j]) {
                return false;
            }
        }
    }
    return true;
}

function scramble() {
    do {
        // random permutation of pieces
        var nswaps = 0;
        for (i=0; i<(n*n)-2; i++) {
            var rand = i + Math.floor(Math.random() * (n*n - i));
            if (rand != i) {
                var i1 = i%n, rand1 = rand%n;
                var i2 = (i-i1)/n, rand2 = (rand-rand1)/n;
                var tmp = squares[i2][i1];
                squares[i2][i1] = squares[rand2][rand1];
                squares[rand2][rand1] = tmp;
                nswaps++;
            }
        }
  
        // if n==3, make sure to have proper parity
        if (n == 3 && nswaps % 2 == 1) {
            var tmp = squares[n-1][n-2];
            squares[n-1][n-2] = squares[n-1][n-1];
            squares[n-1][n-1] = tmp;
        }
    } while (isSolved());
    drawScreen();
}

/*******************
 * TIMER AND STATS *
 *******************/

function startTimer() {
    if (!started) {
        started = true;
        startTime = new Date();
        timerID = setInterval(updateTimer, 100);
    }
}

function pretty(time) {
    time = Math.round(time);
    var mins = Math.floor(time/60000);
    var secs = trim((time - 60000*mins)/1000, 3);
    if (mins === 0) {
        return secs;
    } else {
        return mins + (secs<10?":0":":") + secs;
    }
}

function updateTimer() {
    curTime = new Date();
    var time = curTime.getTime() - startTime.getTime();
    document.getElementById('time').innerHTML = pretty(time);
}

function stopTimer(good) {
    if (started) {
        started = false;
        curTime = new Date();
        var time = curTime.getTime() - startTime.getTime();
        document.getElementById('time').innerHTML = pretty(time) + (good ? "" : "*");
        clearInterval(timerID);

        if (good) { // store the time
            // times[n][times.length] = time;
            times[n].push(time);
            // figure out averages and display
            displayTimes(false, time);

            if (name && name !== null && name !== 'null')
                $.post("users/" + name, {size: n, time: time}, 'json');
        }
    }
}

function displayTimes(loadedPage, time) {
    var v = "";
    var min = 0;
    if (!times[n])
        times[n] = [];

    // find min
    for (var i = 1; i < times[n].length; i++) {
        if (times[n][i] < times[n][min]);
            min = i;
    }

    if (times[n].length >= 1) {
        v += "Best time: " + pretty(times[n][min]) + "<br>";
    }
   
    for (var i = 0; i < avgLengths.length; i++) {
        var len = avgLengths[i];
        if (times[n].length >= len) {
            var avgData = getAvg(len, times[n].slice(times[n].length - len));
            v += "<br>Current avg" + len + ": " + (len<100?avgData[0]:pretty(avgData[1])) + "<br>";
            v += "Best avg" + len + ": ";
            if (loadedPage) {
                // compute best average from scratch
                for (j=0; j <= times[n].length-len; j++) {
                        var thisAvg = getAvg(len, times[n].slice(j, len+j));
                    if (j === 0 || thisAvg[1] < bestAverages[i][1]) {
                        bestAverages[i] = thisAvg;
                    }
                }
                if (len<100) {
                    v += bestAverages[i][0] + "<br>";
                } else {
                    v += pretty(bestAverages[i][1]) + "<br>";
                }
            } else {
                // just compare avgData to best averages
                if (times[n].length == len || avgData[1] < bestAverages[i][1]) {
                    bestAverages[i] = avgData;
                }

                if (len<100) {
                    v += bestAverages[i][0] + "<br>";
                } else {
                    v += pretty(bestAverages[i][1]) + "<br>";
                }
            }
            v += "";
        }
    }
    document.getElementById('stats').innerHTML = v;
    if (!loadedPage) {
        document.getElementById('moves').innerHTML = cnt + " moves at " + Math.round(100000*cnt/time)/100 + " moves/sec<br>" + 
        Math.round(1000*(cnt/(n*n)))/1000 + " moves per piece";
    } else {
        document.getElementById('moves').innerHTML = "";
    }
}

function getAvg(n, list) {
    var max = 0;
    var min = 0;
    var sum = list[0];
    for (var i=1; i<n; i++) {
        if (list[i] > list[max])
            max = i;
        if (list[i] < list[min])
            min = i;
        sum += list[i];
    }
    sum = sum - list[min] - list[max];
    var v = "";
    for (var i=0; i<n; i++) {
        if (i == min || i == max) {
            v += "(" + pretty(list[i]) + ") ";
        } else {
            v += pretty(list[i]) + " ";
        }
    }
    var avg = sum/(n-2);
    v += "=> " + pretty(avg);
    return [v, avg];
}

function clearTimes() {
    times = {};
    document.getElementById('stats').innerHTML = "";
}

/********************
 * HELPER FUNCTIONS *
 ********************/
function saveStuff() {
    if (window.localStorage !== undefined) {

        window.localStorage.setItem("switchtile_pEvent",pEvent);
        if (name && name !== null && name !== 'null') {
            window.localStorage.setItem("username", name);
        }
        window.localStorage.setItem("switchtile_times", JSON.stringify(times));
        window.localStorage.setItem("switchtile_relayData",relayData);
        window.localStorage.setItem("switchtile_n",n);
        window.localStorage.setItem("switchtile_zoom",cwidth);
    }
}

function loadStuff() {
    if (window.localStorage !== undefined) {
        var tmp = window.localStorage.getItem("switchtile_pEvent");
        if (tmp !== null)
            pEvent = tmp;

        getTimes();

        tmp = window.localStorage.getItem("switchtile_relayData");
        if (tmp !== null)
            relayData = tmp;
        tmp = window.localStorage.getItem("switchtile_n");
        if (tmp !== null)
            n = parseInt(tmp);
        if (n < 2)
            n = 2;
        tmp = window.localStorage.getItem("switchtile_zoom");
        if (tmp !== null) {
            cwidth = parseInt(tmp);
            cheight = parseInt(tmp);
        }
    }
}

function getTimes() {
    if (name && name !== null && name !== 'null') {
        $.getJSON("users/" + name, function(data) {
            times = data;
            console.log(data);
            displayTimes(true);
        });
    } else {
        times = JSON.parse(window.localStorage.getItem("switchtile_times")) || {n:[]};
    }
}

// function $(str) {
//     return document.getElementById(str);
// }

function sqrt(x){
    return Math.sqrt(x);
}

function trim(number, nDigits) {
    if (!number || number == Number.POSITIVE_INFINITY || number == Number.NEGATIVE_INFINITY)
        number = 0;
    var power = Math.pow(10, nDigits);
    var trimmed = "" + Math.round(number * power);
    while (trimmed.length < nDigits + 1) {
        trimmed = "0" + trimmed;
    }
    var len = trimmed.length;
    return trimmed.substr(0,len - nDigits) + "." + trimmed.substr(len - nDigits, nDigits);
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
    };
 
    return searchString(dataBrowser) || "An unknown browser";
}
// -->