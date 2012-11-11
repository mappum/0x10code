$(function() {
    var editor_updated = true;
    var initial_mem = [];

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
	onChange: function() {
            editor_updated = true;
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
    
    var clock = new Clock();
    devices.push(clock);

    var keyboard = new Keyboard();
    devices.push(keyboard);

    var drive = new M35FD();
    devices.push(drive);
    drive.insert(new Disk());

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
	if(editor_updated) {
            editor_updated = false;

            $('#error').hide();
            editor.setLineClass(errorLine, null, null);

            var code = editor.getValue();
            reset();
            switch($("#assembler").val()) {
                case "0x10code":
                    assembler = new DCPU16.Assembler(cpu);
                    try {
                        assembler.compile(code);
                        addressMap = assembler.addressMap;
                        instructionMap = assembler.instructionMap;
                        notRun = true;
			initial_mem = cpu.mem.slice();
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
                    break;
                case "dcputoolchain":
                    var data = {
                        assembler: 'dcputoolchain',
                        file:       code
                    };
                    $.ajax({
                        type: 'POST',
                        url:  '/assemble',
                        data: data,
                        success: function(binary){
                            for(i = 0; i < binary.bytes.length; i++) {
                                cpu.mem[i] = binary.bytes[i];
                            }
			    initial_mem = binary.bytes.slice();
                        },
                        dataType: 'json',
                        async: false
                    });
                    return true;
                    break;
            }
	} else {
	    for(i = 0; i < initial_mem.length; i++) {
                cpu.mem[i] = initial_mem[i];
	    }
	    return true;
	}
    }

    function reset() {
        cpu.stop();
        $('#debug').removeClass('disabled');
        $('#step').removeClass('disabled');
        $('#run').removeClass('disabled');
        $('#reset').removeClass('disabled');
        cpu.reset();
        
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

    $('#assembler').change(function() {
        editor_updated = true;
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
