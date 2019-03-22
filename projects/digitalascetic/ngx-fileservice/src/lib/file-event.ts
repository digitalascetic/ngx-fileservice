import { ManagedFile } from './managed-file';

export enum FileEventType {
    FILE_LOAD,
    FILE_VALIDATION_ERROR,
    FILE_UPLOAD_START,
    FILE_UPLOAD_PROGRESS,
    FILE_UPLOAD_FAILED,
    FILE_UPLOAD_SUCCESS,
    FILE_DELETE_START,
    FILE_DELETE_END,
    FILE_DELETE_SUCCESS,
    FILE_UPLOAD_CANCELED,
}

export class FileEvent {

    private readonly _type: FileEventType;

    private readonly _file: ManagedFile;

    private readonly _message: string;

    private readonly _messageParams: any;

    constructor(type: FileEventType, file: ManagedFile, message?: string, messageParams?: any) {
        this._type = type;
        this._file = file;
        this._message = message;
        this._messageParams = messageParams;
    }

    get type(): FileEventType {
        return this._type;
    }

    get file(): ManagedFile {
        return this._file;
    }

    get message(): string {
        return this._message;
    }

    get messageParams(): any {
        return this._messageParams;
    }

}
