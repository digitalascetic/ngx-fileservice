import { Md5 } from 'ts-md5/dist/md5';

export enum ManagedFileStatus {
    LOADED,
    UPLOADING,
    UPLOADED,
    DELETING,
    DELETED
}

export class ManagedFile {

    private _name: string;

    private _originalName: string;

    private _uri: string;

    private _size: number;

    private _mimeType: string;

    private _public: boolean;

    private _storageClass: string;

    private _uploadPercentage: number = 0;

    private _status: ManagedFileStatus = null;

    constructor(uri: string, name: string, mimeType?: string) {
        this._mimeType = mimeType;
        this._originalName = name;
        this._uri = uri;
        this._public = false;
        this._storageClass = null;
        this._size = null;
        this.regenerateName();
    }

    getFileExtension(): string {
        let ext: string = '';
        if (this._originalName) {
            ext = this._originalName.substr(this._originalName.lastIndexOf('.') + 1);
        }
        return ext;
    }

    static bytesToSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        if (bytes === 0) {
            return '0 Byte';
        }

        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
    }

    /**
     *
     */
    private regenerateName(charsNum: number = 16) {
        if (this._uri) {
            let ext: string = this.getFileExtension();

            if (ext && !this._mimeType && this._uri) {
                /**
                 * TODO USE A MIME TYPE LIBRARY TO GET MIME TYPE (CAUTION WITH ANGULAR 6 COMPATIBILITY)
                 * https://github.com/angular/angular-cli/issues/9827#issuecomment-369578814
                 */
                this._mimeType = '';
            }
            this._name = new Md5().appendStr(this._uri).appendStr(new Date().getMilliseconds().toString()).end().toString().substr(0, charsNum);
            this._name = this._name + (ext ? '.' + ext : '');
        } else {
            this._name = new Md5().appendStr(new Date().getMilliseconds().toString()).end().toString().substr(0, charsNum);
        }

        return this._name;
    }

    get name(): string {
        if (!this._name) {
            this.regenerateName();
        }

        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }

    get uri(): string {
        return this._uri;
    }

    set uri(value: string) {
        this._uri = value;
    }

    get size(): number {
        return this._size;
    }

    set size(value: number) {
        this._size = value;
    }

    get mimeType(): string {
        return this._mimeType;
    }

    set mimeType(value: string) {
        this._mimeType = value;
    }

    get originalName(): string {
        return this._originalName;
    }

    set originalName(value: string) {
        this._originalName = value;
    }

    get public(): boolean {
        return this._public;
    }

    set public(value: boolean) {
        this._public = value;
    }

    get storageClass(): string {
        return this._storageClass;
    }

    set storageClass(value: string) {
        this._storageClass = value;
    }

    get uploadPercentage(): number {
        return this._uploadPercentage;
    }

    set uploadPercentage(value: number) {
        this._uploadPercentage = value;
    }

    get status() {
        return this._status;
    }

    set status(value) {
        this._status = value;
    }

    isUriEncoded(): boolean {
        return this._uri && this._uri.substr(0, 5) === 'data:';
    }

    getEncoding(): string {
        if (this.isUriEncoded()) {
            let mimeEnd = this._uri.indexOf(';');
            let contentStart = this._uri.indexOf(',');
            return this._uri.substr(mimeEnd + 1, contentStart - mimeEnd - 1);
        }
        return null;
    }

    getPath(): string {
        let reURLInformation = new RegExp([
            '^(https?:)//', // protocol
            '(([^:/?#]*)(?::([0-9]+))?)', // host (hostname and port)
            '(/{0,1}[^?#]*)'
        ].join(''));
        let match = this._uri.match(reURLInformation);

        return match[5];
    }

    getBinaryContent(): Blob {

        if (!this.getEncodedContent()) {
            return null;
        }

        let contentType = this._mimeType || '';
        let sliceSize = 1024;
        let byteCharacters = atob(this.getEncodedContent());
        let bytesLength = byteCharacters.length;
        let slicesCount = Math.ceil(bytesLength / sliceSize);
        let byteArrays = new Array(slicesCount);

        for (let sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
            let begin = sliceIndex * sliceSize;
            let end = Math.min(begin + sliceSize, bytesLength);

            let bytes = new Array(end - begin);
            for (let offset = begin, i = 0; offset < end; ++i, ++offset) {
                bytes[i] = byteCharacters[offset].charCodeAt(0);
            }
            byteArrays[sliceIndex] = new Uint8Array(bytes);
        }

        return new Blob(byteArrays, { type: contentType });

    }

    getEncodedContent(): string {
        let contentStart = this._uri.indexOf(',');
        if (contentStart > 0) {
            return this._uri.substr(contentStart + 1);
        }
        return null;
    }

    static fromClientUpload(uploadedContent: string, name: string): ManagedFile {
        let uri = uploadedContent;
        let mimeStart = uploadedContent.indexOf(':');
        let mimeEnd = uploadedContent.indexOf(';');
        let mimeType = uploadedContent.substr(mimeStart + 1, mimeEnd - mimeStart - 1);
        let managedFile = new ManagedFile(uri, name, mimeType);
        managedFile.status = ManagedFileStatus.LOADED;
        managedFile.uploadPercentage = 0;

        return managedFile;
    }

}
