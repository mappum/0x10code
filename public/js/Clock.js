(function(window){
    function Clock(container) {
        this.id = 0x12d0b402;
        this.version = 1;
        this.manufacturer = 0;

        this.reset();

        this.tick = this.tick.bind(this);
    }
    
    Clock.prototype.onConnect = function(cpu) {
        this.cpu = cpu;
    };
    
    Clock.prototype.onInterrupt = function(callback) {
        switch(this.cpu.mem.a) {
            case 0:
                if(this.cpu.mem.b) {
                    this.ticks = 0;
                    this.tickRate = this.cpu.mem.b;
                    if(!this.ticking) this.tick();
                } else {
                    this.tickRate = 0;
                }
                break;
                
            case 1:
                this.cpu.mem.c = this.ticks;
                break;
            
            case 2:
                this.interrupt = this.cpu.mem.b;
                break;
        }
        callback();
    };

    Clock.prototype.tick = function() {
        this.ticking = true;
        this.ticks++;
        
        if(this.interrupt !== 0) {
            this.cpu.interrupt(this.interrupt);
        }
        
        if(this.tickRate) setTimeout(this.tick, 1000 / (60 / this.tickRate));
        else this.clockTicking = false;
    };

    Clock.prototype.reset = function() {
        this.ticks = 0;
        this.tickRate = 1;
        this.ticking = false;
        this.interrupt = 0;
    };

    window.Clock = Clock;
})(window);
