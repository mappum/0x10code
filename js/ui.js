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
    
    function clearScreen() {
    	ctx.fillStyle = getColor(0);
        ctx.fillRect(0, 0, 500, 500);
    };
    
    function getColor(val) {
    	var add = 0,
    		h = (val >> 3),
    		r = ((val >> 2) & 1) * 0xaa,
    		g = ((val >> 1) & 1) * 0xaa,
    		b = ((val >> 0) & 1) * 0xaa;
        if(h) {
          	add = 0x55;
        }
        return 'rgb(' +
            + (r + add) + ','
            + (g + add) + ','
            + (b + add)
            + ')';
    };
    
    var font = [];
    var charWidth = 4, charHeight = 8;
    var charScale = 3;
    (function() {
	    var fontCanvas = document.getElementById('fontCanvas'); 
	    var fontCtx = fontCanvas.getContext('2d');
	    var fontImage = new Image();
	    fontImage.onload = function() {
	    	fontCtx.drawImage(fontImage, 0, 0);
	    	
	    	for(var i = 0; i < charWidth; i++) {
	    		for(var j = 0; j < 32; j++) {
	    			var fontData = fontCtx.getImageData(j * charWidth, i * charHeight, charWidth, charHeight),
	    				charId = (i * 32) + j;
	    				
	    			for(var k = 0; k < charWidth; k++) {
	    				var col = 0;
	    				for(var l = 0; l < charHeight; l++) {
	    					var pixelId = l * charWidth + k;
	    					col |= (((fontData.data[pixelId * charWidth + 1] > 128) * 1) << l);
	    				}
	    				font[(charId * 2) + Math.floor(k/2)] |= (col << (((k+1)%2) * charHeight));
	    			}
	    		}
	    	}
	    	copyFont();
	    };
	    fontImage.src = '/img/font.png';
    })();
    
    function copyFont() {
    	for(var i = 0; i < font.length; i++) {
    		cpu.mem[0x8180 + i] = font[i];
    	}
    };
    
    var canvas = document.getElementById('canvas');     
    var blinkCells = [], cellQueue = [];
    var blinkInterval = 700;
 	var ctx = canvas.getContext('2d');
 	
 	var cols = 32, rows = 12;
 	var borderSize = 6;
 	
 	$('canvas')
 		.attr('width', (charWidth * cols + borderSize * 2) * charScale)
 		.attr('height', (charHeight * rows + borderSize * 2) * charScale);
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
            
            cpu.mem[key+0x8000] = val;
            queueChar(col, row);
            
            if(((val >> 7) & 1) === 1) blinkCells[row][col] = true;
            else blinkCells[row][col] = false;
        },
        get: function(key) {
        	return cpu.mem[key+0x8000];
        }
    });
    
    cpu.mapDevice(0x8180, 256, {
    	set: function(key, val) {
    		cpu.mem[0x8180 + key] = val;
    		
    		for(var i = 0; i < rows; i++) {
    			for(var j = 0; j < cols; j++) {
    				if(cpu.mem[(i * cols + j)] & 0x7f === Math.floor(key / 2)) {
    					queueChar(j, i);
    				}
    			}
    		}
    	},
    	get: function(key) {
    		return cpu.mem[key+0x8180];
    	}
    });
    
    for(var i = 0; i < rows; i++) {
    	cellQueue.push([]);
    	blinkCells.push([]);
    }
    
    function queueChar(x, y) {
    	cellQueue[y][x] = true;
    };
    
    var blinkVisible = false;
    function drawChar(value, x, y) {
    	var charValue = value & 0x7f,
    		fg = getColor((value >> 12) & 0xf),
            bg = getColor((value >> 8) & 0xf),
            blink = ((value >> 7) & 1) === 1;
    	var fontChar = [cpu.mem[0x8180+charValue * 2], cpu.mem[0x8180+charValue * 2 + 1]];
		
		ctx.fillStyle = bg;
		ctx.fillRect((x * charWidth + borderSize) * charScale,
			(y * charHeight + borderSize) * charScale,
			charWidth * charScale, charHeight * charScale);
		
		if(!(blink && !blinkVisible)) {
			for(var i = 0; i < charWidth; i++) {
				var word = fontChar[(i >= 2) * 1];
				var hword = (word >> (!(i%2) * 8)) & 0xff;
	
				for(var j = 0; j < charHeight; j++) {				
					var pixel = (hword >> j) & 1;
					
					if(pixel){
						ctx.fillStyle = fg;
						ctx.fillRect((x * charWidth + i + borderSize) * charScale,
							(y * charHeight + j + borderSize) * charScale,
							charScale, charScale);
					}
				}
			}
		}
    };
    
    function drawLoop() {
    	if(cpu.running) {
    		for(var i = 0; i < rows; i++) {
    			for(var j = 0; j < cols; j++) {
    				var cell = cellQueue[i][j];
    				if(cell) {
    					drawChar(cpu.mem[0x8000 + (i * cols) + j], j, i);
    					cellQueue[i][j] = false;
    				}
    			}
    		}
    	}
    	if(window.requestAnimationFrame) window.requestAnimationFrame(drawLoop);
    	else setTimeout(drawLoop, 16);
    };
    drawLoop();
    
    function blinkLoop() {
    	if(cpu.running) {
    		blinkVisible = !blinkVisible;
    		for(var i = 0; i < rows; i++) {
    			for(var j = 0; j < cols; j++) {
    				if(blinkCells[i][j]) {
    					queueChar(j, i);
    				}
    			}
    		}
    	} else {
    		blinkVisible = false;
    	}
    	setTimeout(blinkLoop, blinkInterval);
    };
    blinkLoop();
    
    cpu.mapDevice(0x8280, 1, {
    	set: function(key, val) {
    		cpu.mem[0x8280 + key] = val;
    		
    		var width = (charWidth * cols + borderSize * 2) * charScale,
    			height = (charHeight * rows + borderSize * 2) * charScale;
    		ctx.fillStyle = getColor(val & 0xf);
    		ctx.fillRect(0, 0, width, borderSize * charScale);
    		ctx.fillRect(0, height - borderSize * charScale, width, borderSize * charScale);
    		ctx.fillRect(0, 0, borderSize * charScale, height);
    		ctx.fillRect(width - borderSize * charScale, 0, borderSize * charScale, height);
    	},
    	get: function(key) {
    		return cpu.mem[0x8280 + key];
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
        copyFont();
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
