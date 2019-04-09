import { Md5 } from 'ts-md5/dist/md5';

export enum ManagedFileStatus {
    LOADED,
    UPLOADING,
    UPLOADED,
    DELETING,
    DELETED
}

export class ManagedFile {

    private _id: number;

    private _name: string;

    private _originalName: string;

    private _checksum: string;

    private _uri: string;

    private _size: number;

    private _mimeType: string;

    private _public: boolean;

    private _storageClass: string;

    private _uploadedPercentage: number = 0;

    private _uploadedBytes: number = 0;

    private _status: ManagedFileStatus = null;

    constructor(uri: string, name: string, mimeType: string, id?: number) {
        this._id = id;
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

    get id(): number {
        return this._id;
    }

    set id(value: number) {
        this._id = value;
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

    get checksum(): string {
        return this._checksum;
    }

    set checksum(value: string) {
        this._checksum = value;
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

    get formattedSize(): string {
        return ManagedFile.bytesToSize(this.size);
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

    get uploadedPercentage(): number {
        return this._uploadedPercentage;
    }

    set uploadedPercentage(value: number) {
        this._uploadedPercentage = value;
    }

    get uploadedBytes(): number {
        return this._uploadedBytes;
    }

    set uploadedBytes(value: number) {
        this._uploadedBytes = value;
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
            const mimeEnd = this._uri.indexOf(';');
            const contentStart = this._uri.indexOf(',');

            return this._uri.substr(mimeEnd + 1, contentStart - mimeEnd - 1);
        }

        return null;
    }

    getPath(): string {
        const reURLInformation = new RegExp([
            '^(https?:)//', // protocol
            '(([^:/?#]*)(?::([0-9]+))?)', // host (hostname and port)
            '(/{0,1}[^?#]*)'
        ].join(''));
        const match = this._uri.match(reURLInformation);

        return match[5];
    }

    getBinaryContent(): Blob {

        if (!this.getEncodedContent()) {
            return null;
        }

        const contentType = this._mimeType || '';
        const sliceSize = 1024;
        const byteCharacters = atob(this.getEncodedContent());
        const bytesLength = byteCharacters.length;
        const slicesCount = Math.ceil(bytesLength / sliceSize);
        const byteArrays = new Array(slicesCount);

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
        const contentStart = this._uri.indexOf(',');
        if (contentStart > 0) {
            return this._uri.substr(contentStart + 1);
        }

        return null;
    }

    static fromClientUpload(uploadedContent: string, name: string): ManagedFile {
        const uri = uploadedContent;
        const mimeStart = uploadedContent.indexOf(':');
        const mimeEnd = uploadedContent.indexOf(';');
        const mimeType = uploadedContent.substr(mimeStart + 1, mimeEnd - mimeStart - 1);
        const managedFile = new ManagedFile(uri, name, mimeType);
        managedFile.status = ManagedFileStatus.LOADED;
        managedFile.uploadedPercentage = 0;
        managedFile.uploadedBytes = 0;

        return managedFile;
    }

}
