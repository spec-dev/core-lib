export class QueryError extends Error {
    constructor(op: string, table: string, errorOrMessage: any) {
        const name = 'Query Error'
        super(`(op=${op}; table=${table}: ${errorOrMessage?.message || errorOrMessage}`)
        this.name = name
    }
}
