import { Md5 } from 'ts-md5/dist/md5';

export enum ManagedFileStatus {
    LOADED = 'LOADED',
    UPLOADING = 'UPLOADING',
    UPLOADED = 'UPLOADED',
    DELETING = 'DELETING',
    DELETED = 'DELETED'
}

export class ManagedFile {

    private _id: number;

    private _mimeType: string;

    private _originalName: string;

    private _name: string = null;

    private _path: string = null;

    private _uri: string = null;

    private _size: number = null;

    private _public: boolean = false;

    private _temporary: boolean = false;

    private _storageClass: string = null;

    private _uploadedPercentage: number;

    private _uploadedBytes: number;

    private _uploadedContent: string;

    private _status: ManagedFileStatus = null;

    private _checksum: string = null;


    constructor(name: string, uploadDir: string, mimeType: string, id?: number) {
        this._id = id;
        this._mimeType = mimeType;
        this._originalName = name;
        this._uploadedPercentage = 0;
        this._uploadedBytes = 0;

        this._generateNameAndPath(uploadDir);
    }

    private _generateNameAndPath(uploadDir: string, charsNum: number = 16) {
        let ext: string = this.getFileExtension();

        if (ext && !this._mimeType) {
            /**
             * TODO USE A MIME TYPE LIBRARY TO GET MIME TYPE (CAUTION WITH ANGULAR 6 COMPATIBILITY)
             * https://github.com/angular/angular-cli/issues/9827#issuecomment-369578814
             */
            this._mimeType = '';
        }
        this._name = new Md5().appendStr(new Date().getMilliseconds().toString()).end().toString().substr(0, charsNum);
        this._name = this._name + (ext ? '.' + ext : '');

        this._path = uploadDir + '/' + this._name;

        return this._name;
    }

    get id(): number {
        return this._id;
    }

    set id(value: number) {
        this._id = value;
    }

    get name(): string {
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

    get path(): string {
        return this._path;
    }

    set path(value: string) {
        this._path = value;
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

    get temporary(): boolean {
        return this._temporary;
    }

    set temporary(value: boolean) {
        this._temporary = value;
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

    get checksum(): string {
        return this._checksum;
    }

    set checksum(value: string) {
        this._checksum = value;
    }

    getFileExtension(): string {
        let ext: string = '';
        if (this._originalName) {
            ext = this._originalName.substr(this._originalName.lastIndexOf('.') + 1);
        }

        return ext;
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
        const contentStart = this._uploadedContent.indexOf(',');
        if (contentStart > 0) {
            return this._uploadedContent.substr(contentStart + 1);
        }

        return null;
    }

    static bytesToSize(bytes: number, precision: number = 2, separator: string = '.'): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        if (bytes === 0) {
            return '0 Byte';
        }

        let unit = 0;

        while (bytes >= 1024) {
            bytes /= 1024;
            unit++;
        }

        // Remove decimal part when zero.
        return bytes
            .toFixed(precision)
            .split('.')
            .filter(part => part !== '0'.repeat(precision))
            .join(separator) + ' ' + sizes[unit];
    }

    static fromClientUpload(uploadedContent: string, name: string, uploadDir: string): ManagedFile {
        let mimeStart = uploadedContent.indexOf(':');
        let mimeEnd = uploadedContent.indexOf(';');
        let mimeType = uploadedContent.substr(mimeStart + 1, mimeEnd - mimeStart - 1);
        let managedFile = new ManagedFile(name, uploadDir, mimeType);
        managedFile._uploadedContent = uploadedContent;
        managedFile.checksum = new Md5().appendStr(uploadedContent).end().toString();
        managedFile.status = ManagedFileStatus.LOADED;
        managedFile.uploadedPercentage = 0;
        managedFile.uploadedBytes = 0;

        return managedFile;
    }

}
