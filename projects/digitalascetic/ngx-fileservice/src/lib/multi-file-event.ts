import { Md5 } from 'ts-md5/dist/md5';

import { ManagedFile, ManagedFileStatus } from './managed-file';

export enum MultiFileEventType {
    LOAD,
    VALIDATION_ERROR,
    UPLOAD_START,
    UPLOAD_PROGRESS,
    UPLOAD_END,
    DELETE_START,
    DELETE_END
}

export class MultiFileEvent {

    private readonly _id: string;

    private readonly _type: MultiFileEventType;

    private readonly _files: ManagedFile[];

    private readonly _message: string;

    constructor(type: MultiFileEventType, files: ManagedFile[], message?: string, id?: string) {
        this._type = type;
        this._files = files;
        this._id = id || new Md5().appendStr(new Date().getDate().toString()).appendStr((Math.random() * 1000000000).toString()).end().toString();
        this._message = message;
    }

    get id(): string {
        return this._id;
    }

    get type(): MultiFileEventType {
        return this._type;
    }

    get files(): ManagedFile[] {
        return this._files;
    }

    get message(): string {
        return this._message;
    }

    getUploadingFile(): number {
        let count = 0;
        this._files.forEach((file: ManagedFile) => {
            if (file.status === ManagedFileStatus.UPLOADING) {
                count++;
            }
        });

        return count;
    }

    getUploadedFile(): number {
        let count = 0;
        this._files.forEach((file: ManagedFile) => {
            if (file.status === ManagedFileStatus.UPLOADED) {
                count++;
            }
        });

        return count;
    }

    getUploadProgress(): number {
        let total = this._files.length * 100;
        let progress = 0;
        this._files.forEach((file: ManagedFile) => {
            progress = progress + file.uploadedPercentage;
        });

        return Math.floor(progress / total);
    }

}