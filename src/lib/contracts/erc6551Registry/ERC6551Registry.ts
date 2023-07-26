import abi from './abi'
import addresses from './addresses'
import ContractMethod from '../ContractMethod'
import { Address, Abi, AbiItemType } from '../../types'
import { ContractType } from '../types'

class ERC6551Registry {
    protected _chainId: string

    protected _address: Address

    protected _abi: Abi

    protected _methods: { [key: string]: Function }

    constructor(chainId: string | number, address?: Address) {
        this._chainId = chainId.toString()
        this._address = address || addresses[this._chainId]
        if (!this._address) throw `No ERC6551Registry address for chainId ${this._chainId}`
        this._abi = abi
        this._attachMethods()
    }

    private _attachMethods() {
        this._methods = {}
        for (const item of this._abi || []) {
            if (item.type !== AbiItemType.Function) continue
            const method = new ContractMethod(this._chainId, this._address, item)
            this._methods[item.name] = async (...inputs: any[]) => method.call(...inputs)
        }
    }

    /**
     * @param implementation Type: address, Indexed: false
     * @param chainId Type: uint256, Indexed: false
     * @param tokenContract Type: address, Indexed: false
     * @param tokenId Type: uint256, Indexed: false
     * @param salt Type: uint256, Indexed: false
     */
    async account(
        implementation: ContractType.Address,
        chainId: ContractType.Number,
        tokenContract: ContractType.Address,
        tokenId: ContractType.Number,
        salt: ContractType.Number
    ): Promise<ContractType.Address> {
        const { outputArgs } = await this._methods.account(
            implementation,
            chainId.toString(),
            tokenContract,
            tokenId.toString(),
            salt.toString()
        )
        return outputArgs[0]
    }

    /**
     * @param implementation Type: address, Indexed: false
     * @param chainId Type: uint256, Indexed: false
     * @param tokenContract Type: address, Indexed: false
     * @param tokenId Type: uint256, Indexed: false
     * @param salt Type: uint256, Indexed: false
     * @param initData Type: bytes, Indexed: false
     */
    async createAccount(
        implementation: ContractType.Address,
        chainId: ContractType.Number,
        tokenContract: ContractType.Address,
        tokenId: ContractType.Number,
        salt: ContractType.Number,
        initData: ContractType.Bytes
    ): Promise<string> {
        const { outputArgs } = await this._methods.createAccount(
            implementation,
            chainId.toString(),
            tokenContract,
            tokenId.toString(),
            salt.toString(),
            initData
        )
        return outputArgs[0]
    }
}

export default ERC6551Registry
