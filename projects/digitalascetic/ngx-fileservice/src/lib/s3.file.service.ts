import { Observable, Subject } from 'rxjs';
import * as AWS from 'aws-sdk';
import { ManagedUpload } from 'aws-sdk/clients/s3';

import { FileService } from './file.service';
import { ManagedFile, ManagedFileStatus } from './managed-file';
import { FileEvent, FileEventType } from './file-event';

export class S3FileService implements FileService {

    constructor(
        private _bucketName: string,
        private _accessKeyId: string,
        private _secretAccessKey: string,
        private _region: string
    ) {
    }

    deleteFile(file: ManagedFile, options: any): Observable<FileEvent> {
        let params = {
            Bucket: this._bucketName,
            Key: file.getPath().substr(1)
        };

        // Override default values
        Object.assign(params, options);

        let retSubject: Subject<FileEvent> = new Subject<FileEvent>();

        this.bucket.deleteObject(params, function(err, data) {
            retSubject.next(new FileEvent(FileEventType.FILE_DELETE_END, file));
            if (err) {
                file.status = ManagedFileStatus.UPLOADED;
            } else {
                file.status = ManagedFileStatus.DELETED;
                retSubject.next(new FileEvent(FileEventType.FILE_DELETE_SUCCESS, file));
            }
            retSubject.complete();
        });
        file.status = ManagedFileStatus.DELETING;
        retSubject.next(new FileEvent(FileEventType.FILE_DELETE_START, file));

        return retSubject;
    }

    uploadFile(file: ManagedFile, path: string, options: any): Observable<FileEvent> {
        let binaryContent = file.getBinaryContent();

        let params: any = {
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
            params.Metadata = { originalName: encodeURIComponent(file.originalName) };
        }

        // Override default values
        Object.assign(params, options);

        let retSubject = new Subject<FileEvent>();

        let upload: ManagedUpload = this.bucket.upload(params);

        upload.on('httpUploadProgress', evt => {
            file.uploadPercentage = Math.floor(evt.loaded * 100 / evt.total);
            retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_PROGRESS, file));
        }).send((err, data) => {
                retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_END, file));
                if (err) {
                    file.status = ManagedFileStatus.LOADED;
                    retSubject.error(err);
                } else {
                    file.uri = data.Location;
                    file.status = ManagedFileStatus.UPLOADED;
                    retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_SUCCESS, file));
                    retSubject.complete();
                }
            }
        );
        file.status = ManagedFileStatus.UPLOADING;
        retSubject.next(new FileEvent(FileEventType.FILE_UPLOAD_START, file));

        return retSubject;
    }

    private get bucket() {
        const config = new AWS.Config({
            credentials: new AWS.Credentials({
                accessKeyId: this._accessKeyId,
                secretAccessKey: this._secretAccessKey
            }),
            region: this._region,
            maxRetries: 3,
            sslEnabled: true,
            signatureVersion: 'v4'
        });

        AWS.config.update(config);

        AWS.config.apiVersions = {
            s3: '2006-03-01'
        };

        return new AWS.S3();
    }

}