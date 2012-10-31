$(function() {
    var hlLine = 0;
    var editor = window.editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
        lineNumbers: true,
        lineWrapping: true,
        extraKeys: {
            "F11": function() {
                var scroller = $('.CodeMirror-scroll');
                if(!scroller.hasClass('CodeMirror-fullscreen')) {
                    scroller.addClass('CodeMirror-fullscreen');
                    editor.refresh();
                } else {
                    scroller.removeClass('CodeMirror-fullscreen');
                    editor.refresh();
                }
            },
            "Esc": function() {
                var scroller = $('.CodeMirror-scroll');
                scroller.removeClass('CodeMirror-fullscreen');
                editor.refresh();
            }
        },
        onUpdate: function() {
            $('#error').hide();
            $('#run').removeClass('disabled');
            $('#stop').removeClass('disabled');
            $('#reset').removeClass('disabled');
            $('#debug').removeClass('disabled');
            $('#step').removeClass('disabled');
        },
        onCursorActivity: function() {
            if(!editor.getOption('readOnly')) {
                editor.setLineClass(hlLine, null, null);
                hlLine = editor.setLineClass(editor.getCursor().line, null, "activeLine");
            }
        }
    });
    $('.CodeMirror').addClass('inset');
    
    $('#savePanel').on('show', function(){ $(this).show(); });
    $('#savePanel').on('hidden', function(){ $(this).fadeOut(); });
    
    var cpu = new DCPU16.CPU(), assembler, notRun = false;
    var instructionMap = [], addressMap = [];
    var devices = [];
 
    var screen = new LEM1802('canvas');
    devices.push(screen);
    var onScreenDraw = function() {
        if(!lemClicked && $('#canvas').css('display') === 'none') {
            $('#canvas').css('display', 'block');
            $('#show-lem').addClass('active');
        }
        screen.offDraw(onScreenDraw);
    };
    screen.onDraw(onScreenDraw);
    
    var tickRate = 0, clockInterrupt = 0, clockTicks = 0;
    var clock = {
        id: 0x12d0b402,
        version: 0,
        manufacturer: 0,
        onInterrupt: function() {
            switch(cpu.mem.a) {
                case 0:
                    if(cpu.mem.b) {
                        clockTicks = 0;
                        tickRate = cpu.mem.b;
                        if(!clockTicking) clockTick();
                    } else {
                        tickRate = 0;
                    }
                    break;
                    
                case 1:
                    cpu.mem.c = clockTicks;
                    break;
                
                case 2:
                    clockInterrupt = cpu.mem.b;
                    break;
            }
        }
    };
    devices.push(clock);
    
    var clockTicking = false, tickRate = 1;
    function clockTick() {
        clockTicking = true;
        
        if(clockInterrupt) {
            cpu.interrupt(clockInterrupt);
        }
        
        clockTicks++;
        
        if(tickRate) setTimeout(clockTick, 1000 / (60 / tickRate));
        else clockTicking = false;
    }
    
    var keyInterrupts = 0;
    var keyboardBuffer = [], keysDown = [];
    var keyMap = {
        8: 0x10,
        13: 0x11,
        45: 0x12,
        46: 0x13,
        38: 0x80,
        40: 0x81,
        37: 0x82,
        39: 0x83,
        16: 0x90,
        17: 0x91
    };
    var pressListeners = [
        0x10,
        0x11,
        0x12,
        0x13
    ];
    var keyboard = {
        id: 0x30cf7406,
        version: 1,
        manufacturer: 0,
        onInterrupt: function(callback) {
            switch(cpu.mem.a) {
                case 0:
                    keyboardBuffer = [];
                    break;
                
                case 1:
                    var k = keyboardBuffer.shift() || 0;
                    cpu.set('c',  k);
                    break;
                    
                case 2:
                    cpu.set('c', Number(keysDown[cpu.mem.b] !== 0));
                    break;
                    
                case 3:
                    keyInterrupts = cpu.mem.b;
                    break;
            }
        }
    };
    devices.push(keyboard);
    
    function keyEvent(key) {
        if(keyInterrupts) {
            cpu.interrupt(keyInterrupts);
        }
    }
    
    $(document).keydown(function(e) {
        if(cpu.running && e.target.nodeName !== 'INPUT' && e.target.nodeName !== 'TEXTAREA') {
            var key = keyMap[e.which] || e.which;
            keysDown[key] = Date.now();
            
            if(pressListeners.indexOf(key) !== -1) keyboardBuffer.push(key);
            keyEvent(key);
            
            if(e.which >= 37 && e.which <= 40 || e.which === 8) e.preventDefault();
        }
    });
    
    $(document).keyup(function(e) {
        if(cpu.running && e.target.nodeName !== 'INPUT' && e.target.nodeName !== 'TEXTAREA') {
            var key = keyMap[e.which] || e.which;
            keysDown[key] = 0;
            
            keyEvent(key);
        }
    });
    
    $(document).keypress(function(e) {
        if(cpu.running && e.target.nodeName !== 'INPUT' && e.target.nodeName !== 'TEXTAREA') {
            var key = keyMap[e.which] || e.which;
            keyboardBuffer.push(key);
            keyEvent(key);
            e.preventDefault();
        }
    });
    
    function pressLoop() {
        if(cpu.running) {
            var now = Date.now();
            for(var i = 0; i < pressListeners.length; i++) {
                if(keysDown[pressListeners[i]] && now - keysDown[pressListeners[i]] > 500) keyboardBuffer.push(pressListeners[i]);
            }
        }
        setTimeout(pressLoop, 100);
    }
    pressLoop();

    var sped = new SPED3(document.getElementById('sped3'));
    var onDraw = function() {
        if(!spedClicked && $('#sped3').css('display') === 'none') {
            $('#sped3').css('display', 'block');
            $('#show-sped').addClass('active');
        }
        sped.offDraw(onDraw);
    };
    sped.onDraw(onDraw);
    devices.push(sped);
    
    while(devices.length > 0) {
        var index = Math.floor(Math.random() * devices.length);
        cpu.addDevice(devices[index]);
        devices.splice(index, 1);
    }
    
    function compile() {
        $('#error').hide();
        editor.setLineClass(errorLine, null, null);

        var code = editor.getValue();
        reset();
        assembler = new DCPU16.Assembler(cpu);
        try {
            assembler.compile(code);
            addressMap = assembler.addressMap;
            instructionMap = assembler.instructionMap;
            notRun = true;
            return true;
        } catch(e) {
            $('#error strong').text('Assembler error: ');
            $('#error span').text(e.message);

            try {
                errorLine = editor.setLineClass(assembler.instructionMap[assembler.instruction - 1] - 1, null, 'errorLine');
            } catch(e) {}

            $('#error').show();
            return false;
        }
    }

    function reset() {
        cpu.stop();
        $('#debug').removeClass('disabled');
        $('#step').removeClass('disabled');
        $('#run').removeClass('disabled');
        $('#reset').removeClass('disabled');
        cpu.clear();
        screen.clear();
        sped.reset();
        
        keyInterrupts = false;
        keyboardBuffer = [];
        keysDown = [];
        
        editor.setLineClass(pcLine, null, null);
        editor.setLineClass(errorLine, null, null);
    }
    
    function drawDebug() {
        if($('#debug').hasClass('active')) {
            try {
                stepped = false;
                   
                $('#debugDump').val(cpu.getDump());
                    
                editor.setLineClass(pcLine, null, null);
                pcLine = editor.setLineClass(assembler.instructionMap[assembler.addressMap[cpu.mem.pc]] - 1, null, 'pcLine');
            } catch(e) {
                
            }
        }
    }
    
    var pcLine = 0, errorLine = 0;
    var lastRam, stepped = false;
    function debugLoop() {
        drawDebug();
       setTimeout(debugLoop, 250);
    }
    //debugLoop();
    
    cpu.onEnd(end);
    function end() {
        $('#debug').removeClass('disabled');
        $('#step').removeClass('disabled');
        $('#reset').removeClass('disabled');
        $('#run').removeClass('disabled');
        $('#run span').text('Run');
    }

    $('#run').click(function() {
        if(!$(this).hasClass('disabled')) {
            if(compile()) {
                notRun = false;
                $('#step').addClass('disabled');
                $('#run').addClass('disabled');
                $('#run span').text('Running...');
                $('#reset').addClass('disabled');
                try {
                    cpu.run();
                } catch(e) {
                   runtimeError(e);
                   console.log(e);
                }
            }
        }
    });

    var lemClicked = false;
    $('#show-lem').click(function() {
        lemClicked = true;
        $('#show-lem').toggleClass('active');

        if(!$('#show-lem').hasClass('active')) {
            $('#canvas').css('display', 'none');
        } else {
            $('#canvas').css('display', 'block');
        }
    });

    var spedClicked = false;
    $('#show-sped').click(function() {
        spedClicked = true;
        $('#show-sped').toggleClass('active');
        if(!$('#show-sped').hasClass('active')) {

            $('#sped3').css('display', 'none');
        } else {
            $('#sped3').css('display', 'block');
        }
    });
    
    function runtimeError(e) {
        $('#error strong').text('Runtime error: ');
        $('#error span').text(e.message);
        errorLine = editor.setLineClass(assembler.instructionMap[
            assembler.addressMap[cpu.mem.pc] - 1], null, 'errorLine');
        $('#error').show();
        end();
    }

    $('#stop').click(function() {
        if(!$(this).hasClass('disabled'))
            cpu.stop();
    });
    
    $('#debug').click(function() {
        if(!$('#debug').hasClass('active')) {
            $('#debugIcon').removeClass('icon-chevron-down');
            $('#debugIcon').addClass('icon-chevron-up');
            $('#debugger').collapse('show');
            $('#debugger').css('height', 'auto');
            if(!cpu.running) compile();
        } else {
            $('#debugIcon').removeClass('icon-chevron-up');
            $('#debugIcon').addClass('icon-chevron-down');
            $('#debugger').collapse('hide');
        }
    });

    $('#reset').click(function() {
        if(!$(this).hasClass('disabled')) {
            reset();
            compile();
         }
    });

    $('#step').click(function() {
        if(!$(this).hasClass('disabled')) {
            try {
                cpu.step();
            } catch(e) {
                runtimeError(e);
            }
            stepped = true;
            drawDebug();
        }
    });
    
    $('#info').click(function() {
        if(!$('#info').hasClass('active')) {
            $('#info i').removeClass('icon-chevron-down');
            $('#info i').addClass('icon-chevron-up');
            $('#savePanel').collapse('show');
        } else {
            $('#info i').removeClass('icon-chevron-up');
            $('#info i').addClass('icon-chevron-down');
            $('#savePanel').collapse('hide');
        }
    });
    
    $('#save').click(function() {
        var data = {
            title: $('#saveTitle').val(),
            author: $('#saveAuthor').val(),
            description: $('#saveDescription').val(),
            password: $('#savePassword').val(),
            code: window.editor.getValue(),
            id: $('#saveId').val()
        };
        if($('#saveFork')) data.fork = $('#saveFork').val();
        $.post('/', data, function(data) {
            window.location = data;
        }, 'text').error(function() {
            $('#saveAlert').show();
        });
    });
});
