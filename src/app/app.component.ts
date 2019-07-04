import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import * as Dropbox from 'dropbox';

import { environment } from '../environments/environment';
import { S3FileService } from '../../projects/digitalascetic/ngx-fileservice/src/lib/s3.file.service';
import { FileEvent, FileEventType } from '../../projects/digitalascetic/ngx-fileservice/src/lib/file-event';
import { ManagedFile, ManagedFileStatus } from '../../projects/digitalascetic/ngx-fileservice/src/lib/managed-file';
import { MultiFileEvent, MultiFileEventType } from '../../projects/digitalascetic/ngx-fileservice/src/lib/multi-file-event';
import { Md5 } from 'ts-md5';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {

    private _s3FileService: S3FileService;
    private $destroy: Subject<void> = new Subject<void>();

    form: FormGroup;

    filesUploaded: number = 0;
    uploadingFile: ManagedFile = null;
    lastUploadedFile: ManagedFile = null;
    totalFiles: number = 0;
    publicFiles: boolean = false;

    fileEvents: Subject<FileEvent>;

    multiFileEvents: Subject<MultiFileEvent>;

    private readonly _managedFiles: Array<ManagedFile>;
    private _files: Array<File> = [];

    constructor(
        private _fb: FormBuilder
    ) {
        this._s3FileService = new S3FileService(environment.s3_bucket_name, environment.s3_access_key_id, environment.s3_secret_access_key, environment.s3_region, {
            httpOptions: {
                timeout: 0, // Milliseconds
            },
        });
        this.form = this._fb.group({
            'file': []
        });

        this.fileEvents = new Subject<FileEvent>();
        this.multiFileEvents = new Subject<MultiFileEvent>();
        this._managedFiles = [];
    }

    ngOnInit(): void {
        this.initDropbox();
        this.initS3();
    }

    ngOnDestroy() {
        this.$destroy.next();
        this.$destroy.complete();
    }


    /**
     * Dropbox
     */

    initDropbox() {
        // Create an instance of Dropbox with the access token and use it to
        // fetch and render the files in the users root directory.
        const dbx = new Dropbox.Dropbox({ accessToken: environment.dropbox_access_token });
        const that = this;
        dbx.filesListFolder({ path: '', recursive: false, include_media_info: false, include_deleted: false, include_has_explicit_shared_members: false })
            .then(function(response) {
                that.renderItems(response.entries);
            })
            // NOTE: Need to explicitly specify type of error here, since TypeScript cannot infer it.
            // The type is mentioned in the TSDoc for filesListFolder, so hovering over filesListFolder
            // in a TS-equipped editor (e.g., Visual Studio Code) will show you that documentation.
            .catch(function(error: DropboxTypes.Error<DropboxTypes.files.ListFolderError>) {
                console.error(error);
            });
    }

    // Render a list of items to #files
    renderItems(items: DropboxTypes.files.MetadataReference[]) {
        const filesContainer = document.getElementById('files');
        items.forEach(function(item) {
            const li = document.createElement('li');
            li.innerHTML = item.name;
            filesContainer.appendChild(li);
        });
    }

    uploadFileDropbox() {
        const dbx = new Dropbox.Dropbox({ accessToken: environment.dropbox_access_token });
        const fileInput = (<HTMLInputElement>document.getElementById('file-upload'));
        const file = fileInput.files[0];
        dbx.filesUpload({ path: environment.dropbox_base_dir + '/' + file.name, contents: file })
            .then(function(response) {
                const results = document.getElementById('results');
                results.appendChild(document.createTextNode('File uploaded!'));
                console.log(response);
            })
            .catch(function(error) {
                console.error(error);
            });

        return false;
    }


    /**
     * Amazon S3
     */

    initS3() {
        this.fileEvents.pipe(takeUntil(this.$destroy)).subscribe(
            (fileEvent: FileEvent) => {
                switch (fileEvent.type) {
                    case FileEventType.FILE_UPLOAD_START: {
                        this.uploadingFile = fileEvent.file;
                        break;
                    }

                    case FileEventType.FILE_UPLOAD_SUCCESS: {
                        this.lastUploadedFile = fileEvent.file;
                        this.uploadingFile = null;
                        this.filesUploaded++;
                        break;
                    }

                    case FileEventType.FILE_UPLOAD_CANCELED: {
                        this.uploadingFile = null;
                        break;
                    }
                }
            }
        );
        this.multiFileEvents.pipe(takeUntil(this.$destroy)).subscribe(
            multiFileEvent => {
                switch (multiFileEvent.type) {
                    case MultiFileEventType.UPLOAD_START: {
                        this.filesUploaded = 0;
                        break;
                    }
                }
            }
        );
    }

    uploadFileS3() {
        this.uploadFiles(this._files, this.publicFiles, 'test-dir');
    }

    updateFiles(event: any) {
        if (event.target && event.target.files && event.target.files.length > 0) {
            this.manageFiles(event.target.files);
        }
    }

    cancelUpload() {
        this._s3FileService.cancelUpload();
    }

    cancelUploads() {
        this._files = [];
        this._s3FileService.cancelUpload();
    }

    manageFiles(files: File[]) {
        this._files = files;
        this.totalFiles = files.length;
    }

    uploadFiles(files: File[], publicFile: boolean = false, uploadDir: string) {
        const totalFiles: number = files.length;

        const loaderObservable: Subject<ManagedFile> = new Subject<ManagedFile>();
        loaderObservable
            .pipe(
                take(totalFiles)
            )
            .subscribe((file: ManagedFile) => {
                this._uploadFile(file, environment.s3_base_dir + '/' + uploadDir);
            }, () => {
                this.multiFileEvents.next(new MultiFileEvent(MultiFileEventType.LOAD, this._managedFiles));
            });


        for (let i = 0; i < totalFiles; i++) {
            const reader: FileReader = new FileReader();
            const file = files[i];

            reader.addEventListener('load', (event: any) => {
                const managedFile = ManagedFile.fromClientUpload(event.target.result, file.name, uploadDir);
                managedFile.size = file.size;
                managedFile.public = publicFile;

                // TODO maybe set also lastUpdatedDate
                loaderObservable.next(managedFile);
                if (i === totalFiles) {
                    loaderObservable.complete();
                }
            }, false);

            reader.readAsDataURL(file);
        }
    }

    private _emitMultiFileEvent(fileEvent: FileEvent) {
        switch (fileEvent.type) {
            case FileEventType.FILE_UPLOAD_START: {
                if (this._managedFiles.some((file => {
                    return file.status === ManagedFileStatus.UPLOADING && file != fileEvent.file;
                }))) {
                    this.multiFileEvents.next(new MultiFileEvent(MultiFileEventType.UPLOAD_START, this._managedFiles));
                }

                break;
            }

            case FileEventType.FILE_UPLOAD_PROGRESS: {
                this.multiFileEvents.next(new MultiFileEvent(MultiFileEventType.UPLOAD_PROGRESS, this._managedFiles));
                break;
            }

            case FileEventType.FILE_UPLOAD_FAILED: {
                if (this._managedFiles.every((file => {
                    return file.status === ManagedFileStatus.UPLOADED;
                }))) {
                    this.multiFileEvents.next(new MultiFileEvent(MultiFileEventType.UPLOAD_END, this._managedFiles));
                }

                break;
            }
        }
    }

    private _uploadFile(file: ManagedFile, uploadDir: string): void {
        this.fileEvents.next(new FileEvent(FileEventType.FILE_LOAD, file));
        this._managedFiles.push(file);
        this._s3FileService.uploadFile(file, uploadDir + '/' + file.name, [])
            .pipe(
                takeUntil(this.$destroy)
            )
            .subscribe((fileEvent: FileEvent) => {
                this.fileEvents.next(fileEvent);
                this._emitMultiFileEvent(fileEvent);
            });
    }

}
