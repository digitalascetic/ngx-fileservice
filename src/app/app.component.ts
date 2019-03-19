import { Component, OnInit } from '@angular/core';
import * as Dropbox from 'dropbox';
import { S3FileService } from '../../projects/digitalascetic/ngx-fileservice/src/lib/s3.file.service';
import { ManagedFile, ManagedFileStatus } from '../../projects/digitalascetic/ngx-fileservice/src/lib/managed.file';
import { FormBuilder, FormGroup } from '@angular/forms';
import { FileEvent, FileEventType } from '../../projects/digitalascetic/ngx-fileservice/src/lib/file.event';
import { Subject } from 'rxjs';
import { ManagedFileValidator } from '../../projects/digitalascetic/ngx-fileservice/src/lib/managed-file-validator';
import { MultiFileEvent, MultiFileEventType } from '../../projects/digitalascetic/ngx-fileservice/src/lib/multi.file.event';
import { take } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {

    private _s3FileService: S3FileService;

    form: FormGroup;

    fileUploaded: number = 0;
    totalFiles: number = 0;
    publicFiles: boolean = false;
    fileValidators: ManagedFileValidator[] = [];

    fileEvents: Subject<FileEvent>;

    multiFileEvents: Subject<MultiFileEvent>;

    private readonly _managedFiles: Array<ManagedFile>;
    private _files: Array<File>;

    constructor(
        private _fb: FormBuilder
    ) {
        this._s3FileService = new S3FileService(environment.s3_bucket_name, environment.s3_access_key_id, environment.s3_secret_access_key, environment.s3_region);
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
        this.multiFileEvents.subscribe(
            multiFileEvent => {

                switch (multiFileEvent.type) {

                    case MultiFileEventType.UPLOAD_START: {
                        //this.fileUploading++;
                        break;
                    }

                    case MultiFileEventType.UPLOAD_END: {
                        //this.fileUploading--;
                        this.fileUploaded = multiFileEvent.getUploadedFile();
                        break;
                    }

                    case MultiFileEventType.UPLOAD_PROGRESS: {
                        //this.totalProgressUpload = multiFileEvent.getUploadProgress();
                        break;
                    }

                }
            }
        );
    }

    uploadFileS3() {
        this.uploadFiles(this._files, this.fileValidators, this.publicFiles, environment.s3_base_dir);
    }

    updateFiles(event: any) {
        if (event.target && event.target.files && event.target.files.length > 0) {
            this.manageFiles(event.target.files);
        }
    }

    manageFiles(files: File[]) {
        this._files = files;
        this.totalFiles = files.length;

        /*
        if (this.fileValidators) {
            this.fileValidators.forEach(validator => {
                if (validator.validators.indexOf(FileValidators.SIZE_VALIDATOR) &&
                    validator.maxSizeAllowed === null) {
                    validator.maxSizeAllowed = this.maxSizeAllowed;
                }
            });
        }
        */
    }

    uploadFiles(files: File[], fileValidators: ManagedFileValidator[] = null, publicFile: boolean = false, uploadSubDir?: string) {
        const loaderObservable: Subject<ManagedFile> = new Subject<ManagedFile>();

        loaderObservable
            .pipe(
                take(1)
            )
            .subscribe((file: ManagedFile) => {
                if (fileValidators && fileValidators.length > 0) {
                    let passedValidations: boolean = true;

                    fileValidators.forEach(validator => {
                        if (!validator.validate(file, this.fileEvents)) {
                            passedValidations = false;
                        }
                    });

                    if (passedValidations) {
                        this._uploadFile(file, uploadSubDir);
                    }
                } else {
                    this._uploadFile(file, uploadSubDir);
                }
            }, () => {
                this.multiFileEvents.next(new MultiFileEvent(MultiFileEventType.LOAD, this._managedFiles));
            });

        const totalfiles = files.length;

        for (let i = 0; i < totalfiles; i++) {
            const reader: FileReader = new FileReader();
            const file = files[i];

            reader.addEventListener('load', (event: any) => {
                const managedFile = ManagedFile.fromClientUpload(event.target.result, file.name);
                managedFile.size = file.size;
                managedFile.name = file.name;
                managedFile.public = publicFile;

                // TODO maybe set also lastUpdatedDate
                loaderObservable.next(managedFile);
                if (i === totalfiles) {
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

            case FileEventType.FILE_UPLOAD_END: {
                if (this._managedFiles.every((file => {
                    return file.status === ManagedFileStatus.UPLOADED;
                }))) {
                    this.multiFileEvents.next(new MultiFileEvent(MultiFileEventType.UPLOAD_END, this._managedFiles));
                }

                break;
            }
        }
    }

    private _uploadFile(file: ManagedFile, uploadSubDir: string = ''): void {
        this.fileEvents.next(new FileEvent(FileEventType.FILE_LOAD, file));
        this._managedFiles.push(file);
        this._s3FileService.uploadFile(file, uploadSubDir + '/' + file.name, [])
            .pipe(
                take(1)
            )
            .subscribe((fileEvent: FileEvent) => {
                this.fileEvents.next(fileEvent);
                this._emitMultiFileEvent(fileEvent);
            });
    }

}
