(function(window) {
    var keyMap = {
        8: 0x10,  /* Backspace   */
        13: 0x11, /* Return      */
        45: 0x12, /* Insert      */
        46: 0x13, /* Delete      */
        38: 0x80, /* Up Arrow    */
        40: 0x81, /* Down Arrow  */
        37: 0x82, /* Left Arrow  */
        39: 0x83, /* Right Arrow */
        16: 0x90, /* Shift       */
        17: 0x91  /* Control     */
    };
    var pressListeners = [
        0x10,
        0x11,
        0x12,
        0x13,
        0x80,
        0x81,
        0x82,
        0x83
    ];

    function Keyboard(container) {
        this.id = 0x30cf7406;
        this.version = 1;
        this.manufacturer = 0;

        this.buffer = [];
        this.keysDown = [];
        this.keyInterrupt = 0;

        this.pressLoop = this.pressLoop.bind(this);
    }
    
    Keyboard.prototype.onConnect = function(cpu) {
        this.cpu = cpu;
    
        $(document).keydown(function(e) {
            if(this.cpu.running && e.target.nodeName !== 'INPUT' && e.target.nodeName !== 'TEXTAREA') {
                var key = keyMap[e.which] || e.which;
                
                /* Visible keys are in these locations         */
                /*        key ==  32 - space                   */
                /*  48 <= key <=  90 - numbers and letters     */
                /*  96 <= key <= 111 - num pad and its symbols */
                /* 186 <= key <= 192 - ;=,-./`                 */
                /* 219 <= key <= 222 - [\]'                    */
                /* They are buffered by the keypress function  */
                if ((key === 32) || 
                   (( 48 <= key) && (key <= 90))  ||
                   (( 96 <= key) && (key <= 111)) ||
                   ((186 <= key) && (key <= 192)) ||
                   ((219 <= key) && (key <= 222))){
                    
                    // Record the keydown event, but wait to buffer
                    this.keysDown[key] = Date.now();
                }
                else if( keyMap[e.which]) {
                    /* These special keys are buffered now and */
                    /* will not call the keypress function.    */
                    // Record the keydown event and buffer now
                    this.keysDown[key] = Date.now();
                    this.buffer.push(key);
                    this.keyEvent(key);
                    // Prevents the keypress function  
                    e.preventDefault();
                }
                /* Keys of interest in the future */
                /*   9 Tab              */
                /*  18 Alt              */
                /*  19 Pause/Break      */
                /*  20 Caps Lock        */
                /*  27 Escape           */
                /*  33 Page Up          */
                /*  34 Page Down        */
                /*  35 End              */
                /*  36 Home             */
                /*  91 Left Window Key  */
                /*  92 Right Window Key */
                /*  93 Select Key       */
                /* 112 .. 123 F1 - F12  */
                /* 144 Num Lock         */
                /* 145 Scroll Lock      */

            }
        }.bind(this));
        
        $(document).keyup(function(e) {
            if(this.cpu.running && e.target.nodeName !== 'INPUT' && e.target.nodeName !== 'TEXTAREA') {
                /* Only keyup those keys which were down in   */
                /* the first place.                           */
                /* See keydown for an explination of what key */
                /* are considered important.                  */
                var key = keyMap[e.which] || e.which;
                if ((key === 32) || 
                   (( 48 <= key) && (key <= 90))  ||
                   (( 96 <= key) && (key <= 111)) ||
                   ((186 <= key) && (key <= 192)) ||
                   ((219 <= key) && (key <= 222)) ||
                    keyMap[e.which]){
                    
                    this.keysDown[key] = 0;
                    this.keyEvent(key);
                }
            }
        }.bind(this));
        
        $(document).keypress(function(e) {
            if(this.cpu.running && e.target.nodeName !== 'INPUT' && e.target.nodeName !== 'TEXTAREA') {
                /* keyMap is only needed for nonvisible characters  */
                /* and this function is only for visible characters */
                var key = e.which;
                this.buffer.push(key);
                this.keyEvent(key);
                e.preventDefault();
            }
        }.bind(this));

        this.pressLoop();
    };
    
    Keyboard.prototype.onInterrupt = function(callback) {
        switch(this.cpu.mem.a) {
            case 0:
                this.buffer = [];
                break;
            
            case 1:
                var k = this.buffer.shift() || 0;
                this.cpu.set('c',  k);
                break;
                
            case 2:
                this.cpu.set('c', Number(this.keysDown[this.cpu.mem.b] !== 0));
                break;
                
            case 3:
                this.keyInterrupt = this.cpu.mem.b;
                break;
        }
        callback();
    };

    Keyboard.prototype.keyEvent = function(key) {
        if(this.keyInterrupt) {
            this.cpu.interrupt(this.keyInterrupt);
        }
    };

    Keyboard.prototype.pressLoop = function() {
        if(this.cpu.running) {
            var now = Date.now();
            for(var i = 0; i < pressListeners.length; i++) {
                if(this.keysDown[pressListeners[i]] && now - this.keysDown[pressListeners[i]] > 500) this.buffer.push(pressListeners[i]);
            }
        }
        setTimeout(this.pressLoop, 10);
    };

    window.Keyboard = Keyboard;
})(window);
