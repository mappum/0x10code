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
    var pcLine = 0, errorLine = 0;
    
    function getColor(nibble) {
    	return 'rgba(' + (((nibble>>2)&1)*255)
    		+ ',' + (((nibble>>1)&1)*255)
    		+ ',' + ((nibble&1)*255)
    		+ ',' + '1'//((nibble>>3)&1)
    		+ ')';
    };
    
    function clearScreen() {
    	ctx.clearRect(0, 0, 500, 500);
    };
    
    var canvas = document.getElementById('canvas');  
 	var ctx = canvas.getContext('2d');
 	var spaceX = 12, spaceY = 17;
 	var cols = 32, rows = 16;
 	$('canvas').attr('width', spaceX * cols).attr('height', spaceY * rows);
 	ctx.font = '16px monospace';
 	var cellPadding = 1;
    cpu.mapDevice(0x8000, cols * rows, {
        set: function(key, val) {
            var row = Math.floor(key / cols), col = key % cols;
            var character = String.fromCharCode(val & 0x7f)
            	.replace(' ', ' ')
            	.replace('\n', ' ')
            	.replace('\r', ' ')
            	.replace('\0', ' ');
            var fg = getColor((val >> 12) ^ 0xf), bg = getColor((val >> 8) & 0xf);
            
            if((val >> 8) & 0x7) {
            	ctx.fillStyle = bg;
            	ctx.fillRect(col * spaceX, row * spaceY, spaceX, spaceY);
            } else {
            	ctx.clearRect(col * spaceX, row * spaceY, spaceX, spaceY);
            }

			ctx.fillStyle = fg;
	 		ctx.fillText(character, col * spaceX + cellPadding, (row+1) * spaceY - 4);
 			 
            cpu.mem[key+0x8000] = val;
        },
        get: function(key) {
        	return cpu.mem[key+0x8000];
        }
    });
    
 
    var keyPointer = 0, inputBufferSize = 0xf, inputAddress = 0x9000;
    cpu.mapDevice(inputAddress, inputBufferSize + 1, {
    	get: function(key) {
    		return cpu.mem[inputAddress+key];
    	},
    	set: function(key, value) {
    		cpu.mem[inputAddress+key] = value;
    	}
    });
    
    function handleKey(keyCode) {
    	if(cpu.running) {
	    	if(!cpu.mem[inputAddress + keyPointer]) {
	    		cpu.mem[inputAddress + keyPointer] = (keyCode === 0xd ? 0xa : keyCode);
	    		cpu.mem[inputAddress + inputBufferSize + 1] = inputAddress + keyPointer;
	    		keyPointer++;
	    		keyPointer &= 0xf;
	    	};
	    }
    };
    
    var handledKeys = [
    	8,
    	32,
    	37, 38, 39, 40
    ];
    $('body').keydown(function(e) {
    	if(cpu.running && handledKeys.indexOf(e.which) !== -1) {
			handleKey(e.which);
	    	return false;
    	}
    });
    $('body').keypress(function(e) {
    	if(cpu.running && handledKeys.indexOf(e.which) === -1) {
    		handleKey(e.which);
    	}
    });

    cpu.onEnd(function() {
        $('#debug').removeClass('disabled');
        $('#step').removeClass('disabled');
        $('#reset').removeClass('disabled');
        $('#run').removeClass('disabled');
        $('#run span').text('Run');
    });
    
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
            if(assembler.instructionMap[assembler.instruction]) {
            	errorLine = editor.setLineClass(assembler.instructionMap[assembler.instruction] - 1, null, 'errorLine');
            }
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
        clearScreen();
        keyPointer = 0;
        
        editor.setLineClass(pcLine, null, null);
        editor.setLineClass(errorLine, null, null);
    }
    
    var debugMs = 16, lastDebug = 0;
    function debugLoop() {
	    editor.setLineClass(pcLine, null, null);
	    pcLine = editor.setLineClass(assembler.instructionMap[assembler.addressMap[cpu.mem.pc]] - 1, null, 'pcLine');
	    
	    $('#memoryInfo').empty();
	    
	    function updateRegister(name) {
	    	$('#' + name + ' .val').text(DCPU16.formatWord(cpu.mem[name]));
	    	$('#' + name + ' .point').text(DCPU16.formatWord(cpu.mem[cpu.mem[name]]));
	    }
	    
	    for(var i = 0; i < DCPU16.registerNames.length; i++) {
	    	updateRegister(DCPU16.registerNames[i]);
	    }
	    updateRegister('pc');
	    updateRegister('o');
	    
	    $('#sp .val').text(DCPU16.formatWord(cpu.mem.stack));
	    $('#sp .point').text(DCPU16.formatWord(cpu.mem[cpu.mem.stack]));
	    
	    $('div.tooltip').remove();
	    
	    for(var i = 0; i < cpu.ramSize; i += 8) {
            populated = false;
            for( j = 0; j < 8; j++) {
                if(cpu.mem[i + j] || cpu.mem.pc === i + j || cpu.mem.stack === i + j) {
                    populated = true;
                    break;
                }
            }

            if(populated) {
                var row = $('<tr></tr>');
                
				row.append('<td><strong>' + DCPU16.formatWord(i + j) + '</strong></td>');
                for(var j = 0; j < 8; j++) {
                	var cell = $('<td> ' + DCPU16.formatWord(cpu.mem[i + j]) + '</a></td>');
                	cell.tooltip({
                		title: editor.getLine(instructionMap[addressMap[j+i]] - 1)
                	});
                	row.append(cell);
                }
                
                $('#memoryInfo').append(row);
            }
        }
        
        $('#cycle').text(cpu.cycle);
    }

    $('#run').click(function() {
        if(!$(this).hasClass('disabled')) {
            if(compile()) {
            	debugLoop();
            	notRun = false;
                cpu.run(function() {
                	if($('#debug').hasClass('active')) {
	                	var now = new Date().getTime();
	                	if(now - lastDebug >= debugMs) {
	                		lastDebug = now;
	                		debugLoop();
	                	}
                	}
                });
                $('#step').addClass('disabled');
                $('#run').addClass('disabled');
                $('#run span').text('Running...');
                $('#reset').addClass('disabled');
            }
        }
    });

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
            cpu.loopBatch = 50;
        } else {
            $('#debugIcon').removeClass('icon-chevron-up');
            $('#debugIcon').addClass('icon-chevron-down');
            $('#debugger').collapse('hide');
            cpu.loopBatch = 1000;
        }
    });

    $('#reset').click(function() {
        if(!$(this).hasClass('disabled')) {
            reset();
            compile();
            debugLoop();
         }
    });

    $('#step').click(function() {
        if(!$(this).hasClass('disabled')) {
            cpu.step();
            debugLoop();
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
