import {Observable, Subject} from 'rxjs';
import AWS from 'aws-sdk';
import {ManagedUpload} from 'aws-sdk/clients/s3';

import {FileService} from './file.service';
import {ManagedFile, ManagedFileStatus} from './managed-file';
import {FileEvent, FileEventType} from './file-event';
import {Injectable} from '@angular/core';

@Injectable()
export class S3FileService implements FileService {

    private _currentUpload: ManagedUpload = null;
    private _currentFile: ManagedFile = null;
    private _cancelUpload: boolean = false;

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

        this.bucket.deleteObject(params, function (err, data) {
            retSubject.next(new FileEvent(FileEventType.FILE_DELETE_END, file));
            if (err) {
                file.status = ManagedFileStatus.UPLOADED;
            } else {
                file.status = ManagedFileStatus.DELETED;
                retSubject.next(new FileEvent(FileEventType.FILE_DELETE_SUCCESS, file));
            }
            retSubject.complete();
        });

        return retSubject;
    }

    uploadFile(file: ManagedFile, path: string, options: any): Observable<FileEvent> {
        const retSubject = new Subject<FileEvent>();

        // Allows to pass s3 bucket multipart upload options
        let uploadOptions = [];

        if (options && options.options) {
            uploadOptions = options.options;
        }

        file.status = ManagedFileStatus.UPLOADING;

        this._currentFile = file;

        const binaryContent = file.getBinaryContent();
        const params: any = {
            Bucket: this._bucketName,
            Key: path,
            Body: binaryContent,
            ContentLength: binaryContent.size,
            ContentType: file.mimeType,
            ACL: file.public ? 'public-read' : 'private',
            StorageClass: file.storageClass
        };

        if (file.originalName) {
            //We need to encode UFT8 to avoid error with special chars
            params.Metadata = {originalName: encodeURIComponent(file.originalName)};
        }
        // Override default values
        Object.assign(params, options);

        let start: boolean = true;

        this._currentUpload = this.bucket.upload(params, uploadOptions);
        this._currentUpload.on('httpUploadProgress', evt => {
            if (start) {
                retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_START, file));
                start = false;
            }
            file.uploadedPercentage = Math.floor(evt.loaded * 100 / evt.total);
            file.uploadedBytes = evt.loaded;
            retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_PROGRESS, file));
        }).send((err, data) => {
            if (err) {
                file.status = ManagedFileStatus.LOADED;
                if (this._cancelUpload) {
                    retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_CANCELED, this._currentFile));
                    this._cancelUpload = false;
                } else {
                    retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_FAILED, file));
                    retSubject.error(err);
                }
            } else {
                file.uploadedPercentage = 100;
                file.uploadedBytes = file.size;
                file.uri = data.Location;
                file.status = ManagedFileStatus.UPLOADED;
                retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_SUCCESS, file));
                retSubject.complete();
            }
        });

        return retSubject;
    }

    cancelUpload() {
        this._cancelUpload = true;
        this._currentUpload.abort();
    }

    private get bucket() {
        const configObject = Object.assign({
            credentials: new AWS.Credentials({
                accessKeyId: this._accessKeyId,
                secretAccessKey: this._secretAccessKey
            }),
            region: this._region,
            sslEnabled: true,
            signatureVersion: 'v4',
            apiVersion: 'latest',
        }, this._awsConfig);

        const config = new AWS.Config(configObject);

        AWS.config.update(config);

        return new AWS.S3();
    }

}
