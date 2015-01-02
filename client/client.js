
//HTML5 Canvas stuff based off a demo by Dan Gries, rectangleworld.com.
//The basic setup here, including the debugging code and window load listener, was copied from 'HTML5 Canvas' by Fulton & Fulton.

// Modified version of qqwref's switchtile browser port

document.addEventListener("touchmove", function(e){e.preventDefault();}, false);

var username = null, password = null;
var pEvent = "single", ev = "3";
var cnt = 0; // move count
var times = {}, best = {};
var avgLengths = [5,12,100];
var bestAverages = [[],[],[]]; // best of 5, 12, 100
var nCurrent, nTotal; // for marathon and relay
var startTime, curTime, lapTime, memoTime,
    timerID;
var started = false, solving = false, memoing = false;
var dragging = false;
var relayData = "3,4,5", relayArr = [3,4,5], marathonLength;
var marathonTimes, relayTimes;

var dragStartX, dragStartY;
var currentX, currentY;
var context;
var canvas;
var cwidth = 300, cheight= 300; // size of canvas

var size = 3;
var squares;
var solved;
var colors = ['white','white','#FF6','white','#48C','white','#5F8','white','#222','white'];

var browser = getBrowser(); // only want to call this once

loadCSS();

if (!String.prototype.format) {
    String.prototype.format = function() {
        var str = this.toString();
        if (!arguments.length)
            return str;
        var arg = typeof arguments[0],
            args = (("string" == arg || "number" == arg) ? arguments : arguments[0]);
        for (arg in args)
            str = str.replace(RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
        return str;
    };
}
toDec = function(i){return parseInt(i,10);};

$(document).ready(function () {
    $('#loginButton').prop('disabled', true);
    $('#loginform').hide();
    $('#logout').hide();
    username = window.localStorage.getItem('username');
    password = window.localStorage.getItem('password');

    if (username && username !== null && username !== 'null' &&
        password && password !== null && password !== 'null') {
        console.log('logging in as:', username, password);
        $('#loginform').hide();
        $('#logout').show();
        $.post("login", {username: username, password: password}, function (data) {
            if (!data){
                $('#loginform').show();
                $('#logout').hide();
            }
            init();
        },'json');
    } else {
        $('#loginform').show();
        init();
    }

});

function login() {
    username = $('#username')[0].value;
    password = $('#password')[0].value;

    $.post('login', {username: username, password: password}, function (data) {
        if (data) {
            //login succesful
            $('#loginform').hide();
            $('#logout').show();
            window.localStorage.setItem('username', username);
            window.localStorage.setItem('password', password);

            getTimes();
            loadAll();

            $('#username')[0].value = '';
            $('#password')[0].value = '';
        }
    },'json');
}

function logout() {
    window.localStorage.removeItem('username');
    window.localStorage.removeItem('password');
    username = null;
    password = null;

    $('#loginform').show();
    $('#logout').hide();
}

/*******************************
 * CONTROLS AND MAIN FUNCTIONS *
 *******************************/

function init() {
    window.onkeydown = function(event){doKey(event);};

    loadStuff();
    // document.bgColor = 'black';
    // document.fgColor = 'white';
    changedEvent(false);
    // changedHideStats();
    loadAll();
}

function loadAll() {
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
    displayTimes(ev, false);

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
        var startX = Math.floor((dragStartX - wgap) * (size/s));
        var startY = Math.floor((dragStartY - hgap) * (size/s));
        if (startX < 0 || startY < 0 || startX >= size || startY >= size)
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
    currentX = Math.floor((currentX - wgap) * (size/s));
    currentY = Math.floor((currentY - hgap) * (size/s));
}

function pressSpacebar(casual) {
    if (solving) {
        if (isSolved() || pEvent == "blind") {
            finishSolve();
        }
    } else {
        if (pEvent == "relay") {
            size = relayArr[0];
            loadAll();
        }
        nCurrent = 0;
        showProgress();
        scramble();
        cnt = 0;
        started = casual;
        solving = !casual;
        if (pEvent == "blind")
            startTimer();
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
    var newZoom = parseInt(document.getElementById('zoomText').value, 10);
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
        changeN(size+1);
    else if (!shift && size>2 && (keyCode == 109 || keyCode == 173 || ((browser == "Chrome" || browser == "IE") && keyCode == 189)))
        changeN(size-1);

    //shift + - for square size
    else if (shift && (keyCode == 107 || keyCode == 61 || ((browser == "Chrome" || browser == "IE") && keyCode == 187)))
        changeDimensions(parseInt(cwidth, 10) + 20, parseInt(cwidth, 10) + 20);
    else if (shift && (keyCode == 109 || keyCode == 173 || ((browser == "Chrome" || browser == "IE") && keyCode == 189)))
        changeDimensions(parseInt(cwidth, 10) - 20, parseInt(cwidth, 10) - 20);

    //< > for marathon length
    else if (keyCode == 188 && shift && marathonLength>1 && pEvent=="marathon") {
        marathonLength--; showProgress();
    } else if (keyCode == 190 && shift && pEvent=="marathon") {
        marathonLength++; showProgress();
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
    } else if (pEvent == "blind") {
        stopTimer(isSolved());
        started = false;
        solving = false;

        drawScreen();
    } else if (pEvent == "marathon") {
        nCurrent++;
        showProgress();
        if (nCurrent >= marathonLength) {
            curTime = new Date();
            marathonTimes.push(curTime.getTime() - lapTime.getTime());
            stopTimer(true);
            started = false;
            solving = false;
        } else {
            curTime = new Date();
            marathonTimes.push(curTime.getTime() - lapTime.getTime());
            lapTime = curTime;
            scramble();
            started = true;
            solving = true;
        }
    } else if (pEvent == "relay") {
        nCurrent++;
        showProgress();
        if (nCurrent < nTotal) {
            curTime = new Date();
            relayTimes.push(curTime.getTime() - lapTime.getTime());
            lapTime = curTime;
            size = relayArr[nCurrent];
            loadAll();
            scramble();
            started = true;
            solving = true;
        } else {
            curTime = new Date();
            relayTimes.push(curTime.getTime() - lapTime.getTime());
            stopTimer(true);
            started = false;
            solving = false;
        }
    }
    saveStuff();
}

function reset() {
    if (pEvent == "relay") {
        size = relayArr[relayArr.length - 1];
    }
    $('#time, #movses, #times').html('');
    showProgress();
    nCurrent = 0;
    if (solving) {

    }
    stopTimer(false);
    solving = false;
    started = false;
    loadAll();
    saveStuff();
}

function changedEvent(update) {
    if (update){
        var obj = document.getElementById('pEvent');
        pEvent = obj.options[obj.selectedIndex].value;
    }
    if (pEvent == 'marathon') {
        nCurrent = 0;
        marathonLength = +$("#marathonText").val() || 3; // default

        $('#relaydata').hide();
        $('#marathondata').show();
        $('#size').show();
    } else if (pEvent == 'relay') {
        // parse relayData
        if (update) {
            if ($('#relayText')[0].value){
                relayData = $('#relayText')[0].value;
            } else {
                relayData = '3,4,5';
            }
            relayArr = _.map(relayData.split(','), toDec);
            if (relayArr.length === 0) relayArr = [3];
        }

        nCurrent = 0;
        nTotal = relayArr.length;
        size = relayArr[relayArr.length - 1];

        $('#relaydata').show();
        $('#marathondata').hide();
        $('#size').hide();
    } else if(pEvent == 'single' || pEvent == 'blind') {
        if (update) {
            if ($('#sizeText').val() && $('#sizeText').val() !== "")
                size = $('#sizeText').val();
            else
                $('#sizeText').val(size);
        } else {
            $('#sizeText').val(size);
        }
        $('#relaydata').hide();
        $('#marathondata').hide();
        $('#size').show();
    }

    ev = getEvent();
    reset();
    loadAll();
    displayTimes(ev, false);
    saveStuff();
}

// function changedHideStats() {
//     document.getElementById('stats').style.display = (document.getElementById('hideStats').checked) ? "none" : "";
//     saveStuff();
// }

function changedSize() {
    var newSize = +$('#sizeText').val();
    changeN(newSize);
    saveStuff();

}

function changeN(newSize) {
    if(solving) {
        var agree = confirm("Are you SURE? This will stop the timer!");
        if (!agree)
            return;
    }
    if (!isNaN(newSize) && newSize >= 2 && newSize <= 999 && newSize != size){
        stopTimer(false);
        solving = false;
        size = newSize;
        ev = getEvent();
        if (pEvent == "relay")
            nTotal = relayArr.length;
        reset();
        displayTimes(ev, false);
        saveStuff();
    } else {
        $('#sizeText').val(size);
    }
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
        // document.getElementById('progress').innerHTML = "";
        $('#progress').text('');
    } else if (pEvent == "marathon") {
        document.getElementById('progress').innerHTML = nCurrent + "/" + marathonLength + " puzzle" + (marathonLength==1?"":"s");
    } else if (pEvent == "relay") {
        document.getElementById('progress').innerHTML = nCurrent + "/" + nTotal + " puzzle" + (nTotal==1?"":"s");
    } else if (pEvent == "blind") {
        if (memoing)
            $("#progress").text('memoing');
        if (solving)
            $("#progress").text('solving');
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

    for (i = 0; i < size; i++) {
        for (j = 0; j < size; j++) {
            drawTile(squares[i][j], wgap + s * j / size, hgap + s * i / size,
                wgap + s * (j+1) / size, hgap + s * (i+1) / size);
        }
    }
}

// draw one tile on the screen
// color = what type of tile it is, x1/y1/x2/y2 = coordinates of square
function drawTile(type, x1, y1, x2, y2) {
    context.strokeStyle = "#999";
    context.lineWidth = Math.max(1, Math.min(cwidth, cheight)/(size*10));
    if (pEvent == "blind" && !memoing && started) {
        context.fillStyle = '#000000';
        context.fillRect(x1, y1, x2-x1, y2-y1);
    } else if (type == 2 || type == 4 || type == 6 || type == 8) {
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
    if (pEvent == "blind" && memoing) {
        curTime = new Date();
        memoTime = curTime.getTime()-startTime;
        memoing = false;
    }

    if (direction === 0) { // right
        var tmp = squares[layer][size-1];
        for (i=size-1; i>0; i--) {
            squares[layer][i] = squares[layer][i-1];
        }
        squares[layer][0] = tmp;
    } else if (direction == 1) { // down
        var tmp = squares[size-1][layer];
        for (i=size-1; i>0; i--) {
            squares[i][layer] = squares[i-1][layer];
        }
        squares[0][layer] = tmp;
    } else if (direction == 2) { // up
        var tmp = squares[0][layer];
        for (i=0; i<size-1; i++) {
            squares[i][layer] = squares[i+1][layer];
        }
        squares[size-1][layer] = tmp;
    } else { // left
        var tmp = squares[layer][0];
        for (i=0; i<size-1; i++) {
            squares[layer][i] = squares[layer][i+1];
        }
        squares[layer][size-1] = tmp;
    }

    if (redraw)
        drawScreen();
    if (redraw && solving) {
        cnt++;
        if (pEvent != "blind") {
            startTimer();
            if (isSolved()) {
                finishSolve();
            }
        }
    }
}

// get a solved array
function solvedSquares(n) {
    n = n || size;
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
    for (i = 0; i < size; i++) {
        for (j = 0; j < size; j++) {
            if (squares[i][j] != solved[i][j]) {
                return false;
            }
        }
    }
    return true;
}

function scramble(n) {
    n = n || size;
    do {
        // random permutation of pieces
        var nswaps = 0;
        for (i=0; i<(size*size)-2; i++) {
            var rand = i + Math.floor(Math.random() * (size*size - i));
            if (rand != i) {
                var i1 = i%size, rand1 = rand%size;
                var i2 = (i-i1)/size, rand2 = (rand-rand1)/size;
                var tmp = squares[i2][i1];
                squares[i2][i1] = squares[rand2][rand1];
                squares[rand2][rand1] = tmp;
                nswaps++;
            }
        }

        // if n==3, make sure to have proper parity
        if (size == 3 && nswaps % 2 == 1) {
            var swap = squares[size-1][size-2];
            squares[size-1][size-2] = squares[size-1][size-1];
            squares[size-1][size-1] = swap;
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
        lapTime = new Date();
        if (pEvent == 'relay')
            relayTimes = [];
        else if (pEvent == 'marathon')
            marathonTimes = [];
        else if (pEvent == "blind")
            memoing = true;
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

        var meta, ev = getEvent(), data = {
            size: ev,
            time: time,
            moves: cnt,
            user: {name: username, password: password}}, memoTimes;
        if (pEvent == 'relay') {
            data.times = relayTimes;
        } else if (pEvent == 'marathon') {
            data.times = marathonTimes;
        } else if (pEvent == 'blind') {
            memoTimes = [memoTime, time-memoTime];
            console.log(memoTimes);
            data.times = memoTimes;
        }

        if (good) { // store the time
            if (!times[ev])
                times[ev] = [time];
            else
                times[ev].push(time);
            // figure out averages and display

            if (username && username !== null && username !== 'null') { // connected to server
                $.post("users/" + username, data, function (data) {
                    best[size] = data;
                    displayTimes(ev, {time: time, moves: cnt, times: relayTimes||marathonTimes||memoTimes});
                }, 'json');

            } else { // local
                calcBest(ev, false, {time: time, moves: cnt, times: data.times});
            }
        } else {
            displayTimes(ev, {time: time, moves: cnt, times: data.times}, false);
            
        }
    }
}

function calcBest(ev, calculateSingle, currentTime) {
    if (!best)
            best = {};

    if (!best[ev]) {
        best[ev] = {};
    }

    if (calculateSingle) {
        var min = 0;
        for (i = 1; i < times[ev].length; i++) {
            if (times[ev][i] < times[ev][min]) {
                min = i;
            }
        }
        best[ev].single = times[min];
    }

    for (i = 0; i < avgLengths.length; i++) {
        len = avgLengths[i];
        if (times[ev].length >= len) {
            for (j = 0; j <= times[ev].length - len; j++) {
                var avg = getAvg(times[ev].slice(j, len + j));
                if (!best[ev][len]) {
                    best[ev][len] = avg;
                } else if (j === 0 || avg.time < best[ev][len].time) {
                    best[ev][len] = avg;
                }
            }
        
        }
    }
}

function getStats(n, currentTime) {
    var stats = {size: n, current: {}, best: {}};

    if (currentTime && best[n]) {
        if (currentTime.time < best[n].single.time)
            stats.best.single = currentTime;
        else if (best[n].single)
            stats.best.single = best[n].single;
    } else if (best[n] && best[n].single) {
        stats.best.single = best[n].single;
    } else if (times[n].length >= 1) {
        var min = 0;
        for (i = 1; i < times[n].length; i++) {
            if (times[n][i] < times[n][min])
                min = i;
        }
        stats.best.single = times[n][min];
    }

    for (i = 0; i < avgLengths.length; i++) {
        len = avgLengths[i];
        if (times[n].length >= len) {
            // current
            avg = getAvg(times[n].slice(times[n].length - len));
            stats.current[len] = avg;
            // best
            for (j = 0; j <= times[n].length - len; j++) {
                var avg = getAvg(times[n].slice(j, len + j));
                if (!stats.best[len]) {
                    stats.best[len] = avg;
                } else if (j === 0 || avg.time < stats.best[len].time) {
                    stats.best[len] = avg;
                }
            }

        }
    }

    return stats;
}


function formatStats(stats) {
    var v = "";
    if (stats.best.single){
        var single = stats.best.single;
        if (single)
            v = "Best single: " + pretty(single.time || single);
        if (single.details)
            v += " ({moves} moves; {mps} mps;".format(single.details) +
            (single.details.mpp ? single.details.mpp + " mpp":"") + ")";
        if (single.times) {
            v +=  " [" + _.map(single.times, pretty).join(', ') + "]";
        }
        v += "<br>";
    }

    for (var i in avgLengths) {
        i = avgLengths[i];
        if (stats.current[i] && stats.best[i]) {
            v += "<br>Current avg{0}: {1} => {2}".format(i, _.map(stats.current[i].times, pretty).join(', '), pretty(stats.current[i].time));
            v += "<br>Best avg{0}: {1} => {2}".format(i, _.map(stats.best[i].times, pretty).join(', '), pretty(stats.best[i].time)) + "<br>";
        }
    }

    return v;
}

function displayTimes(ev, time, good) {
    if (!times[ev]) {
        times[ev] = [];
        return;
    }

    stats = getStats(ev);
    document.getElementById('stats').innerHTML = formatStats(stats);

    if (time) {
        if (time.moves) {
            details = getDetails(time.time, stats.size, time.moves);
            $('#moves').html(details.moves + " move"+(details.moves!=1?"s":"")+" at " +
            details.mps + " moves/sec; " + (details.mpp? details.mpp + " move" + (details.mpp!=1?"s":"") + " per piece":" "));
        }
        if (time.times) {
            if (ev.indexOf('bld') != -1) {
                $('#times').html('memo: {0}, solving: {1}'.format(pretty(time.times[0]), pretty(time.times[1])));
            } else {
                $('#times').html(_.map(time.times, pretty).join(', '));
            }
        }

    } else {
        $('#moves').html('');
    }
}

function OlddisplayTimes(loadedPage, time) {
    var v = "";
    if (!times[ev])
        times[ev] = [];



    // find min
    if (times[ev].length >= 1) {
        var min = 0;
        for (i = 1; i < times[ev].length; i++) {
            if (times[ev][i] < times[ev][min])
                min = i;
        }
        v += "Best time: " + pretty(times[ev][min]) + "<br>";
    }

    for (var i = 0; i < avgLengths.length; i++) {
        var len = avgLengths[i];
        if (times[ev].length >= len) {
            var avgData = getAvg(times[ev].slice(times[ev].length - len));
            v += "<br>Current avg" + len + ": " + (len<100?avgData[0]:pretty(avgData[1])) + "<br>";
            v += "Best avg" + len + ": ";
            if (loadedPage) {
                // compute best average from scratch
                for (j=0; j <= times[ev].length-len; j++) {
                        var thisAvg = getAvg(times[ev].slice(j, len+j));
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
                if (times[ev].length == len || avgData[1] < bestAverages[i][1]) {
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
        document.getElementById('moves').innerHTML = cnt + " moves at " +
        Math.round(100000*cnt/time)/100 + " moves/sec<br>" +
        Math.round(1000*(cnt/(size*size)))/1000 + " moves per piece";
    } else {
        document.getElementById('moves').innerHTML = "";
    }
}

function getDetails(time, size, moves) {
    return {
        moves: moves,
        mps: Math.round(100000 * moves / time) / 100, // moves per second
        mpp: Math.round(1000 * (moves / (size * size))) / 1000 // moves per piece
    };
}


function getAvg(list) {
    var max = 0,
        min = 0;
    var sum = list[0];
    for (var i = 1; i < list.length; i++) {
        if (list[i] > list[max])
            max = i;
        if (list[i] < list[min])
            min = i;
        sum += list[i];
    }
    sum = sum - list[min] - list[max];
    return {
        time: sum / (list.length - 2),
        times: list
    };
}

function clearTimes() {
    times[ev] = [];
    document.getElementById('stats').innerHTML = "";
}

/********************
 * HELPER FUNCTIONS *
 ********************/
function saveStuff() {
    if (window.localStorage !== undefined) {

        window.localStorage.setItem("switchtile_pEvent", pEvent);
        if (username && username !== null && username !== 'null') {
            window.localStorage.setItem("username", username);
            window.localStorage.setItem("password", password);
        }
        window.localStorage.setItem("switchtile_times", JSON.stringify(times));
        window.localStorage.setItem("switchtile_best", JSON.stringify(best));
        window.localStorage.setItem("switchtile_relayData", relayData);
        window.localStorage.setItem("switchtile_marathonData", marathonLength);
        window.localStorage.setItem("switchtile_size", size);
        window.localStorage.setItem("switchtile_zoom", cwidth);
    }
}

function loadStuff() {
    if (window.localStorage !== undefined) {
        pEvent = window.localStorage.getItem("switchtile_pEvent");
        $("#pEvent").val(pEvent);
        size = window.localStorage.getItem("switchtile_size");
        if (!size || size === null || typeof size != "number" || size < 2 || size > 999)
            size = 3;
        $("#sizeText").val(size);
            
        
        ev = getEvent();

        getTimes();

        relayData = window.localStorage.getItem("switchtile_relayData") || relayData;
        relayArr = _.map(relayData.split(','), toDec);
        $('#relayText').val(relayData);

        marathonLength = window.localStorage.getItem("switchtile_marathonData") || 3;
        $('#marathonText').val(marathonLength);

        zoom = window.localStorage.getItem("switchtile_zoom");
        if (zoom !== null) {
            cwidth = parseInt(zoom, 10);
            cheight = parseInt(zoom, 10);
        }
        $('#zoomText').val(zoom);
    }
}

function getTimes() {
    if (username && username !== null && username !== 'null') {
        $.getJSON("users/" + username, function(data) {
            times = data.times;
            best = data.pbs;
            console.log('times: ', data);
            displayTimes(ev);
        });
    } else {
        times = JSON.parse(window.localStorage.getItem("switchtile_times")) || {ev:[]};
        best = JSON.parse(window.localStorage.getItem('switchtile_best')) || {ev:[]};
    }
}

function getEvent() {
    switch (pEvent) {
        case "single":
            return size;
        case "blind":
            return size + "bld";
        case "marathon":
            return size + "*" + marathonLength;
        case "relay":
            return relayData;
    }
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
