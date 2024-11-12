import {Observable, Subject} from 'rxjs';
import {
    S3Client,
    S3ClientConfig,
    DeleteObjectCommand,
    PutObjectCommandInput,
    StorageClass,
    ObjectCannedACL,
    PutObjectCommand
} from '@aws-sdk/client-s3';
import {XhrHttpHandler} from '@aws-sdk/xhr-http-handler';
import {FileService} from './file.service';
import {ManagedFile, ManagedFileStatus} from './managed-file';
import {FileEvent, FileEventType} from './file-event';

export class S3FileService implements FileService {
    private _currentFile: ManagedFile = null;
    private _cancelUpload: boolean = false;
    private _abortController: AbortController = new AbortController();

    constructor(
        private _bucketName: string,
        private _accessKeyId: string,
        private _secretAccessKey: string,
        private _region: string,
        private _awsConfig: object = {}
    ) {
    }

    deleteFile(file: ManagedFile, options: any): Observable<FileEvent> {
        const retSubject: Subject<FileEvent> = new Subject<FileEvent>();

        file.status = ManagedFileStatus.DELETING;
        retSubject.next(new FileEvent(FileEventType.FILE_DELETE_START, file));

        const params = {
            Bucket: this._bucketName,
            Key: file.uri
        };
        // Override default values
        Object.assign(params, options);

        const command = new DeleteObjectCommand(params);

        this.bucket().send(command, {
            abortSignal: this._abortController.signal
        })
            .then(() => {
                file.status = ManagedFileStatus.DELETED;
                retSubject.next(new FileEvent(FileEventType.FILE_DELETE_SUCCESS, file));
                retSubject.complete();
            })
            .catch(err => {
                file.status = ManagedFileStatus.UPLOADED;
            });

        file.status = ManagedFileStatus.DELETING;
        retSubject.next(new FileEvent(FileEventType.FILE_DELETE_START, file));

        return retSubject;
    }

    uploadFile(file: ManagedFile, path: string, options: any): Observable<FileEvent> {
        const retSubject = new Subject<FileEvent>();

        // Allows to pass s3 bucket multipart upload options
        let uploadOptions: any = {};

        if (options && options.options) {
            uploadOptions = options.options;
        }

        file.status = ManagedFileStatus.UPLOADING;

        this._currentFile = file;

        const binaryContent = file.getBinaryContent();

        let storageClass: StorageClass;

        switch (file.storageClass) {
            case ManagedFile.GLACIER:
                storageClass = StorageClass.GLACIER;
                break;
            case ManagedFile.STORAGE_STANDARD_IA:
                storageClass = StorageClass.STANDARD_IA;
                break;
            case ManagedFile.STORAGE_REDUCED_REDUNDANCY:
                storageClass = StorageClass.REDUCED_REDUNDANCY;
                break;
            default:
                storageClass = StorageClass.STANDARD;
        }

        const params: PutObjectCommandInput = {
            Bucket: this._bucketName,
            Key: path,
            Body: binaryContent,
            ContentLength: file.size,
            ContentType: file.mimeType,
            ACL: file.public ? ObjectCannedACL.public_read : ObjectCannedACL.private,
            StorageClass: storageClass
        };

        if (file.originalName) {
            //We need to encode UFT8 to avoid error with special chars
            params.Metadata = {originalName: encodeURIComponent(file.originalName)};
        }
        // Override default values
        Object.assign(params, options);

        const requestHandler = new XhrHttpHandler({});

        requestHandler.on(XhrHttpHandler.EVENTS.UPLOAD_PROGRESS, progress => {
            file.uploadedPercentage = Math.floor(progress.loaded * 100 / progress.total);
            file.uploadedBytes = progress.loaded;
            retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_PROGRESS, file));
        });

        const command = new PutObjectCommand(params);

        this.bucket(requestHandler).send(command, {
            abortSignal: this._abortController.signal
        })
            .then(() => {
                file.uploadedPercentage = 100;
                file.uploadedBytes = file.size;
                file.uri = `https://${this._bucketName}.s3.${this._region}.amazonaws.com/${path}`;
                file.status = ManagedFileStatus.UPLOADED;
                retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_SUCCESS, file));
                retSubject.complete();
            })
            .catch(err => {
                file.status = ManagedFileStatus.LOADED;
                if (this._cancelUpload) {
                    retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_CANCELED, this._currentFile));
                    this._cancelUpload = false;
                } else {
                    retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_FAILED, file));
                    retSubject.error(err);
                }
            });

        return retSubject;
    }

    cancelUpload() {
        this._cancelUpload = true;
        this._abortController.abort();
    }

    private bucket(requestHandler?: XhrHttpHandler): S3Client {
        const configObject: S3ClientConfig = Object.assign({
            credentials: {
                accessKeyId: this._accessKeyId,
                secretAccessKey: this._secretAccessKey
            },
            region: this._region,
            apiVersion: 'latest'
        }, this._awsConfig);

        if (requestHandler) {
            configObject.requestHandler = requestHandler;
        }

        return new S3Client(configObject);
    }

}
