class Logger {
    info(...args) {
        console.log(this._prefix(), ...args)
    }

    warn(...args) {
        console.warn(this._prefix(), ...args)
    }

    error(...args) {
        console.error(this._prefix(), ...args)
    }

    _prefix(): string {
        return new Date().toISOString()
    }
}

export const logger = new Logger()
