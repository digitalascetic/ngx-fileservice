import {Observable} from 'rxjs';

import {ManagedFile} from './managed-file';
import {FileEvent} from './file-event';

export interface FileService {

    uploadFile(file: ManagedFile, path: string, options?: any): Observable<FileEvent>;

    deleteFile(file: ManagedFile, options?: any): Observable<FileEvent>;

    cancelUpload();

}
